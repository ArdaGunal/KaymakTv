# Moderasyon — Bildirilen İçeriği Görme ve İşleme

> Pratik el kitabı. Tasarım gerekçeleri: `HISTORY.md` Madde 187 (F9) ·
> faz takibi: [`MASTER_PLAN.md`](MASTER_PLAN.md) F9/F10.

---

## 0. Bildirim geldiğinde ne oluyor?

Yeni bir bildirim kaydedildiğinde Worker **Discord'a haber veriyor** — geri
bildirim sisteminin zaten kullandığı webhook üzerinden, yeni altyapı yok.

Mesajda: **rapor id** · sebep · hedef tipi ve id · bildirenin açıklaması.

> ⚠️ **Bildirilen içeriğin METNİ Discord'a GÖNDERİLMİYOR** (bilinçli). UGC'yi
> üçüncü bir platforma yaymak gereksiz bir gizlilik yüzeyi. Rapor id'siyle
> aşağıdaki sorgudan tam kayda bakılır.

**Tekrar bildirimlerde mesaj gitmez** — `023`'teki UNIQUE kısıtı yeni satır
oluşturmadığı için Discord'a da yeni bilgi taşınmaz.

**Discord erişilemezse bildirim yine de kaydedilir** (fail-soft); hata
`wrangler tail`'de görünür.

---

## 1. Bildirimler nerede duruyor?

Tek yerde: **`content_reports` tablosu** (Supabase).

**Uygulamada bir moderasyon ekranı YOK** — bilinçli. Bildirimleri yalnızca
`service_role` görebilir; tabloda `SELECT` politikası hiç verilmedi, yani
anon key ile (uygulamanın kullandığı anahtar) **okunamaz**. Kendi gönderdiğin
bildirimi bile uygulamadan geri okuyamazsın.

Erişim yolu: **Supabase Dashboard → SQL Editor** (Dashboard `service_role`
ile çalışır). Table Editor'den de görülebilir ama ham `target_id`'ler işe
yaramaz — aşağıdaki sorgu içeriği de getiriyor.

---

## 2. Bekleyen bildirimleri İÇERİĞİYLE birlikte gör

```sql
select
  r.created_at                                    as bildirim_tarihi,
  r.reason                                        as sebep,
  r.detail                                        as aciklama,
  ru.username                                     as bildiren,
  r.target_type                                   as hedef_tipi,
  case r.target_type
    when 'activity' then coalesce(
      nullif(fa.note, ''),
      fa.activity_type || ' · ' || coalesce(fa.show_title, '?')
    )
    when 'comment'       then c.body
    when 'trakt_comment' then '(Trakt yorumu — bizde saklanmıyor)'
  end                                             as icerik,
  case r.target_type
    when 'activity' then au.username
    when 'comment'  then cu.username
  end                                             as icerik_sahibi,
  r.target_id,
  r.id                                            as rapor_id
from content_reports r
left join users ru            on ru.id = r.reporter_user_id
left join feed_activities fa  on r.target_type = 'activity' and fa.id::text = r.target_id
left join users au            on au.id = fa.user_id
left join comments c          on r.target_type = 'comment'  and c.id::text = r.target_id
left join users cu            on cu.id = c.user_id
where r.status = 'open'
order by r.created_at desc;
```

**`icerik` boş geliyorsa** içerik zaten silinmiş demektir (bildirim duruyor —
`target_id` bilinçli olarak FK değil, silinmiş içerik de bildirilebilsin diye).

**En çok bildirilen içerikler** (F10'un eşiğini belirlerken işe yarar):

```sql
select target_type, target_id, count(*) as bildirim_sayisi,
       array_agg(distinct reason) as sebepler
from content_reports
where status = 'open'
group by target_type, target_id
having count(*) > 1
order by bildirim_sayisi desc;
```

> `023`'ten sonra bir kullanıcı aynı hedefi **yalnızca bir kez** bildirebilir,
> dolayısıyla buradaki sayı **gerçek kişi sayısıdır**. F10'un otomatik gizleme
> eşiği bu sayıya güvenebilir — düzeltme öncesi güvenemezdi.

---

## 3. Moderasyon eylemleri

Hepsi elle, SQL Editor'den. **Otomatik gizleme F10'da gelecek.**

**İçeriği kaldır** (aktivite — altındaki yorum ve beğeniler CASCADE ile gider):
```sql
delete from feed_activities where id = '<target_id>';
```

**Tek bir yorumu kaldır:**
```sql
delete from comments where id = '<target_id>';
```

**Bildirimi işlenmiş olarak kapat** (içeriği silmek raporu kapatmaz):
```sql
update content_reports set status = 'reviewed'  where id = '<rapor_id>';
update content_reports set status = 'dismissed' where id = '<rapor_id>';  -- asılsız
```

**Bir hedefe ait tüm bildirimleri birlikte kapat:**
```sql
update content_reports set status = 'reviewed'
where target_type = 'activity' and target_id = '<target_id>';
```

> ⚠️ **`status` yalnızca buradan değişir.** İstemcinin bu kolona yazma yetkisi
> hiçbir zaman olmadı: Worker `status` göndermiyor (DB `DEFAULT 'open'`) ve
> tabloda `UPDATE` politikası yok.

**Trakt yorumları (`trakt_comment`):** içerik bizde değil, silemeyiz. Yapılacak
şey Trakt'a bildirmek; bizim tarafta rapor `dismissed`/`reviewed` yapılır.

---

## 4. Kim ne yapabiliyor — özet

| | anon key (uygulama) | service_role (Worker / Dashboard) |
|---|---|---|
| Bildirim gönder | ❌ (`023` Bölüm B'den sonra) — Worker üzerinden | ✅ |
| Bildirimleri oku | ❌ hiçbir zaman | ✅ |
| `status` değiştir | ❌ hiçbir zaman | ✅ |
| İçerik sil | yalnızca **kendi** içeriğini (`/feed/delete`, `WHERE user_id`) | ✅ herkesinkini |

---

## 5. Bilinen sınırlar

1. **Uygulama içi moderasyon paneli yok.** Google Play UGC gereksinimi
   *bildirme arayüzünü* şart koşuyor (var); moderasyonun uygulama içinde
   olması şart değil. Ölçek büyürse ayrı bir faz.
2. ~~Bildirim geldiğinde uyarı yok.~~ ✅ **Kapandı** — Discord bildirimi
   eklendi (§0). Discord'da rapor id'sini görüp §2'deki sorguyla içeriğe
   bakılıyor.
3. **İtiraz yolu yok.** Yanlış silinen içerik geri gelmez. F10'da otomatik
   gizleme açılırken bu karara bağlanmalı — gizleme (geri alınabilir) ile
   silme (geri alınamaz) arasındaki fark orada belirleyici olacak.
4. **Misafir bildirim gönderemez** (`023` sonrası). Kimliksiz bildirim,
   kişi başına tek bildirim kısıtını işlevsiz bırakıyordu.

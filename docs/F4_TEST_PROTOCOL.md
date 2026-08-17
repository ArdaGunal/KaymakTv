# F4 — Uçtan Uca Cihaz Testi Protokolü

> **Bu dosya bir durum panosu DEĞİLDİR.** Faz takibi tek yerde:
> [`MASTER_PLAN.md`](MASTER_PLAN.md) §0. Burası yalnızca cihazda uygulanacak
> test senaryosudur. (Madde 178'in dersi: ikinci bir pano ıraksar.)
>
> **Neden yazılı protokol:** inceleme sistemi (Madde 165-179) hiç uçtan uca
> çalıştırılmadı. Bu ortamda Trakt CORS'a takıldığı için dizi/film sayfası
> render edilemiyor — testi yalnızca gerçek cihazda, gerçek Trakt oturumuyla
> sen yapabilirsin.
>
> **Çıkış kriteri:** aşağıdaki tüm ZORUNLU adımlar geçerse
> 🔓 **build kilidi kalkar.**

---

## 0. Ön Koşullar (teste başlamadan doğrula)

| # | Kontrol | Nasıl | Beklenen |
|---|---|---|---|
| Ö1 | `020` migration çalıştı mı | Supabase SQL Editor → aşağıdaki S1 sorgusu | `in_feed` var, `is_generated = ALWAYS` |
| Ö2 | Worker güncel sürümde mi | `curl -X POST https://<worker>/feed/review/delete` | **404** (bu uç v2'de kaldırıldı) |
| Ö3 | Test hesabı gizli DEĞİL | Trakt → Settings → Privacy | `private` KAPALI |
| Ö4 | Başlangıç sayacı | S2 sorgusu | `reviewed` satır sayısını NOT AL (canlıda 0'dı) |

**Worker loglarını AÇIK TUT** — her adımda ne olduğunu görmek için:

```bash
npx wrangler tail --format pretty
```

---

## 1. Test Adımları

Her adımda: **cihazda gör** → **Worker logunda gör** → **DB'de gör**. Üçü
birden tutmuyorsa adım GEÇMEMİŞTİR.

> 🔴 **`wrangler tail`'deki `Ok` BAŞARI DEĞİLDİR.** O, Cloudflare'in *outcome*
> alanı — anlamı yalnızca "Worker istisna atmadan tamamlandı". Uç nokta
> **400** (geçersiz girdi), **401** (token), **403** (gizli hesap) veya
> **502** (Supabase yazamadı) dönse de satır aynen `Ok` görünür.
>
> ```
> POST .../feed/review - Ok @ 17.08.2026 13:17:09     ← HİÇBİR ŞEY KANITLAMAZ
> ```
>
> **Tek geçerli kanıt DB'dir** (S3 sorgusu). İkincil kanıt: `console.error`
> satırları — Worker yalnızca INSERT/PATCH hatalarında log basar, dolayısıyla
> **log yokluğu** 400/401'i elemez (o dallar sessizce `json(...)` döner).
> Cihazdaki görünür geri bildirim de kanıttır: gerçek bir 400/401'de sheet
> açık kalıp kırmızı hata kutusu gösterir (T9).

### T1 · Dizi incelemesi yaz — ZORUNLU

1. Bir dizi sayfası aç → **KaymakTV İncelemeleri** bölümüne in
2. Buton **"İnceleme Yaz"** yazmalı ve **aktif** olmalı
   - Pasifse ve altında *"Yapım bilgisi yükleniyor…"* varsa → `tmdbId` henüz
     çözülmemiş, birkaç saniye bekle. Kalıcıysa **BUG** (T1 başarısız).
3. Sheet'i aç, en az 3 karakter yaz, **Gönder**

| Beklenen | Nerede |
|---|---|
| Sheet kapanır, inceleme listenin **en üstünde** görünür | Cihaz |
| Alt notta *"İncelemen KaymakTV akışında yayınlanır."* yazar — **"Trakt'ta" GEÇMEMELİ** | Cihaz (sheet) |
| `POST /feed/review` satırı düşer (⚠️ `Ok` başarı DEĞİL — yukarıdaki uyarı) | `wrangler tail` |
| **Satırın gerçekten yazıldığı** | **S3 sorgusu — TEK geçerli kanıt** |
| Yeni satır: `activity_type='reviewed'`, `tmdb_id` DOLU, `episode_number` NULL, `in_feed=true` | S3 sorgusu |

> ⚠️ `tmdb_id` NULL çıkarsa bu **sessiz bir hata** — Worker onu zorunlu tutuyor,
> NULL görünmesi şemada bir sorun demektir. Bildir.

### T2 · Akışa düşme + çift kart kontrolü (R6) — ZORUNLU

1. Ana akışa (Feed) geç
2. İncelemeyi kart olarak gör

| Beklenen | Not |
|---|---|
| **TEK kart** görünür | İki kart görünürse R6 regresyonu — Realtime yankısı iyimser kartla eşleşmemiş |
| Kart kapatıp açınca hâlâ tek | Kalıcı çift kart = DB'de iki satır (daha kötü), S3 ile doğrula |

### T3 · Yanıt yaz — ZORUNLU
İnceleme kartına yorum yaz → görünmeli, sayaç artmalı.

### T4 · Beğen — ZORUNLU
Beğen → sayaç +1. **Uygulamayı kapat aç** → beğeni KALICI olmalı
(iyimser güncelleme geri alınmamış olmalı).

### T5 · Düzenle → tarih SABİT KALMALI — ZORUNLU

> Bu adım kolay atlanır ama en sinsi hatayı yakalar.

1. Akışta incelemenin **nerede durduğunu** not al (üstünde hangi kart var)
2. Dizi sayfasına dön → buton artık **"İncelemeni Düzenle"** demeli
3. Sheet mevcut metni **ön-dolu** getirmeli
4. Metni değiştir → Gönder
5. Akışa dön

| Beklenen | Anlamı |
|---|---|
| Kart **AYNI YERDE** duruyor, tepeye FIRLAMADI | `activity_at` patch'e eklenmemiş ✅ |
| `updated: true` | `wrangler tail` |
| S3'te `activity_at` **değişmemiş**, `note` değişmiş | DB kanıtı |

### T6 · Bölüm incelemesi → akışa DÜŞMEMELİ — ZORUNLU

> v2'nin en yeni davranışı, hiç test edilmedi.

1. Bir **bölüm** sayfası aç (`/episode/...`)
2. İnceleme yaz

| Beklenen | Nerede |
|---|---|
| Bölüm sayfasında **görünür** | Cihaz |
| Ana akışta **GÖRÜNMEZ** | Cihaz — Feed'i yenile, aramalısın |
| Satırda `episode_number='S..E..'` ve **`in_feed = false`** | S3 sorgusu |

> `in_feed` türetilmiş kolon — `true` çıkarsa `020`'deki ifade yanlış demektir.

### T7 · Film incelemesi — ZORUNLU
Film sayfasında T1'i tekrarla. `media_type='movie'`, `in_feed=true`.
Film sayfasında bölüm incelemesi seçeneği **olmamalı**.

### T8 · Sil — ZORUNLU
İncelemeyi sil → karttan ve akıştan kalkar, DB'den satır gider (S3).
Silme `/feed/delete` üzerinden gitmeli (`wrangler tail`) — `/feed/review/delete`
çağrısı görürsen istemci eski sürümde.

### T9 · Hata yolu: emek kaybolmuyor mu — ZORUNLU

> Sessiz başarısızlık yasağının (`AI_RULES` §2) canlı testi.

1. Sheet'i aç, **uzun** bir metin yaz (200+ karakter)
2. **Uçak modunu AÇ**
3. Gönder'e bas

| Beklenen | Anlamı |
|---|---|
| Sheet **KAPANMAZ** | Tünel problemi çözülmüş |
| Metin kutuda **DURUYOR** | Emek kaybolmadı |
| Kırmızı kutuda hata **mesajı görünür** | Sessiz başarısızlık yok |
| Uçak modunu kapatıp tekrar Gönder → başarılı | Kurtarma yolu çalışıyor |

### T10 · Sınırlar

| Girdi | Beklenen |
|---|---|
| 2 karakter | Gönder **pasif**, ipucu: *"İnceleme en az 3 karakter olmalı."* |
| 5001 karakter | Gönder **pasif**, kırmızı ipucu: *"…en fazla 5000 karakter olabilir."* |
| Boş | İpucu: *"Ne düşündüğünü yaz."* |
| Metin yazıp **X**'e bas | Onay sorulmalı: *"İncelemeden çıkılsın mı?"* |
| Android **geri tuşu** (metin varken) | Aynı onay sorulmalı |

### T11 · Misafir modu
Çıkış yap / misafir gir → buton yerine *"İnceleme yazmak için giriş yap"*
kutusu. Yazma yolu hiç açılmamalı.

### T12 · Gizlilik anahtarı `watched_movie`'yi de temizliyor mu (S5)

> Ayrı bir düzeltmenin doğrulaması — inceleme sistemiyle ilgisiz ama F4'te
> kontrol edilecekler listesinde.

1. En az bir **film izleme** kaydın olsun (akışta görünüyor olsun)
2. Ayarlar → *"İzlediklerimi Akışta Paylaş"* → **KAPAT**
3. Akışı yenile

| Beklenen |
|---|
| Hem `watched_episode` **hem** `watched_movie` kartları kalktı |
| Elle yazılmış **inceleme ve gönderi DURUYOR** (otomatik loglar silinir, elle yazılan İÇERİK SİLİNMEZ) |

> İnceleme de silinmişse bu **veri kaybı** — hemen bildir, ayarı geri açma.

> 🔴 **SAYARKEN `user_id` FİLTRESİ ŞART.** Gizlilik anahtarı yalnızca O
> KULLANICININ satırlarını siler; filtresiz bir `count(*)` tüm kullanıcıları
> toplar ve tam silme **kısmi silme gibi görünür**. Bu tuzağa F4 turunda
> gerçekten düşüldü: 511→468 ve 200→150 önce "silme çalışmıyor" sanıldı,
> oysa silinen 43+50 satır o kullanıcının TAMAMIydı.
>
> Ayarı kapatmadan önce ve sonra **aynı** sorguyu çalıştır:
> ```sql
> select activity_type, count(*) as adet
> from feed_activities
> where user_id = '<KENDİ users.id DEĞERİN>'   -- wrangler tail loglarında görünür
> group by 1 order by 2 desc;
> ```
> Ayarın gerçekten yazıldığını da teyit et:
> ```sql
> select trakt_slug, is_private, publish_watches, publish_ratings
> from users where id = '<KENDİ users.id DEĞERİN>';
> ```

### T13 · Trakt bloğu kademeli çöküş
Dizi sayfasında Trakt yorumları bloğu (soluk, `TRAKT` rozetli, butonsuz).
Trakt API'si hata verirse blok **sessizce kaybolmalı**, sayfa çalışmaya
devam etmeli. Bizim incelemelerimiz her hâlükârda görünür.

---

## 2. Doğrulama Sorguları (Supabase SQL Editor)

**S1 — `in_feed` kurulu ve türetilmiş mi**
```sql
select column_name, is_generated, generation_expression
from information_schema.columns
where table_name = 'feed_activities' and column_name = 'in_feed';
```

**S2 — inceleme sayacı (test öncesi/sonrası)**
```sql
select count(*) from feed_activities where activity_type = 'reviewed';
```

**S3 — test satırlarının tam hâli**
```sql
select id, activity_type, media_type, show_id, tmdb_id, episode_number,
       in_feed, left(note, 40) as note_head, note_spoiler,
       activity_at, created_at
from feed_activities
where activity_type = 'reviewed'
order by created_at desc
limit 20;
```

**S4 — GENERATED kolona yazılamadığını teyit et (HATA VERMELİ)**
```sql
update feed_activities set in_feed = false
where id = (select id from feed_activities limit 1);
```
> Hata vermezse `in_feed` GENERATED değil demektir — `020` eksik uygulanmış.

**S5 — çift satır var mı (R6 kalıcı hâli)**
```sql
select user_id, show_id, media_type, coalesce(episode_number,'') as ep, count(*)
from feed_activities
where activity_type = 'reviewed'
group by 1,2,3,4
having count(*) > 1;
```
> Boş dönmeli — `019`'daki unique index bunu zaten imkânsız kılmalı.

---

## 3. Sonuç Kaydı

Test bittiğinde:

- [ ] Tüm ZORUNLU adımlar geçti → 🔓 `MASTER_PLAN.md` §0'daki build kilidi
      kaldırılır, F4 ✅ işaretlenir
- [ ] `docs/HISTORY.md`'ye yeni madde: hangi adımlar geçti, ne bulundu
- [ ] Bulunan her hata → düzeltilir, ilgili adım **baştan** çalıştırılır
- [ ] Test verisi temizlenir (S3'teki test incelemeleri silinir) — canlı
      sayaç yeniden `0`'a döner

> ⚠️ **Kısmi geçiş build kilidini KALDIRMAZ.** Kilidin gerekçesi
> (`MASTER_PLAN` §3, kritik nokta 3): dağıtıldıktan sonra kullanıcıda oluşan
> veri temizlenemez ve şu anki "0 satır" temiz sayfası kaybolur.

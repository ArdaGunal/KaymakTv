# Akış Görünürlüğü — Elle Yazılan İçerik İçin Gizlilik

> **Bu dosya bir tasarım gerekçesi kaydıdır**, durum panosu değil. Faz takibi
> tek yerde: [`MASTER_PLAN.md`](MASTER_PLAN.md). Kronoloji:
> [`HISTORY.md`](HISTORY.md).

---

## 1. Sorun

Kullanıcı F4 testi sırasında buldu (2026-08-17):

> *"İzlediklerimi ve puanlamaları akışta paylaşabiliyorum, aç-kapa var.
> Yorumlar için buton yapmamışız ki?"*

Ayarlar ekranındaki durum:

| Anahtar | Kapsamı | Kapatılınca |
|---|---|---|
| "Aktivitemi Akışta Gizle" | *(hint: izlediklerin ve puanladıkların)* | ↓ ikisini birden |
| "İzlediklerimi Akışta Paylaş" | `watched_episode`, `watched_movie` | **SİLİNİR** |
| "Puanlarımı Akışta Paylaş" | `rated` | **SİLİNİR** |
| — **YOK** — | `reviewed`, `posted` | — |

**İki ayrı kusur:**

1. **Etiket yanıltıcı.** "Aktivitemi Akışta Gizle" — "aktivite" geniş bir
   kelime; kullanıcı incelemelerinin de gizleneceğini varsayıyor. Hint doğru
   kapsamı söylüyor ama switch'i açan kişinin hint okumak zorunda kalmaması
   gerekir. Bir **gizlilik** özelliğinde bu, kullanıcıya yanlış güven vermek
   demek.
2. **Kontrol yok.** `reviewed` ve `posted` için hiçbir görünürlük ayarı yok.

**Canlı kanıt:** kullanıcı "hepsini gizle"yi açtıktan sonra satırları
`reviewed 3` + `posted 1` idi — yani gizlediğini sandığı hâlde akışta
görünebilecek içeriği duruyordu.

---

## 2. Neden bugüne kadar fark edilmedi

`008_drop_feed_hidden.sql` şunu yazıyor:

> `feed_hidden=true` ile `publish_watches=false AND publish_ratings=false`
> birebir aynı sonucu üretiyordu — üç sütun, iki gerçek durum.

**O gün bu tamamen doğruydu.** 008 yazıldığında akışta yalnızca `watched_*` ve
`rated` vardı; üçüncü bir bayrak gerçekten fazlalıktı ve çelişkiye açık kapı
bırakıyordu.

Sonra iki yeni aktivite tipi geldi:
- `posted` → `017_feed_posts.sql`
- `reviewed` → `019_feed_reviews.sql`

İkisi de **elle yazılan içerik** ve ikisi de hiçbir gizlilik ayarının kapsamı
içinde değil. Yani `publish_watches=false AND publish_ratings=false` artık
"her şey gizli" ANLAMINA GELMİYOR — 008'in dayandığı denklik sessizce bozuldu.

> **Ders (bu projede tekrar eden hata sınıfı):** doğru bir karar, dayandığı
> koşullar değişince sessizce yanlışa döner. 008 silinmedi, ÇÜRÜTÜLDÜ — ve
> gerekçesi burada kayıtlı olduğu için çürütülebildi.

---

## 3. Değişmez kurallar (bunlar tartışmaya kapalı)

1. **Elle yazılan içerik SİLİNMEZ.** `reviewed` ve `posted`, Madde 165'te
   alınan karara tabi: *"Bir kullanıcının emek verip yazdığı içeriği, sırf
   DIŞARIDAKİ bir platformun ayarı değişti diye veritabanımızdan tamamen
   silmek kabul edilemez."* Bu özellik **gizleme**dir, silme değil.
   → `watched_*`/`rated`'den temel farkı budur: onlar Trakt'ın aynası,
   silinseler bir sonraki senkron geri getirir. İnceleme geri getirilemez.
2. **Üç ayar AYRIK kümeler olmalı.** 008'in uyarısı geçerliliğini koruyor:
   iki sütun aynı gerçeği tutarsa çelişki doğar.
3. **"Her Şeyi Gizle" TÜRETİLMİŞ kalır.** DB'de karşılığı olmayacak —
   008'in modeli aynen korunuyor, sadece türetim üç alana genişliyor.
4. **Gizlenen inceleme yapım sayfasında KALIR.** Gizlenen şey akıştaki
   görünürlük; inceleme dizi/film sayfasında görünmeye devam eder.
   (Aksi istenirse kullanıcı incelemeyi siler — o ayrı ve zaten var olan bir
   eylem.)

---

## 4. Model

```
publish_watches  → watched_episode, watched_movie   (SİLİNİR)
publish_ratings  → rated                            (SİLİNİR)
publish_manual   → reviewed, posted                 (GİZLENİR, silinmez)   ← YENİ

hideAll = !publish_watches && !publish_ratings && !publish_manual   (türetilmiş)
```

Üç küme ayrık → hiçbir ayar diğerinin gerçeğini tutmuyor → 008'in çelişki
riski doğmuyor.

---

## 5. Mekanizma — neden trigger, neden view değil

Gizleme filtresinin akış sorgusuna girmesi gerekiyor. Değerlendirilen yollar:

| Yol | Neden seçilmedi / seçildi |
|---|---|
| `.eq('users.publish_manual', true)` akış sorgusuna | ❌ Filtre satır TİPİNE bakmaz; o kullanıcının TÜM satırlarını eler. "İzlemelerim görünsün ama incelemem görünmesin" imkânsız hâle gelir. |
| PostgREST `or(...)` ile koşullu filtre | ❌ Akış sorgusunda keyset sayfalama için ZATEN bir `.or(...)` var ve `020`'de açıkça uyarılmış: *"oraya ikinci bir bileşik koşul eklemek o ifadeyi kırma riski taşır."* Ayrıca embedded kolona (`users.x`) top-level `or` içinde referans PostgREST'te güvenilir değil. |
| Postgres VIEW + join | ❌ Akış sorgusu `user:users!inner(...)` **embed** kullanıyor; PostgREST join'li bir view üzerinde bu ilişkiyi güvenilir biçimde türetemez. `ACTIVITY_COLUMNS`'ı ve `mapRow`'u baştan yazmak gerekirdi. |
| Elle yönetilen bayrak (Worker yazar) | ❌ **Tam olarak 008'in tuzağı.** İki yazma noktası (yeni satır + ayar değişimi) senkron dışı kalabilir. |
| ✅ **Denormalize kolon + TRIGGER, `in_feed` GENERATED ifadesine dahil** | Bayrak **elle yönetilmiyor**, Postgres türetiyor → senkron dışı kalması imkânsız. Akış sorgusu **hiç değişmiyor** (`in_feed` zaten tek kapı). |

### Neden bu yol gerçekten güvenli

`in_feed` bir GENERATED kolon ve **aynı satırdaki** kolonlara bakabiliyor ama
`users`'a bakamıyor. Bu yüzden `users.publish_manual` değeri satıra
`author_hides_manual` olarak yansıtılıyor — ama **elle değil, iki trigger ile**:

```
users.publish_manual değişti
        │  (AFTER UPDATE trigger)
        ▼
feed_activities.author_hides_manual güncellenir
        │  (GENERATED, otomatik)
        ▼
in_feed yeniden hesaplanır
        │
        ▼
akış sorgusu (.eq('in_feed', true)) — DEĞİŞMEDEN doğru sonucu verir
```

Yeni satır yazılırken de bir BEFORE INSERT trigger değeri `users`'tan okuyor —
yani Worker'ın bu kolonu bilmesine bile gerek yok.

> `008`'in dersi ihlal edilmiyor: oradaki sorun bayrağın **elle** yönetilmesi
> ve ikinci bir gerçek kaynağa dönüşmesiydi. Burada tek gerçek kaynak
> `users.publish_manual`; satırdaki kopya tamamen türetilmiş.

---

## 6. Kapsam — dokunulan yerler

| Katman | Değişiklik |
|---|---|
| **DB** `021` | `users.publish_manual` · `feed_activities.author_hides_manual` · `in_feed` ifadesi genişler · 2 trigger |
| **Worker** | `PRIVACY_FIELDS`'e `publishManual` · **silme kodu EKLENMEZ** (bilinçli — kural 1) |
| **Servis** | `feedPrivacy.ts`: üçüncü alan okuma/yazma |
| **Hook** | `useFeedPrivacy.ts`: `hideAll` üç alana genişler · `applyPrivacyToFeed`'e `reviewed`/`posted` |
| **UI** | `account.tsx`: yeni anahtar + etiket dürüstleşmesi · `locales/{tr,en}/settings.json` |
| **Realtime** | `useFeedRealtime` — ⚠️ tuzak #6, ayrı doğrulanır |
| **Akış sorgusu** | ✅ **DEĞİŞMİYOR** — `in_feed` tek kapı |

---

## 7. Bağımsız tarama — kaçırılan üç nokta

Uygulamadan önce, akışın TÜM okuma yollarını bulmak için bağımsız bir tarama
yapıldı (alt ajan). **Kendi tasarımımda üç boşluk buldu** ve mevcut sistemde
zaten var olan bir deliği ortaya çıkardı. Bulguların hepsi burada, kararlarıyla:

### 🔴 K1 — `fetchActivityById` hiçbir filtre uygulamıyordu → **DÜZELTİLDİ**
`feedApi.ts` içindeki bu sorgu yalnızca `.eq('id', id)` yapıyordu. İki
tüketicisi var: Realtime satır tamamlama **ve `/activity/{id}` kalıcı
bağlantısı** — ve o sayfa (`app/activity/[id].tsx`) `(protected)` grubunun
**DIŞINDA**, yani oturum bile gerektirmiyor.

Bu, yalnızca yeni ayarı değil **mevcut `in_feed` sözleşmesini de deliyordu**:
`020`'den beri akışa düşmeyen bölüm incelemeleri, id'si bilinen herkese tam
kart olarak açılabiliyordu. F4-T6'da "akışa düşmüyor" diye doğruladığımız
davranışın arka kapısı buymuş.

**Karar:** `.eq('in_feed', true)` eklendi. Yan fayda: Realtime INSERT için
sunucu tarafında ikinci bir kilit oldu.

### 🔴 K4/K5 — Realtime → **DÜZELTİLDİ (biri önerilenden farklı şekilde)**
- **UPDATE'te görünürlük kontrolü yoktu.** 021 öncesi `in_feed` satır ömrü
  boyunca sabitti, bu yüzden gerek yoktu. Artık yazarın ayarı ifadeye
  girdiği için gizleme tam olarak bir UPDATE olarak geliyor — kart
  güncellenmek yerine **düşürülmeli**. Eklendi.
- **INSERT kontrolü `=== false` (fail-open).** Tarama `!== true` önerdi.
  **Uygulanmadı** — gerekçe: alan bir gün yükte hiç gelmezse `!== true` TÜM
  canlı akışı sessizce öldürür, bu gizli bir kartın görünmesinden daha kötü
  bir başarısızlık modu. Bunun yerine asıl kilit sunucuya taşındı (K1) ve
  buradaki kontrol "ucuz ön eleme" olarak belgelendi.

### 🟠 K2 — `fetchUserFeedActivities` hem kendi hem başkasının profili
Tarama, `isOwnProfile` parametresi ekleyip kullanıcının kendi gizlediği
içeriği kendi profilinde görebilmesini önerdi.

**Uygulanmadı — bilinçli.** `in_feed` iki kuralı birleştiriyor (bölüm
incelemesi + yazar gizlemesi) ve bunları PostgREST'te ayırmak, `020`'de
açıkça uyarılan keyset `.or(...)` ifadesini riske atacak bileşik bir filtre
gerektirirdi. Seçilen davranış daha tutarlı: **"gizle" dedinse her akış
görünümünde gizli — kendi profilin dahil.** İçerik silinmiyor, yapım
sayfasında duruyor ve ayar açılınca geri geliyor.

### ✅ K3 — `fetchMediaReviews` filtre uygulamıyor → **DOKUNULMADI, doğru**
Tarama bunu "filtre atlanırsa gizleme fiilen işe yaramaz" diye işaretledi.
Bu, kural 4 ile bilinçli bir tasarım tercihi: gizlenen şey **akış
görünürlüğü**, incelemenin kendisi değil. İnceleme bir yapım hakkındadır ve o
sayfaya aittir; oradan da kaldırmak istiyorsan doğru eylem incelemeyi
silmektir (zaten var).

---

## 8. UI yönü — dördü de "GİZLE"

Kullanıcı cihazda denerken bildirdi: *"Çalışıyor ama ters."* Davranış doğruydu
ama ekranda **iki zıt yön** vardı — üstteki "Gizle", alttaki üçü "Paylaş".

**Karar: dördü de GİZLE (AÇIK = GİZLİ).** DB alanları `publish_*` olarak kaldı
(veri modeli doğruydu); dönüşüm yalnızca `account.tsx`'te yapılıyor:

```
switch değeri     = !publish_X
switch'e dokununca → publish_X = !hide
```

Bunun ikinci bir faydası: eskiden "Gizle"yi açınca alttaki üç anahtar `false`'a
düşüp **kapalı** görünüyordu — "her şeyi gizledim" derken üç anahtarın
kapanması görsel bir çelişkiydi. Artık dördü de açık görünüyor.

### `hideAll` bir kısayol, KİLİT değil
Alt üç anahtar eskiden `hideAll` iken `disabled` yapılıyordu. Simülasyon
testi bunun bir tuzak olduğunu gösterdi: üçünü **tek tek** gizleyen kullanıcı,
`hideAll` türetilmiş olarak `true` olduğu için üçünü birden **kilitliyordu** —
yalnızca birini geri açması imkânsız hâle geliyordu (önce üstü kapat, o da
üçünü birden açar). Kilit kaldırıldı; `hideAll` zaten türetilmiş olduğu için
alt anahtarlardan biri açılınca kendiliğinden `false` oluyor.

---

## 9. Bilinen sınırlar (gizlenmiyor)

- **Gizleme yalnızca AKIŞI etkiler.** İnceleme yapım sayfasında görünmeye
  devam eder (kural 4). Kullanıcı bunu istemiyorsa incelemeyi silmeli.
- **Ayar geri açıldığında** `reviewed`/`posted` anında geri gelir (satırlar
  hiç silinmedi) — `watched_*`/`rated`'in aksine senkron beklemez. Bu bir
  tutarsızlık gibi görünebilir ama doğrudur: silinen şeyin geri gelmesi
  senkron ister, gizlenen şeyin gelmesi istemez.
- **`021` çalıştırılmadan Worker/istemci güncellenirse** `publish_manual`
  kolonu bulunamaz. Sıra: **önce migration, sonra deploy** (`020`'deki aynı
  sert bağımlılık).

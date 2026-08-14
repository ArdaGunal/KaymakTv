# KaymakTV Feed (Akış) Sistemi — Tasarım & Yol Haritası

**Son Güncelleme:** 2026-08-03
**Durum:** ✅ Phase 1 **uçtan uca canlı doğrulandı** + **ince taneli gizlilik sistemi tamamlandı**. Gerçek kullanıcı verisiyle test edildi, `feed_activities` doluyor, Profil/Feed ekranları gerçek aktiviteleri gösteriyor, Ayarlar'da 3 bağımsız gizlilik anahtarı var. Yolda ciddi bir prodüksiyon bug'ı bulunup düzeltildi — bkz. `docs/HISTORY.md` Madde 89 (kısmi unique index'ler PostgREST `on_conflict` ile hiç çalışmıyormuş).

### ✅ Sosyal Katman — Not/Alıntı, Yorum, Beğeni, Engelleme (Madde 155)
Tam uygulandı: DB (`015_feed_social.sql`, `016_user_blocks.sql`) + Worker (6 uç nokta) + Client servisleri + Realtime + UI (kart altı beğeni/yorum, not editörü, yorum sheet'i, engelleme ekranları). Detaylı tasarım: [`docs/FEED_SOCIAL_PLAN.md`](FEED_SOCIAL_PLAN.md). Detay: `docs/HISTORY.md` Madde 155.

### 📄 Sayfalama & Veri Saklama (Madde 148)
- **Sonsuz kaydırma:** sayfa başına 15 kayıt, `(activity_at, id)` **bileşik keyset imleci**. Basit imleç kullanılamaz — toplu sezon işaretlemesinde tüm bölümler aynı damgayı aldığı için sayfa sınırında kayıt kaybına yol açardı (regresyon testi mevcut).
- **Sorgu:** `user_id IN (...)` ile filtreleniyor (takip ettiklerim + ben), böylece `idx_feed_activities_user_time` gerçekten kullanılıyor.
- **Retention:** her gece 00:00 UTC (03:00 TR) `pg_cron` ile kullanıcı başına en yeni 200 kayıt tutulur. Zaman bazlı silme BİLİNÇLİ OLARAK tercih edilmedi (profil geçmişini yok ederdi + senkronla sonsuz döngüye girerdi).
- Yeni indeks eklenmedi: `001_feed_schema.sql`'dekiler zaten yeterli.

Detay: `docs/HISTORY.md` Madde 148.

### 🚀 Akış artık GERÇEK ZAMANLI (Madde 145)
Akış bir PULL modelinden (yalnızca uygulama açılışında `/feed/sync`) **PUSH + canlı** bir sosyal akışa dönüştü:
- **Anında yayın:** bir bölüm/film işaretlendiği ya da puan verildiği ANDA aktivite akışa düşer (`POST /feed/publish`). Kart ağ beklenmeden ekranda belirir (iyimser), yayın başarısız olursa geri alınır.
- **Canlı akış:** Supabase Realtime ile takip ettiklerinin aktiviteleri sayfa yenilemeden gelir; kullanıcı listeyi kaydırmışsa içerik ayağının altından kaymaz, üstte "N yeni gönderi" rozeti çıkar.
- **Çift kayıt neden olmuyor:** client zaman damgasını kendisi üretip Trakt'a `watched_at`/`rated_at` olarak AÇIKÇA gönderir ve aynısını yayınlar → sonraki tam senkron aynı dedup anahtarını üretir. Bu, tüm mimarinin temel taşıdır.
- **Yeni:** film izlemeleri (`watched_movie`) artık akışta; kartlarda gerçek posterler; dizi/film ayrımına göre doğru detay rotası (`media_type`).

⚠️ **Çalışması için 2 elle adım gerekir:** `supabase/schema/013_realtime_feed.sql` çalıştırılmalı ve Worker deploy edilmeli. Detay: `docs/HISTORY.md` Madde 145.

### ✅ Akış artık KENDİ aktivitelerini de gösteriyor + performans turu (Madde 142)
Akış eskiden yalnızca takip edilenlerin aktivitelerini gösteriyordu; kullanıcı kendini yalnızca Profil › Aktiviteler'de görebiliyordu. Artık `fetchFeedActivities` sorguya kullanıcının kendi `trakt_slug`'ını da dahil ediyor — **Profil sekmesi aynen korundu**, oradaki kod yolu (`fetchUserFeedActivities`) hiç değişmedi. Aynı turda performans/stabilite düzeltmeleri yapıldı:
- Takip listesi artık `store/followStore.ts`'ten (zaten önbellekli) okunuyor — her yüklemede Trakt'a giden **gereksiz ve sıralı** `getMyFollowingSlugs()` isteği kalktı, iki okuma paralelleşti.
- Kendi Trakt slug'ı için tek gerçek kaynak: `services/api/myIdentity.ts` (uygulama ömrü boyunca tek istek; çıkışta `clearMyTraktSlug()` ile temizlenir).
- Akış verisine 60 saniyelik bellek önbelleği (`invalidateFeedCache` ile senkron/silme sonrası geçersiz kılınır); pull-to-refresh `force` ile onu atlar.
- `useFeed`/`useUserActivity`/`usePublicProfileActivity`'nin üçünde tekrarlanan "çek → grupla → state" mantığı `features/feed/hooks/useActivityFeed.ts`'te tek çekirdeğe indi; yarış koruması ve **hata durumu** (artık "Akış Yüklenemedi" + Tekrar Dene, sessiz "Akışın Boş" yalanı yok) burada.
- `followStore` ↔ `useFollowState` çalışma-zamanı import döngüsü `import type` ile kırıldı; `fetchFollowingSlugs`'taki "uçuştaki isteği beklemeden dön" yarışı düzeltildi.

Detay: `docs/HISTORY.md` Madde 142.

### ✅ Çözüldü: "Her Şeyi Gizle" artık ayrı bir DB sütunu değil
Önceki oturumda açık bırakılan soru ("feed_hidden gereksiz mi?") kullanıcı tarafından karara bağlandı: **evet, gereksizdi ve çelişkili durum riski taşıyordu.** `supabase/schema/008_drop_feed_hidden.sql` ile sütun tamamen kaldırıldı. "Her Şeyi Gizle" artık `features/feed/hooks/useFeedPrivacy.ts`'te TÜRETİLMİŞ (derived) bir UI durumu: `!publishWatches && !publishRatings`. Açılınca ikisini birden `false` yapan tek bir istek atar; kapanınca ikisini birden `true`'ya döndürür; ikisinden biri (örn. başka bir cihazdan) tekrar açılırsa üstteki anahtar otomatik "kapalı" görünür — çünkü hesaplanan bir değer, senkron dışı kalması mümkün değil. Tek gerçek kaynak: `publish_watches` + `publish_ratings`.

### 🔴 KRİTİK BUG BULUNUP DÜZELTİLDİ: Token yenilenince React state güncellenmiyordu
Kullanıcı gerçek cihazda anahtarın "açılmayıp geri kapandığını" bildirdi. Canlı `wrangler tail` loglarıyla kök nedene inildi: `traktClient.ts`'teki interceptor token'ı arka planda sessizce yeniliyor ama yalnızca `SecureStore`'a yazıyor, `AuthContext`'teki React state'i hiç güncellemiyordu. Worker'a giden çağrılarımız (`feedSync.ts`, `feedPrivacy.ts`) `useAuth().accessToken`'ı (React state) okuyup gönderdiği için, arka planda bir yenileme olduktan SONRA bu çağrılar hâlâ ESKİ/geçersiz token'ı gönderip gerçek bir 401 alıyordu — **bu yalnızca gizlilik anahtarını değil, feed sync'i de etkileyen genel bir sorundu**. Detay: `docs/HISTORY.md` Madde 93. Düzeltme: `onSessionExpired`'ın simetriği `onTokenRefreshed` pub/sub'ı eklendi, `AuthContext` artık buna da abone.

### 🔴 Bu Oturumun Sonunda Kullanıcının Yapması Gerekenler (henüz doğrulanmadı)
1. `supabase/schema/007_add_publish_toggles.sql` VE `008_drop_feed_hidden.sql`'i SQL Editor'de sırayla çalıştır (006'yı zaten çalıştırmıştı — 006 artık tarihsel bir kayıt, 008 onu geri alıyor)
2. Worker'ı deploy et (zaten deploy edilmişti — teşhis loglaması da dahil): `cd "C:\Yapay_Zeka_Uygulamalar\kaymaktv-feedback-worker" && npx wrangler deploy`
3. **Uygulamayı tamamen kapatıp yeniden aç** (Madde 93 düzeltmesi client kodunda — mevcut oturumdaki React state'i zaten bozuk kalmaya devam eder, taze bir açılış SecureStore'dan güncel token'ı okur)
4. Ayarlar → "💬 Akış"taki 3 anahtarı test et: (a) yalnızca birini kapatıp diğerinin akışta kalmaya devam ettiğini, (b) ikisini de kapatınca üstteki "Her Şeyi Gizle"nin otomatik açık göründüğünü, (c) üstteki "Her Şeyi Gizle"yi açınca alttaki ikisinin otomatik kapanıp gri/basılamaz olduğunu doğrula
5. Sertay'ın senkron/takip durumu hâlâ doğrulanmadı (Madde 89 bug'ı öncesinden kalma, uygulamayı yeniden açması gerekiyor)

---

## 📌 Özet

KaymakTV sosyal ağına **Feed (Akış)** özelliği ekliyoruz. Kullanıcılar Trakt'ta takip ettikleri kişilerin dizi/film izleme aktivitelerini bir akışta görebilecekler. Sistem iki fazda inşa ediliyor:
- **Phase 1:** İzleme aktivitesi akışı (temel sosyal ağ, takip ilişkisi Trakt'tan)
- **Phase 2:** Yorum/Review sistemi + Bildirim + Real-time

---

## 🎯 Amaç & Kapsam

### Phase 1: Temel Sosyal Ağ
- ✅ Trakt'ta takip ettiğin kişilerin **2 aktivite tipini** feed'de görebilme:
  - `watched_episode` — Bölüm izledi
  - `rated` — Dizi/film'e puan verdi (1-10)
- ✅ Son **30 gün** aktiviteleri görmek (sabit sayfa boyutu, pagination Phase 1.5)
- ⏳ `started_show` / `completed_show` — **Phase 1.1'e ertelendi** (aşağıya bak, neden)

### Phase 1 Dışı (Sonraki Fazlara Ertelenenler)
- ❌ Yorum/Review sistemi (Phase 2)
- ❌ Kullanıcı profiline tıklayıp geçmiş görüntüleme (Phase 1.5)
- ❌ Real-time WebSocket bildirimleri (Phase 2)
- ❌ Like/Reply sistemi (Phase 2)

---

## 🏗️ Mimari Kararlar

### 1️⃣ Veri Kaynağı: Trakt + Supabase Hibrid

| Görev | Kaynağı | Neden |
|-------|---------|-------|
| Kimlik doğrulama (Login) | Trakt OAuth | Var olan sistem |
| **Takip ilişkisi (kim kimi takip ediyor)** | **Trakt'ın kendi API'si** (`GET /users/me/following`) | Bkz. "Mimari Pivot" aşağıda |
| Aktivite loglama (feed_activities) | Supabase | Trakt'a her feed açılışında N kişinin geçmişini sormak rate-limit'e çarpardı — bu yüzden sync ile önbelleğe alınıyor |
| İzleme detayları (kaynak veri) | Trakt | Gerçek veri, source of truth |

### 2️⃣ Mimari Pivot: Follow Sistemi Trakt'a Taşındı

**İlk yaklaşım (terk edildi):** Kendi `user_follows` tablomuzu kurup, kullanıcı arama + takip et/bırak akışını tamamen KaymakTV içinde inşa etmiştik (bkz. `docs/HISTORY.md` Madde 83).

**Neden vazgeçildi:** Trakt'ın zaten tam işlevsel, herkese açık bir sosyal grafiği var (`GET /users/{username}/followers`, `/following`, `/friends` — auth bile gerektirmiyor, canlı test edildi). Kendi tablomuzu tutmak şunlara yol açıyordu:
- Supabase Auth kullanmadığımız için (kimlik Trakt OAuth'tan geliyor) `auth.uid()` tabanlı RLS çalışmıyor → takip etme/bırakma yazımını güvenli yapmak için Worker'da ağır bir "token doğrula, sonra service_role ile yaz" mekanizması gerekiyordu
- Kullanıcının Trakt'ta zaten var olan takip ağı KaymakTV'de "sıfırdan" yeniden kurulmaya zorlanıyordu — gereksiz sürtünme
- Over-engineering: gerçek ihtiyaç yalnızca "feed_activities'i hızlı okumak", bunun için ayrı bir yazma-güvenlikli takip sistemi şart değildi

**Yeni model:** Kendi `user_follows` tablomuz **yok** (bkz. `supabase/schema/004_drop_user_follows.sql`). Feed her açıldığında:
1. Client kendi Trakt token'ıyla `GET /users/me/following` çağırır (var olan `getTraktClient()` altyapısıyla, Worker'a gerek yok — bu salt okuma, kullanıcı zaten kendi verisini okuyor)
2. Dönen `trakt_slug` listesiyle bizim `users` tablomuzda (yalnızca KaymakTV'yi kullanmış kişiler) eşleşenleri bulur
3. Eşleşenlerin `feed_activities`'ini Supabase'den okur

**Güncelleme — Uygulama İçi Arama/Takip Geri Geldi (Trakt-native):** İlk pivot kararında "takip etme Trakt'ın kendi arayüzünde yapılsın" denmişti, ama Trakt'ın gerçek bir `POST /users/{id}/follow` / `DELETE /users/{id}/follow` uç noktası olduğu keşfedilince, kullanıcı bunu KaymakTV içine geri almaya karar verdi — bu sefer **kendi DB'imiz veya Worker'a hiç ihtiyaç duymadan**. Feed ekranının üstüne bir arama çubuğu eklendi:

1. Kullanıcı tam bir Trakt kullanıcı adı yazar YA DA bir profil linki yapıştırır (`https://app.trakt.tv/profile/sertay?mode=media` gibi — regex ile linkten kullanıcı adı çıkarılır, **panoya (clipboard) hiç erişilmez**, kullanıcı metni kendisi yapıştırır)
2. `GET /users/{username}?extended=full` ile profil çekilir (client'ın kendi Trakt token'ıyla, doğrudan — Worker'a gerek yok, bu zaten kullanıcının kendi işlemi)
3. "Takip Et" butonu doğrudan `POST /users/{username}/follow` çağırır
4. **Önemli davranış farkı:** Trakt, gizli (private) hesaplarda takip isteğini anında onaylamıyor — `approved_at` alanı `null` dönüyorsa "onay bekleniyor" demektir, doluysa "anında takip edildi". UI bu iki durumu ayrı gösteriyor ("Takip Ediliyor" vs "Onay Bekleniyor").

Bu iş için Trakt'ın kendi sitesine/uygulamasına hiç gidip gelinmiyor — hepsi KaymakTV içinde. Detay için `docs/HISTORY.md`'deki ilgili maddeye bak.

### 3️⃣ Senkronizasyon Zamanlaması: App Launch (Option B)

```
Kullanıcı uygulamayı açar
  ↓
useFeedSyncTrigger: Trakt access token'ını Worker'a gönder
  ↓
Worker: token'ı doğrula (GET /users/settings) → users tablosuna upsert et
  ↓
Worker: /sync/history/episodes + /sync/ratings/{shows,movies} çek
  ↓
Worker: önce var olan kayıtları okur, kendi karşılaştırır, sade INSERT/PATCH yapar
  (⚠️ NOT: `on_conflict` ile upsert KULLANILMIYOR — bkz. HISTORY.md Madde 89,
  kısmi/partial unique index'ler PostgREST'in on_conflict'ıyla hiç çalışmıyor)
  ↓
Feed ekranı açıldığında: client Trakt'tan following listesini çeker,
Supabase'den o kişilerin feed_activities'ini okur
```

### 4️⃣ Activity Tipleri

**Phase 1'de senkronize edilenler (Trakt'ın doğrudan verdiği olaylar):**
- `watched_episode` — `/sync/history/episodes`
- `rated` — `/sync/ratings/shows` + `/sync/ratings/movies`

**Phase 1.1'e ertelenenler (Trakt'ta gerçek bir olay değil, çıkarsama gerektiriyor):**
- `started_show` — "ilk bölümü izlemiş olmak"tan çıkarsanır
- `completed_show` — "izlenen bölüm sayısı = toplam yayınlanan"dan çıkarsanır, her dizi için ayrı bir `/shows/{id}/progress/watched` çağrısı (rate-limit riski) + önceki-senkronla-kıyaslama mantığı gerektiriyor

---

## 🗄️ Veritabanı Şeması (Supabase)

Migration dosyaları `supabase/schema/` altında, sırayla Supabase SQL Editor'de çalıştırılır:

| Dosya | Ne yapar |
|-------|----------|
| `001_feed_schema.sql` | `users`, `user_follows` (artık terk edildi, bkz. 004), `feed_activities`, `comments` (Phase 2, boş) tablolarını + RLS SELECT politikalarını kurar |
| `002_fix_user_identity.sql` | `users.trakt_id BIGINT` (yanlıştı, Trakt'ta kullanıcılar için sayısal ID yok) → `trakt_slug TEXT` düzeltmesi |
| `003_feed_activity_upsert_constraints.sql` | `feed_activities` için partial unique index'ler — **artık Worker tarafından kullanılmıyor** (bkz. HISTORY.md Madde 89: PostgREST'in `on_conflict`'ı kısmi index'lerle çalışmıyor), ama zararsız/dursun diye kaldırılmadı |
| `004_drop_user_follows.sql` | Mimari pivot: `user_follows` tablosunu tamamen kaldırır |
| `005_ensure_feed_activity_indexes.sql` | (Artık gereksiz — teşhis sürecinde 003'ün gerçekten uygulanıp uygulanmadığını netleştirmek için yazılmıştı, asıl sorun index eksikliği değil on_conflict uyumsuzluğuydu) |

**Güncel şema (004 sonrası):**

```sql
-- users: Trakt kullanıcısının "aynası" — yalnızca sync sırasında kendi
-- satırını yazar, feed_activities'e FK vermek için gerekli.
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trakt_slug TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- feed_activities: İzleme aktivitesi önbelleği (Phase 1: watched_episode + rated)
CREATE TABLE feed_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (
    activity_type IN ('watched_episode', 'started_show', 'completed_show', 'rated')
  ),
  show_id BIGINT NOT NULL,
  show_title TEXT NOT NULL,
  show_poster_url TEXT,
  episode_number TEXT,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 10),
  activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- comments: Phase 2 için şimdiden hazır, boş
```

**RLS:** Her iki tabloda da yalnızca `SELECT` politikası var (herkese açık okuma). `INSERT`/`UPDATE`/`DELETE` için hiç politika yok — yazma yalnızca Worker'ın `service_role` anahtarıyla (RLS'i bypass ederek) yapılıyor, çünkü Supabase Auth kullanmadığımız için `auth.uid()` tabanlı satır sahipliği kontrolü çalışmıyor.

---

## 📊 Status Tracker

| Adım | Durum |
|------|-------|
| Veritabanı Şeması | ✅ TAMAMLANDI |
| Senkronizasyon Servisi (Worker `/feed/sync`) | ✅ TAMAMLANDI (kod) — **deploy edilmesi gerekiyor**, aşağıya bak |
| UI İskeleti (`features/feed/`) | ✅ TAMAMLANDI |
| Gerçek Veriye Bağlama | ✅ TAMAMLANDI (`useFeed.ts` → `feedApi.ts` → Trakt following + Supabase) |
| ~~Follow Sistemi (kendi DB'miz)~~ | ❌ TERK EDİLDİ — bkz. Mimari Pivot |
| Uygulama İçi Arama + Takip (Trakt-native) | ✅ TAMAMLANDI (kod) — gerçek ağ testi bu sandboxed tarayıcı ortamında yapılamadı, bkz. aşağı |
| Polish (pagination, boş durum ayrımı) | ⏳ YAPILACAK |
| Phase 1.1 (`started_show`/`completed_show`) | ⏳ YAPILACAK |

### Bilinçli Kapsam Daraltması: Şimdilik yalnızca `watched_episode` + `rated`

`started_show`/`completed_show` Trakt'ta gerçek bir olay değil — bkz. yukarıda "Activity Tipleri". Kullanıcıyla konuşulup ayrı bir adıma (Phase 1.1) ertelendi.

### Kurulan Altyapı (Genel)
- `@supabase/supabase-js` + `react-native-url-polyfill` (RN'de `URL` API'si eksik, polyfill şart)
- `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_KAYMAK_WORKER_URL`
- `features/feed/services/supabaseClient.ts` — anon key, Supabase Auth session persistence KAPALI
- `features/feed/services/feedSync.ts` + `features/feed/hooks/useFeedSyncTrigger.ts` — `app/(protected)/_layout.tsx`'e bağlı, app açılışında bir kez, sessizce senkronizasyonu tetikler
- `features/feed/services/feedApi.ts` — Trakt following listesi + Supabase `feed_activities` okuması
- `services/api/social.ts` — Trakt'ın kendi sosyal API'si: `getUserProfile`, `getMyFollowingSlugs`, `followTraktUser`, `unfollowTraktUser` (hepsi client'ın kendi token'ıyla, doğrudan — Worker'a hiç gerek yok)
- `features/feed/utils/extractTraktUsername.ts` — kullanıcı adı ya da yapıştırılan Trakt profil linkinden (`trakt.tv/users/{slug}`, `app.trakt.tv/profile/{slug}`) regex ile kullanıcı adı çıkarma (clipboard izni yok)
- `features/feed/hooks/useUserSearch.ts` + `components/UserSearchBar.tsx` + `components/UserProfileCard.tsx` — Feed ekranındaki arama çubuğu + profil kartı + takip et/bırak butonu (pending/following ayrımı dahil)
- `kaymaktv-feedback-worker/src/index.js` — path-bazlı routing (`/` = feedback, değişmedi; `/feed/sync` = yeni), yalnızca sync için kullanılıyor — follow/unfollow artık Worker'a hiç uğramıyor
- Klasör yapısı: `features/feed/{types.ts, components/, hooks/, services/, utils/}` — ortak `components/`/`hooks/`/`services/` klasörlerinden izole
- Tab sırası (mobil + web sidebar): Diziler → Filmler → **Akış** → Keşfet → Profil

## ✅ Uçtan Uca Doğrulama Tamamlandı

Kullanıcı ve arkadaşı gerçek Trakt hesaplarıyla test etti: takip etme (`POST /users/{id}/follow`), senkronizasyon (`/feed/sync`) ve `feed_activities`'e yazma hepsi canlıda doğrulandı. Süreçte ciddi bir bug bulunup düzeltildi — detay için `docs/HISTORY.md` Madde 89.

## 🗺️ Yol Haritası (Kullanıcı ile 2026-07-25'te belirlendi)

Uçtan uca çalışan sistemi gerçek kullanıcılarla test ederken iki gerçek soru ortaya çıktı: depolama büyümesi ve gizlilik. Aşağıdaki tablo önceliklendirilmiş plan:

| # | Ne | Öncelik | Durum |
|---|-----|---------|-------|
| 1 | **Gizlilik (Trakt-kaynaklı):** Worker, Trakt'ta `private:true` olan hesapların aktivitesini `feed_activities`'e hiç yazmasın | 🔴 Kritik | ✅ Tamamlandı |
| 1b | **Gizlilik (KaymakTV-özel, ince taneli):** Ayarlar ekranında Trakt'tan bağımsız üç anahtar — "her şeyi gizle" + tür bazında "izlediklerimi paylaş" / "puanlarımı paylaş" | 🔴 Kritik | ✅ Tamamlandı |
| 1c | **Geri alma (retraction):** Trakt'ta geri alınan (un-watch/un-rate) bir aktivite bizde de kalksın | 🔴 Kritik | ✅ Tamamlandı |
| 2 | Sertay'ın (test kullanıcısı) uygulamayı bug düzeltmesinden sonra yeniden açıp senkronize olması + karşılıklı takip durumunun (public/private onay) doğrulanması | 🔴 Kritik | ⏳ Kullanıcı test ediyor |
| 3 | **Saklama politikası:** `feed_activities`'te belirli bir süreden (öneri: 90 gün) eski satırları periyodik silen bir iş. Feed zaten son 30 günü, Profil son 20 kaydı gösteriyor — daha eskisinin ürün değeri yok, yalnızca disk kaplıyor. Şu anki ölçekte acil değil (büyüme, kullanım hızıyla orantılı — tekrar senkronla çoğalmıyor, bkz. Madde 89 düzeltmesi) | 🟡 Planlı | ⏳ Yapılmadı |
| 4 | Feed pagination / "daha fazla yükle" (şu an sabit 30 kayıt limiti) | 🟡 Planlı | ⏳ Yapılmadı |
| 5 | Aktivite kartlarında gerçek poster görseli (şu an `show_poster_url` hep `null`, placeholder film ikonu gösteriliyor) | 🟢 Kozmetik | ⏳ Yapılmadı |
| 6 | Phase 1.1 — `started_show`/`completed_show` (Trakt'ta gerçek bir olay değil, progress API + çıkarsama gerektiriyor) | 🟢 Ertelendi | ⏳ Yapılmadı |
| 7 | Bildirimler (yeni push/token altyapısı + tetikleme mekanizması gerektiriyor — Trakt'ın webhook'u yok) | 🟢 Ertelendi | ⏳ Yapılmadı |

### ✅ Madde 1 — Gizlilik (Trakt-kaynaklı)

`kaymaktv-feedback-worker/src/index.js`: `verifyAndUpsertUser` artık `isPrivate` de döndürüyor (Trakt'ın `/users/settings` yanıtındaki `private` alanından, zaten `users.is_private`'a yazılıyordu ama hiç okunmuyordu). `handleFeedSync`, `isPrivate === true` ise Trakt'tan izleme geçmişi/puanları hiç çekmiyor, o kullanıcıya ait var olan `feed_activities` satırlarını siliyor.

### ✅ Madde 1b — Gizlilik (KaymakTV-özel, ince taneli)

Kullanıcı Trakt'ta public olsa bile, yalnızca KaymakTV akışında görünmek istemeyebilir — hatta bazı türleri (ör. "pembe dizi") paylaşıp bazılarını paylaşmak istemeyebilir. Üç ayrı, bağımsız anahtar:
- `feed_hidden` — her şeyi gizle (diğer ikisinin ÜSTÜNDE, ikisi açık olsa bile geçersiz kılar)
- `publish_watches` — yalnızca izleme aktivitesi
- `publish_ratings` — yalnızca puanlama aktivitesi

`supabase/schema/006_add_feed_hidden.sql` + `007_add_publish_toggles.sql`: `users.feed_hidden`, `publish_watches`, `publish_ratings` (ikincisi ve üçüncüsü `DEFAULT TRUE` — varsayılan davranış hep "paylaş", kullanıcı bilinçli olarak kapatır). Tek bir genelleştirilmiş `POST /feed/privacy` uç noktası (`{traktAccessToken, patch: {feedHidden?, publishWatches?, publishRatings?}}`) — yalnızca gönderilen alanları günceller, kimliği doğrular, ilgili tür(ler)i KAPATTIYSA var olan kayıtları hemen siler (bir sonraki app açılışını beklemeden). `handleFeedSync` artık her iki bayrağı da okuyup buna göre Trakt'tan çekip çekmeyeceğine karar veriyor — kapalıysa gereksiz API çağrısı bile yapmıyor.

Client: `features/feed/services/feedPrivacy.ts` + `features/feed/hooks/useFeedPrivacy.ts` (üç ayarı da tek hook'ta, her biri bağımsız iyimser güncelleme + başarısızsa geri alma), Ayarlar ekranında "💬 Akış" bölümünde 3 `SettingsSwitchRow` (`components/settings/SettingsSwitchRow.tsx` — yeni, projede toggle'lı bir ayar satırı deseni yoktu). "Her şeyi gizle" açıkken diğer iki anahtar UI'da devre dışı/soluk gösterilir (mantıksal olarak geçersiz kaldıkları için).

### ✅ Madde 1c — Geri Alma (Retraction) Senkronizasyonu

Eskiden sync yalnızca EKLEME yapıyordu — Trakt'ta bir izleme/puanı geri alınca bizde sonsuza kadar kalıyordu. Artık `handleFeedSync`:
- **Puanlar:** Trakt her seferinde TÜM güncel puanları döndürdüğü için (limitsiz) tam karşılaştırma güvenli — bizde olup Trakt'ın güncel listesinde olmayan puan silinir.
- **İzlenen bölümler:** Trakt'tan yalnızca son 50 kayıt çekildiği için (limit var) tam karşılaştırma GÜVENLİ DEĞİL — limit dışı kalan eski gerçek geçmişi yanlışlıkla silerdi. Bunun yerine yalnızca o senkronda ÇEKİLEN pencerenin zaman aralığındaki mevcut kayıtlar karşılaştırılıp o pencere içinde kalıp artık gelmeyenler silinir; pencere dışına hiç dokunulmaz. Fetch boş dönerse (örn. geçici API hatası) hiç silme yapılmaz.

## ⏭️ Sıradaki Adım

Sonraki oturumda: Madde 3 (saklama politikası) veya Madde 4 (pagination) — hangisi önce, kullanıcıyla konuşulacak. Ayrıca Madde 2'nin (sertay testi) sonucu bekleniyor.

## ⚠️ Kullanıcının Yapması Gerekenler (Bu Oturum Sonu)

1. **`supabase/schema/006_add_feed_hidden.sql`'i SQL Editor'de çalıştır**
2. **Worker'ı deploy et:**
   ```bash
   cd "C:\Yapay_Zeka_Uygulamalar\kaymaktv-feedback-worker"
   npx wrangler deploy
   ```
3. Ayarlar → "💬 Akış" → "Aktivitemi Akışta Gizle" anahtarının göründüğünü ve açılıp kapandığını doğrula
4. Sertay uyanınca: uygulamayı yeniden açması + karşılıklı takip/senkron durumunun kontrolü

---

## 🚀 Teknoloji Stack

- **Frontend:** React Native + Expo Router
- **Backend:** Supabase (PostgreSQL, yalnızca `users` aynası + `feed_activities` önbelleği)
- **Sosyal Grafik:** Trakt.tv (kendi Follow/Following/Friends API'si)
- **Senkronizasyon:** Cloudflare Worker (`kaymaktv-feedback-worker`)

---

## 📝 Notlar & Devam Edilecek

- **Trakt API Rate Limiting:** Feed açılışında following listesi tek bir çağrı — ölçek sorunu değil. Sync (watch history + ratings) app açılışında bir kez, mevcut circuit-breaker/backoff altyapısıyla korunuyor.
- **Notification:** Phase 2
- **Kullanıcı profiline tıklayıp geçmiş görme:** Phase 1.5

---

## 📚 İlgili Dosyalar

- `features/feed/services/feedSync.ts` + `hooks/useFeedSyncTrigger.ts` — Senkronizasyon tetikleyici
- `features/feed/services/feedApi.ts` — Trakt following + Supabase feed sorgusu
- `features/feed/hooks/useFeed.ts` — Feed ekranı için veri hook'u
- `services/api/social.ts` — Trakt'ın kendi Follow/Following/Profile API'si
- `features/feed/hooks/useUserSearch.ts` — Arama + takip et/bırak state yönetimi
- `features/feed/utils/extractTraktUsername.ts` — Kullanıcı adı/URL ayrıştırma
- `app/(protected)/(tabs)/feed.tsx` — Ana feed ekranı (arama çubuğu dahil)
- `features/feed/components/FeedCard.tsx` — Aktivite kartı
- `features/feed/components/FeedSkeleton.tsx` — Yükleniyor state'i
- `features/feed/components/UserSearchBar.tsx` + `UserProfileCard.tsx` — Arama UI'ı
- `kaymaktv-feedback-worker/src/index.js` (`C:\Yapay_Zeka_Uygulamalar\kaymaktv-feedback-worker`) — `/feed/sync` uç noktası
- `supabase/schema/*.sql` — Veritabanı migration'ları
- `docs/HISTORY.md` — Tamamlanan her adımın kaydı

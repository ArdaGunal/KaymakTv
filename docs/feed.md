# KaymakTV Feed (Akış) Sistemi — Tasarım & Yol Haritası

**Son Güncelleme:** 2026-08-15
**Durum:** ✅ **Özellik tamamlandı ve canlıda.** Gerçek zamanlı sosyal akış (anında yayın + Realtime), sonsuz kaydırma, sosyal katman (alıntı/yorum/beğeni/engelleme), bağımsız gönderiler, aktivite silme ve ince taneli gizlilik hepsi çalışıyor. Kalan işler bilinçli olarak ertelenmiş durumda (bkz. aşağıdaki Yol Haritası).

> **Bu doküman ne İÇİN var:** Akış'ın MİMARİ KARARLARINI ve gerekçelerini saklar
> ("neden Trakt'ın follow API'si?", "neden bileşik imleç?", "neden tombstone?").
> Kronolojik değişiklik kaydı `docs/HISTORY.md`'de (Madde 89-163), sosyal katmanın
> ayrıntılı tasarım gerekçesi `docs/FEED_SOCIAL_PLAN.md`'de.

### ✅ Aktivite Kartlarına 3-Nokta Menü: Düzenle / Sil / Paylaş (Madde 161)
Silme özelliği hep vardı ama kapalıydı: Worker (`handleFeedDelete`) çoktan hard delete + tombstone (`deleted_feed_activities`) yapıyordu, yalnızca `ProfileActivityTab.tsx`'teki `ACTIVITY_DELETE_ENABLED = false` bayrağı UI'ı gizliyordu. Eski kaydırarak-sil/checkbox/toplu-silme arayüzü (`ActivityDeleteRow.tsx`) tamamen kaldırılıp yerine her kartın (Akış + Profil, yalnızca kendi kartların) sağ üstünde bir "⋯" menüsü kondu — `components/tracking/TrackingCardMenu.tsx`'in konumlandırma deseninden türetilen yeni `CardMenu.tsx`. Üç eylem: **Düzenle** (var olan alıntı/not düzenleyiciyi açar), **Sil** (onaydan sonra gerçek Worker silmesi — DB'den de kalkar, "boşa saklama" yok), **Paylaş** (yeni `kaymaktv.com/activity/{id}` kalıcı sayfası — `/show`/`/movie`/`/episode` ile aynı paylaşım deseni). Maraton kartlarında yalnızca Sil var (tek bir notu/linki olmayan sentetik gruplama). Detay: `docs/HISTORY.md` Madde 161.

### ✅ Akış ↔ Profil Aktiviteleri Denetimi + "Alıntı Yap" Butonu Sadeleşti (Madde 158-160)
İki ayrı istekti: (1) "Alıntı Yap" pili beğeni/yorum ikonlarıyla aynı satıra, aynı sade görsel dile taşındı — üç iterasyon sonunda son hâli: metinsiz, vurgu renksiz, `Repeat` ikonu (Twitter'ın "retweet"ine yakın ama köşeleri yuvarlak), beğeni/yorumla birebir aynı gri. (2) Kullanıcı Akış'ı uzun süredir güncellerken Profil › Aktiviteler'in geride kaldığından şüphelenip iki tarafın denetlenmesini istedi. Sonuç: not/alıntı/yorum/beğeni/"Fikir Paylaş" zaten `FeedCard.tsx` üzerinden paylaşıldığı için otomatik senkron; sonsuz kaydırma/Realtime bilinçli olarak yalnızca Akış'ta (Madde 148). Ama üç GERÇEK boşluk bulundu ve düzeltildi: hem kendi profilin (Madde 159) hem başkasının profili (Madde 160, önce arka plana flag'lenip sonra aynı oturumda kapatıldı) gerçek bir ağ hatasında da sessizce "Henüz aktivite yok" gösteriyordu (Akış'ın Madde 142'de çözdüğü sorunun aynısı, Profil ekranlarına hiç taşınmamıştı) — üçü de artık Akış'la aynı hata/"Tekrar Dene" deseninde. Ayrıca bir bölüm/puanı geri almak (`retractLocalActivity`) yalnızca Akış önbelleğini geçersiz kılıyordu, kendi profilinkini değil — düzeltildi. Detay: `docs/HISTORY.md` Madde 158-160.

### ✅ Bağımsız Gönderi — "Fikir Paylaş" (Madde 157)
Akışta artık izleme/puanlama olayına bağlı olmayan, tamamen bağımsız gönderiler var — kullanıcı istediği an, istediği (opsiyonel) bir dizi/film hakkında ya da hiç yapım seçmeden serbest metin paylaşabiliyor. Yeni tablo AÇILMADI: `feed_activities`'e altıncı bir `activity_type` (`'posted'`) eklendi (`017_feed_posts.sql`), böylece sayfalama/Realtime/beğeni/yorum/retention hepsi bedavaya çalıştı. Giriş noktası Akış'ın en üstündeki sabit "Ne düşünüyorsun?" kutusu (FAB değil — kullanıcı kararı: "teknik bir parça gibi görünüp görmezden gelinebilir"). Yapım seçimi tamamen opsiyonel, var olan arama altyapısı (`searchTrakt`/`SearchBar`/`SearchTabs`) reuse edildi. `note` karakter sınırı 500'den 1000'e çıktı (yorumlar hâlâ 500). Detay: `docs/HISTORY.md` Madde 157.

### ✅ Maraton Tekilleştirme + "Alıntı Yap" Twitter Tasarımı (Madde 156)
Gerçek kullanıcı testinde bulunan bir bug: aynı bölüm iki kez işaretlenince maraton gruplaması bunu "2 farklı bölüm" sanıp yanlışlıkla rozet veriyordu. Çözüm: sayaç artık HER ZAMAN tekilleştirilmiş (Set benzeri) bölüm koduna göre hesaplanıyor, ham satır sayısına göre DEĞİL — eşik de 2'den 3'e çıktı (Hız Turu 3-4, Maratoncu 5-7, Sezon Fatihi 8+). Ayrıca "Alıntı Yap" görsel hiyerarşisi tersine çevrildi: kullanıcının yazdığı alıntı artık kartın BİRİNCİL içeriği (büyük/parlak/üstte), "X izledi" satırı küçük bir bağlam çipine indi (Twitter'ın Alıntı Tweet modeli). Detay: `docs/HISTORY.md` Madde 156.

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

---

## 📌 Özet

KaymakTV'nin **Akış (Feed)** sistemi — Trakt'ta takip ettiğin kişilerin (ve kendinin) izleme/puanlama aktivitelerini ve serbest gönderilerini gösteren, gerçek zamanlı bir sosyal akış.

---

## 🎯 Bugün Neler Var (hepsi canlıda)

**Aktivite tipleri** (`feed_activities.activity_type` — 6 tip):
- `watched_episode` — bölüm izledi
- `watched_movie` — film izledi
- `rated` — dizi/filme puan verdi
- `posted` — bağımsız gönderi ("Fikir Paylaş", yapım seçimi opsiyonel)
- `started_show` / `completed_show` — şemada tanımlı ama **hiç üretilmiyor** (Trakt'ta gerçek bir olay değil, çıkarsama gerektiriyor — bkz. aşağıda "Activity Tipleri")

**Yetenekler:**
- Anında yayın (PUSH) + Supabase Realtime ile canlı akış (INSERT/UPDATE/DELETE)
- Sonsuz kaydırma (bileşik keyset imleci), 30 günlük pencere, gece retention (kullanıcı başına 200)
- Sosyal katman: kişisel not/alıntı, yorum, beğeni, kullanıcı engelleme
- Aktivite silme (hard delete + tombstone) + kart başına "⋯" menüsü (Düzenle/Sil/Paylaş)
- Paylaşım için kalıcı bağlantı sayfası: `/activity/{id}`
- İnce taneli gizlilik: "izlediklerimi paylaş" / "puanlarımı paylaş" (+ türetilmiş "her şeyi gizle")

**Bilinçli olarak YOK:**
- Yanıt (nested comment), push bildirimi, tür bazlı gizlilik, maraton kartına not/yorum
- `started_show`/`completed_show` üretimi (aşağıda gerekçesi)

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
| `006` → `008` | `feed_hidden` eklendi (006/007), sonra TÜRETİLMİŞ duruma çevrilip sütun kaldırıldı (008 — bkz. yukarıdaki "Her Şeyi Gizle" notu) |
| `010_deleted_feed_activities.sql` | Tombstone tablosu — kullanıcının kalıcı sildiği aktivite, sonraki Trakt senkronunda SESSİZCE geri gelmesin diye |
| `013_realtime_feed.sql` | `media_type` + `tmdb_id` kolonları, `watched_movie` tipi, Realtime publication + `REPLICA IDENTITY FULL` |
| `014_feed_retention.sql` | `pg_cron` ile her gece kullanıcı başına en yeni 200 kayıt (tombstone'lar için 1000) |
| `015_feed_social.sql` | `note`/`note_spoiler`/`like_count`/`comment_count`, dormant `comments` tablosunun canlandırılması, beğeni tabloları + sayaç trigger'ları |
| `016_user_blocks.sql` | Kullanıcı engelleme tablosu |
| `017_feed_posts.sql` | `'posted'` tipi, `show_id`/`show_title`/`media_type` NULLABLE, `note` sınırı 500 → 1000 |

**Güncel `feed_activities` şeması (017 sonrası):**

```sql
CREATE TABLE feed_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'watched_episode', 'watched_movie', 'started_show', 'completed_show', 'rated', 'posted'
  )),
  -- ⚠️ NULLABLE (017): yalnızca 'posted' tipi yapımsız olabilir.
  show_id BIGINT,
  show_title TEXT,
  media_type TEXT,              -- 'show' | 'movie' (013) — doğru detay rotası için ŞART
  tmdb_id BIGINT,               -- poster (013); show_poster_url artık yazılmıyor
  show_poster_url TEXT,         -- tarihsel, hep NULL
  episode_number TEXT,          -- "S03E04" — yalnızca watched_episode
  rating SMALLINT CHECK (rating BETWEEN 1 AND 10),
  note TEXT,                    -- alıntı VEYA 'posted' gövdesi, ≤1000 (015+017)
  note_spoiler BOOLEAN,
  like_count INT DEFAULT 0,     -- trigger ile (015)
  comment_count INT DEFAULT 0,  -- trigger ile (015)
  activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Diğer tablolar: `users` (Trakt aynası), `comments` (yorumlar, `body` ≤500), `feed_activity_likes`, `feed_comment_likes`, `user_blocks`, `deleted_feed_activities`.

**RLS:** Tüm feed tablolarında yalnızca `SELECT` politikası var (herkese açık okuma). `INSERT`/`UPDATE`/`DELETE` için hiç politika yok — yazma yalnızca Worker'ın `service_role` anahtarıyla (RLS'i bypass ederek) yapılıyor, çünkü Supabase Auth kullanmadığımız için `auth.uid()` tabanlı satır sahipliği kontrolü çalışmıyor. **Sahiplik her zaman Worker'ın sorgusundaki `WHERE user_id = <doğrulanan çağıran>` koşuluyla zorlanır** (IDOR koruması — bkz. `handleFeedDelete`/`handleFeedNote`).

---

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

## 🗺️ Yol Haritası

Orijinal yol haritası (2026-07-25) **tamamlandı** — gizlilik (1/1b/1c), saklama politikası (3 → `014_feed_retention.sql`), pagination (4 → bileşik keyset imleci), gerçek posterler (5 → `tmdb_id`) hepsi canlıda. Ayrıntılar `docs/HISTORY.md` Madde 145-163'te.

**Kalan (bilinçli ertelenmiş):**

| # | Ne | Öncelik | Neden ertelendi |
|---|-----|---------|-----------------|
| 1 | `started_show` / `completed_show` üretimi | 🟢 Ertelendi | Trakt'ta gerçek bir olay değil — her dizi için ayrı `/shows/{id}/progress/watched` çağrısı (rate-limit riski) + önceki-senkronla-kıyaslama gerektiriyor. Şema tipi taşıyor ama hiç yazılmıyor. |
| 2 | Bildirimler (beğeni/yorum geldiğinde push) | 🟢 Ertelendi | Yeni push/token altyapısı + tetikleme mekanizması gerektiriyor. |
| 3 | Yanıt (nested comment) | 🟢 Ertelendi | Yorumlar tek seviyeli; iç içe yapı ayrı bir veri/UI tasarımı gerektirir. |
| 4 | Maraton kartına not/yorum/beğeni | 🟢 Ertelendi | Maraton sentetik bir gruplama — "hangi bölüme" yorum yapıldığı belirsiz olurdu (bkz. Madde 156). |

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

---

## 🔧 Yeni Bir Migration/Worker Değişikliği Yaptıysan

Akış'ın iki elle adımı var — kod tek başına yetmez:

1. **Migration:** yeni `supabase/schema/NNN_*.sql` dosyasını Supabase SQL Editor'de çalıştır.
2. **Worker deploy:**
   ```bash
   cd "C:\Yapay_Zeka_Uygulamalar\kaymaktv-feedback-worker" && npx wrangler deploy
   ```

Atlanırsa sistem SESSİZCE yanlış davranmaz, gürültülü şekilde başarısız olur (bkz. Madde 146 — tanınmayan yol artık 404 döner, client `published` alanı yoksa yayını başarısız sayar).

---

## 🚀 Teknoloji Stack

- **Frontend:** React Native + Expo Router
- **Backend:** Supabase (PostgreSQL — `users` aynası, `feed_activities`, `comments`, beğeni/engel tabloları)
- **Sosyal Grafik:** Trakt.tv (kendi Follow/Following/Friends API'si)
- **Yazma katmanı:** Cloudflare Worker (`kaymaktv-feedback-worker`) — tüm yazmalar buradan, `service_role` ile
- **Gerçek zamanlı:** Supabase Realtime (`postgres_changes`)

---

## 📝 Dikkat Edilecek Noktalar

- **Trakt API Rate Limiting:** Feed açılışında following listesi tek bir çağrı — ölçek sorunu değil. Sync (watch history + ratings) app açılışında bir kez, mevcut circuit-breaker/backoff altyapısıyla korunuyor.
- **Zaman damgası hizalaması bu mimarinin temel taşı:** client damgayı kendisi üretip Trakt'a `watched_at`/`rated_at` olarak AÇIKÇA gönderir ve AYNISINI akışa yayınlar. Bozulursa çift kayıt/sessiz silinme başlar (bkz. Madde 145).
- **Oturum izolasyonu:** hesap değiştirildiğinde `AuthContext.removeKeys()` TÜM modül seviyesi önbellekleri temizlemeli (feedStore, myTraktSlug, feedPublish kimliği, feedCache, visibleUserIds, myUserId, blockedIds). Yeni bir önbellek eklersen buraya da ekle — aksi halde önceki hesabın verisi yeni oturuma sızar.
- **Sahiplik kontrolü iki katmanlı:** UI (`isOwnActivity`) yalnızca kazara tıklamayı önler; GERÇEK koruma Worker'ın `WHERE user_id = <doğrulanan çağıran>` koşuludur. UI kontrolünü atlarsan güvenlik açığı olmaz ama "hayalet silme" UX hatası oluşur (bkz. Madde 163).

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
- `kaymaktv-feedback-worker/src/index.js` (`C:\Yapay_Zeka_Uygulamalar\kaymaktv-feedback-worker`) — `/feed/sync`, `/feed/publish`, `/feed/post`, sosyal katman (not/yorum/beğeni/engel) uç noktaları
- `supabase/schema/*.sql` — Veritabanı migration'ları (`015`-`017`: sosyal katman + engelleme + bağımsız gönderi)
- `features/feed/utils/groupMarathonActivities.ts` — Maraton gruplama (Set tabanlı bölüm tekilleştirme)
- `features/feed/components/FeedActivityNote.tsx` — Alıntı/gönderi metni (birincil içerik, "Devamını Gör")
- `features/feed/components/ComposePostBar.tsx` + `ComposePostModal.tsx` — "Fikir Paylaş" giriş noktası ve compose ekranı
- `features/feed/components/MediaPickerModal.tsx` + `MediaPickerRow.tsx` — Gönderi için opsiyonel yapım seçici
- `features/feed/components/FeedCommentSheet.tsx` + `BlockUserButton.tsx` + `BlockedProfileLock.tsx` — Sosyal katman UI'ı
- `features/feed/components/CardMenu.tsx` — Kartların "⋯" menüsü (Düzenle/Sil/Paylaş)
- `app/activity/[id].tsx` + `features/feed/hooks/useActivityDetail.ts` — Paylaşım linkinin hedefi, tek aktivite sayfası
- `features/feed/utils/resolveRawActivityIds.ts` — Silme için maraton→ham-id çözümü (Akış + Profil paylaşır)
- `docs/FEED_SOCIAL_PLAN.md` — Sosyal katmanın (not/yorum/beğeni/engel) detaylı tasarım kaydı
- `docs/HISTORY.md` — Tamamlanan her adımın kaydı

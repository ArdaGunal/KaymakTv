# KaymakTV — ANA PLAN (Program Haritası)

> **Bu dosya "hangi sırayla ve nasıl doğrulayarak" sorusunun cevabıdır.**
> Tek tek özelliklerin *neden öyle tasarlandığı* ayrı dokümanlarda:
> [`REVIEWS_PLAN.md`](REVIEWS_PLAN.md) (inceleme sistemi) ·
> [`feed.md`](feed.md) (akış) · [`FEED_SOCIAL_PLAN.md`](FEED_SOCIAL_PLAN.md) ·
> [`notifications.md`](notifications.md). Kronoloji: [`HISTORY.md`](HISTORY.md).
>
> **Oturumlar arası devir belgesidir.** Yeni oturumda: §0 → §1 → aktif fazın
> tanımı. Her faz bitiminde §0 tablosu + `HISTORY.md` güncellenir.

---

## 0. DURUM

> ✅ **COMMIT DURUMU ÇÖZÜLDÜ — 2026-08-17.** Kol A'nın tamamı (Madde 165-179,
> 46 dosya) tek commit'te kayıt altına alındı: **`93aa678`**. Geri dönüş
> noktası artık VAR. **Push YAPILMADI** — `origin` (GitHub) hâlâ `368b127`'de.
>
> Doğrulama komutları (dördü de şu an TEMİZ):
> ```bash
> npx tsc --noEmit --noUnusedLocals --noUnusedParameters -p .
> node --check "C:/Yapay_Zeka_Uygulamalar/kaymaktv-feedback-worker/src/index.js"
> node --check server.js
> cd ../kaymaktv-feedback-worker && npx vitest run   # 29/29
> ```

> ✅ **021 çalıştırıldı · Worker deploy edildi · F14 doğrulandı · T9 tekrar
> testi geçti (web) · 🔓 kilit kalktı.**
>
> 🟡 **AÇIK ELLE İŞ — F5 backfill zinciri, 1/3 adım bitti:**
>
> | Adım | Durum |
> |---|---|
> | 1. self-join UPDATE | ✅ **çalıştırıldı** — 57 → 51 (6 satır, öngörüldüğü gibi) |
> | 2. uygulamayı aç, senkron `rated`'i doldursun | ⬜ |
> | 3. self-join UPDATE **tekrar** | ⬜ — ~31 satır daha çözmeli |
>
> Kalan: `watched_episode` 43 · `rated` 8. (`watched_movie`, `posted`,
> `reviewed` → **0 eksik** ✅)
>
> **Sıra bozulmamalı:** adım 3, adım 2'den sonra gelmezse kopyalanacak kaynak
> tabloda olmaz.

> 🔴 **BEKLEYEN DEPLOY:** `rated` geri-alma koruması (Madde 185) Worker'da
> düzeltildi ama **deploy edilmedi**. Trakt puan uçları 429/5xx dönerse
> kullanıcının tüm puan kartları siliniyor ve o kartlara yapılmış
> beğeni/yorumlar CASCADE ile **kalıcı olarak** gidiyor. `npx wrangler deploy`.

> 📌 **SONRAKİ İŞ (kullanıcı kararı, 2026-08-17): F6 → F9.**
> F6 tasarımı bir alt ajana hazırlatıldı ve **ön tasarım çürütüldü** —
> yeni model: snapshot F6'da yalnızca YAZILIR, hiç okunmaz; RLS politikası
> verilmez; istemci dayanıklılığı YEREL kopyayla çözülür. Gerekçeler ve
> 7 adımlı plan bir sonraki turda `docs/FOLLOW_SNAPSHOT_PLAN.md`'ye yazılacak.
>
> ✅ **F6 Adım 0 KAPANDI — sayfalama riski YOK (canlıda ölçüldü, 2026-08-17).**
> `/users/{id}/following` `x-pagination-*` başlığı **döndürmüyor** ve tüm
> listeyi tek yanıtta veriyor. Kontrol testi: aynı yöntemle `/movies/popular`
> çağrıldığında başlıklar geliyor (`item-count=488, limit=100, page-count=5`),
> yani ölçüm yöntemi doğru. `getMyFollowingSlugs()` `limit` göndermediği için
> tam listeyi alıyor — sessiz kırpma yok.
>
> ⚠️ Tek kalan incelik: uç `?limit=N` parametresini **kabul ediyor**. Koda
> bir gün `limit` eklenirse liste sessizce kırpılır. `social.ts`'te
> `getMyFollowingSlugs` bilinçli olarak parametresiz çağırıyor — öyle kalmalı.


**Son güncelleme:** 2026-08-17 · **Aktif faz:** F4 (uçtan uca doğrulama + ilk build)
**F4 test protokolü:** [`F4_TEST_PROTOCOL.md`](F4_TEST_PROTOCOL.md) — cihazda adım adım uygulanacak

| Kilit | Durum |
|---|---|
| 🔓 **BUILD DAĞITMA** | **KALKTI — 2026-08-17.** F4'ün 13 adımı da geçti, bulunan 3 kusur düzeltildi ve düzeltmeler doğrulandı. Ayrıntı: `HISTORY.md` Madde 181-184. |

> **Kilit neden kalktı:** gerekçesi *"dağıtılan build'de temizlenemeyecek
> gerçek veri oluşur"* idi (§3, kritik nokta 3). İnceleme sistemi artık uçtan
> uca doğrulandı; oluşacak veri beklenen veri.
>
> ⚠️ **F5 backfill zinciri kilidi BLOKE ETMEZ** (önceki bir notta yanlışlıkla
> öyle yazılmıştı). O, mevcut satırların veri kalitesiyle ilgili — dağıtım
> güvenliğiyle değil. Yine de açık iş: bkz. F5 bölümü.

| Faz | Ad | Durum |
|---|---|---|
| — | v2 P1: Worker sadeleştirme + `020` + S5 | ✅ **kod + elle adımlar TAMAM** (canlıda doğrulandı) |
| — | v2 P2: istemci sadeleştirme + S12 + S17 | ✅ |
| **F1** | İnceleme UI: tek akış iki blok | ✅ **BİTTİ** |
| **F2** | Bölüm sayfası → yerel inceleme | ✅ **BİTTİ** |
| **K1** | 🧹 **Kalite denetimi #1** — ölü kod zinciri | ✅ **BİTTİ** — 4 dosya silindi, ~800 satır |
| **F3** | Doküman senkronizasyonu | ✅ **BİTTİ** |
| **G1** | 🔒 **Güvenlik denetimi #1** — yazma yüzeyi | ✅ **BİTTİ** |
| **F4** | Uçtan uca doğrulama + **ilk build** (kilit kalkar) | ✅ **BİTTİ** 🔓 — 13 adım geçti, 3 kusur bulundu ve düzeltildi |
| **F5** | `tmdb_id` tüm aktivite tiplerine | 🟡 **DEPLOY EDİLDİ** — backfill zinciri (3 adım) kaldı |
| **F6** | Takip listesi snapshot'ı | ⬜ **SIRADAKİ** |
| **K2** | 🧹 **Kalite denetimi #2** | ✅ **BİTTİ** — kimliğe bağlı 2 önbellek çıkışta temizlenmiyordu (bulundu+düzeltildi) |
| **F7** | ⚠️ Kimlik katmanı refactor | ⬜ |
| **F8** | ⚠️ **Google giriş + hesap birleştirme** | ⬜ |
| **G2** | 🔒 **Güvenlik denetimi #2** — yeni kimlik yüzeyi | ⬜ |
| **F9** | Moderasyon altyapı düzeltmesi (S15) | ⬜ |
| **F10** | Rapor sayacı + otomatik gizleme | ⬜ |
| **G3** | 🔒 **Güvenlik denetimi #3** — moderasyon kötüye kullanımı | ⬜ |
| **F11** | S11: kullanıcı sayımı / gizlilik ayarı sızıntısı | ⬜ |
| **F12** | S10: 400 satır kuralı borcu | ⬜ |
| **F13** | S16: `expo-image` yayılımı | ⬜ |

### ✅ Elle adımlar TAMAMLANDI (canlı doğrulandı — F2 turunda)
| Adım | Doğrulama |
|---|---|
| `020_reviews_local_only.sql` | `in_feed` kolonu sorgulanabiliyor → HTTP 200 |
| `npx wrangler deploy` | Kaldırılan `/feed/review/delete` → HTTP **404** (yeni sürüm canlıda) |

> 🔴 **SERT BAĞIMLILIK (kayıt için):** akış sorgusu artık `.eq('in_feed', true)`
> kullanıyor. `020` çalıştırılmamış bir ortamda bu filtre "kolon yok" hatası
> verir ve **AKIŞIN TAMAMI kırılır**. Prod'da 020 çalıştırıldı; başka bir
> ortama kurulum yapılırsa migration ÖNCE gelmeli.

---

## 1. Program Haritası — 4 iş kolu

```
A. İNCELEME SİSTEMİNİ BİTİR        F1 → F2 → K1 → F3 → G1 → F4 🔓
   (kilidi açan kol)                                          │
                                                              ▼
B. TRAKT'TAN BAĞIMSIZLIK           F5 → F6 → K2 → F7 → F8 → G2
   (stratejik kol)                                 ⚠️    ⚠️

C. MODERASYON / UGC                F9 → F10 → G3
   (App Store gerekliliği)         ⚠️ sıra kritik

D. TEKNİK BORÇ                     F11 · F12 · F13
   (paralel, fırsat buldukça)
```

**Kol A önce bitmeli** — build kilidi ona bağlı. B ve C paralel yürüyebilir.
D herhangi bir zamanda araya sıkıştırılabilir.

### Denetim fazları neden ayrı
Kalite (K) ve güvenlik (G) denetimleri **birer faz**, bir alışkanlık değil.
Gerekçe: bu projede her özellik turu arkasında ölü kod zinciri bırakıyor
(v1→v2 pivotu bunun kanıtı) ve yazma yüzeyi her turda değişiyor. Denetimi
"sonra bakarız"a bırakmak, `useMyMediaComment` örneğindeki gibi bir turda
çözülen şeyin sonraki turda çöpe dönmesi demek.

---

## 2. Faz Tanımları

### KOL A — İnceleme sistemini bitir

#### F1 · İnceleme UI: tek akış iki blok
**Amaç:** Dizi/film sayfasında kullanıcı **tek kesintisiz liste** görsün; üstte
etkileşimli KaymakTV incelemeleri, altta salt-okunur Trakt yorumları.

**Kapsam**
- `MediaReviewsSection` → tek akış, iki blok (K1'de `MediaCommentsSection` olarak yeniden adlandırıldı)
- `ReviewItem`'a `variant="trakt"` — buton YOK, soluk palet, `Trakt` rozeti
- **Slug tekilleştirme (S7):** `users.trakt_slug` ↔ `comment.user.ids.slug`
- `CommentSortBar` ayracın altına — yalnızca Trakt bloğunu yönetir
- **`SectionErrorBoundary` (S13)** — render istisnasında tüm ekran değil sadece
  o blok düşsün
- `isLoadingComments` bağlanması (S12'de eklendi, henüz UI'da kullanılmıyor)

**Çıkış kriteri:** Trakt bloğu kapalıyken sayfa tam çalışıyor · aynı kullanıcı
listede bir kez görünüyor · `tsc` + ölü kod taraması temiz.

**Risk:** `CommentSortBar` taşınırken mevcut Trakt sıralaması bozulabilir —
sıralama durumu Trakt bloğunun yerel state'ine taşınmalı, ekran seviyesinde değil.

---

#### F2 · Bölüm sayfası → yerel inceleme
**Amaç:** `app/episode/[id].tsx` de Trakt'a yazmayı bıraksın.

**Kapsam**
- `MediaCommentsSection`'a `episodeNumber` desteği (Worker ZATEN kabul ediyor)
- `useMediaReviews` + `feedReviews.PublishableReview` plumbing'i
- Ekran `WriteCommentSheet`/`MyInlineComment` yerine yeni akışa geçer

**Çıkış kriteri:** Bölüm incelemesi yazılıyor, bölüm sayfasında görünüyor,
**ana akışta GÖRÜNMÜYOR** (`in_feed` kolonu — canlı doğrula).

> ⚠️ **F2 bitmeden K1 BAŞLAYAMAZ** — `WriteCommentSheet`/`MyInlineComment`/
> `useMyMediaComment` hâlâ bu ekranda kullanılıyor.

**Fırsat:** dosya 551 satır (400 kuralı ihlali) — bu turda bölünebilir.

---

#### K1 · 🧹 Kalite Denetimi #1 — ölü kod zinciri
**Amaç:** Pivotun arkasında bıraktığı çöpü temizlemek.

**Silinecekler** (otopsi `REVIEWS_PLAN.md` §6'da yapıldı)
| Hedef | Not |
|---|---|
| `components/WriteCommentSheet.tsx` (~370) | F2'den sonra tüketicisiz |
| `components/MyInlineComment.tsx` (227) | Aynı |
| `hooks/useMyMediaComment.ts` (~115) | İki tüketicisi de öldü |
| `services/api/comments.ts` yazma yarısı | `addComment`/`updateComment`/`deleteComment`/`addCommentReply`/`getUserComments` + önbelleği |
| `CommentReplies.tsx` yazma kısmı | Okuma KALIR (Karar 9) |
| `commentValidation.ts` | `MIN_COMMENT_WORDS`, `REVIEW_WORD_THRESHOLD`, muhtemelen `MAX_COMMENT_CHARS` |

**Ek tarama:** §4.1 kontrol listesinin tamamı.

**Ayrıca:** "SONRADAN BULUNANLAR" bölümündeki **Y1-Y4** maddeleri (dosyanın en
altı) — hepsi K1'e atandı.

**Çıkış kriteri:** `--noUnusedLocals --noUnusedParameters` SIFIR · silinen her
şey için otopsi kaydı (`AI_RULES` §2.5) · kopan import yok.

---

#### F3 · Doküman senkronizasyonu
`feed.md` (2️⃣.5 bölümü artık YANLIŞ — "Worker Trakt'a yazıyor" diyor) ·
`FEED_SOCIAL_PLAN.md` §7 notu · `REVIEWS_PLAN.md` → tasarım kaydına ·
`ARCHITECTURE.md` · `HISTORY.md` maddesi.

---

#### G1 · 🔒 Güvenlik Denetimi #1 — yazma yüzeyi son hali
§4.2 kontrol listesinin tamamı. **Bu turun özel odağı:**
- Worker'da Trakt yazma yüzeyinin GERÇEKTEN kapalı olduğu (`traktFetch` GET-only)
- `020` sonrası `in_feed` GENERATED kolonuna yazma denemesinin reddedildiği
- Yeni `episodeNumber` girdisinin PostgREST'e güvenli gittiği

---

#### F4 · Uçtan uca doğrulama + ilk build 🔓
**Gerçek cihazda, gerçek Trakt oturumuyla** hiç test edilmemiş akış:
inceleme yaz → akışa düş → yanıt yaz → beğen → düzenle → sil.

**Kontrol edilecek:** `wrangler tail` ile Worker logları · Realtime yankısının
çift kart üretmediği (R6) · gizlilik anahtarı `watched_movie`'yi de temizliyor (S5)
· bölüm incelemesinin akışa düşmediği.

**Çıkış kriteri:** hepsi geçtiyse **🔓 build kilidi kalkar.**

---

### KOL B — Trakt'tan bağımsızlık

#### F5 · `tmdb_id` tüm aktivite tiplerine

> 🔴 **BU FAZIN KAPSAMI 2026-08-17'DE DÜZELTİLDİ.** Yukarıdaki eski tanım
> ("Worker `normalizePublishActivity` + `handleFeedSync` tmdb_id yazsın")
> **BAYATTI — o iş zaten yapılmıştı.** Faz uygulanırken kod okunarak
> doğrulandı; plana güvenip körlemesine yazılsaydı var olan mantık
> tekrarlanacaktı.

**Zaten çalışan (doğrulandı, kod okundu):**

| Yol | Kanıt |
|---|---|
| Anlık yayın — Worker | `normalizePublishActivity` `raw.tmdbId` okuyup `tmdb_id` yazıyor (`index.js:970-977`) |
| Anlık yayın — istemci (5 çağrı noktası) | `ratings.ts:86` · `progress.ts:148,399,469` (`meta.tmdbId`) · `progress.ts:558` (`movie.ids.tmdb`) |
| Meta kaynağı | `resolveMediaMeta` `tmdbId` döndürüyor (`services/library/mediaMeta.ts:36`) |
| Tam senkron | `handleFeedSync` DÖRT map'in hepsinde `tmdb_id` yazıyor (`index.js:660,677,715,731`) |

**Gerçek boşluk (ve bu fazda yapılan iş):** kolon eklenmeden ÖNCE yazılmış
satırlarda `tmdb_id` NULL ve **hiçbir yol onlara dokunmuyordu** — INSERT'ler
yalnızca "bizde olmayan" satırlar için, `ratedToUpdate` ise yalnızca
puan/tarih değişince çalışıyordu (`index.js:805`). Yani eski satırlar
kendiliğinden ASLA dolmayacaktı.

**Uygulanan çözüm:** senkron, o turda Trakt'tan **zaten çekilmiş** veriyi
kullanarak eksikleri tamamlıyor — ek Trakt isteği yok. Eşleştirme yeni bir
mantık icat etmiyor, sync/publish'in paylaştığı dedup anahtarlarını
(`watchedKey`/`ratedKeyOf`) kullanıyor. Yalnızca `tmdb_id IS NULL` satırlara
dokunuluyor; `activity_at` patch'e **girmiyor** (eski kartı akışın tepesine
fırlatmamak için).

Ayrıca `fetchExistingActivities`'in select listesine `tmdb_id` eklendi —
onsuz hangi satırın eksik olduğu bilinemez, her satır gereksiz PATCH alırdı.

**⚠️ KABUL EDİLEN SINIR (gizlenmiyor):** `watched_*` için Trakt yalnızca
**son 50 kaydı** döndürüyor → o pencerenin dışındaki eski izleme satırları bu
yolla dolmaz ve zamanla da dolmaz. `rated` için sınır yok (Trakt tüm güncel
puanları veriyor) → orada doldurma TAM. Pencere dışı eski `watched_*`
satırları için gerçek bir çözüm gerekirse ayrı bir toplu backfill işi
gerekir — bugün buna değip değmeyeceği **ölçülmedi** (aşağıdaki sorgu).

### 📊 CANLI ÖLÇÜM (2026-08-17) — 57 eksik satır, yalnızca 12 dizi

| Tip | Eksik | Toplam |
|---|---|---|
| `watched_episode` | 47 | 511 |
| `rated` | 10 | 124 |
| `watched_movie` | **0** | 200 |
| `posted` | 0 | 1 |

Eksikler 6 dizide yoğunlaşıyor (`watched_episode`): Brooklyn Nine-Nine 13 ·
The Prince 12 · Frieren 10 · Criminal Record 6 · Silo 4 · The Blacklist 2.
`rated` tarafı 10 ayrı dizide birer satır. **Birleşik benzersiz yapım: 12.**

✅ Tutarlılık doğrulandı: aynı `(show_id, media_type)` için iki farklı
`tmdb_id` yazılmış satır **yok** → aşağıdaki kopyalama güvenli.

### 🔗 ÇÖZÜM ZİNCİRİ — sıra önemli, ek Trakt isteği YOK

`rated` listesindeki diziler `watched_episode` listesiyle **örtüşüyor**
(48587, 207180, 46676, 180770). Bu yüzden adımlar doğru sırada uygulanırsa
sorun büyük ölçüde kendiliğinden kapanıyor:

| # | Adım | Çözülen | Kalan |
|---|---|---|---|
| 1 | Self-join `UPDATE` (aşağıda) — Silo'nun id'si `reviewed` satırından biliniyor | 6 | 51 |
| 2 | **F5 deploy + senkron** — Trakt tüm puanları döndürdüğü için `rated` tarafı TAM dolar | 10 | 41 |
| 3 | Self-join `UPDATE` **TEKRAR** — artık 4 dizinin id'si tabloda | **31** | **10** |

Geriye **Frieren (10)** ve **Criminal Record (6)** kalır — ikisi de hiç
puanlanmamış, dolayısıyla hiçbir satırlarında `tmdb_id` yok. Kullanıcı Trakt'ta
bu dizilere puan verdiği gün adım 2+3 onları da kapatır. Zorlamaya gerek yok.

> ⚠️ Adım 3'ün adım 2'den SONRA gelmesi şart — sırası bozulursa kopyalanacak
> kaynak henüz tabloda olmaz ve 31 satır çözülmeden kalır.

**Self-join backfill (adım 1 ve 3'te aynısı):**
```sql
update feed_activities t set tmdb_id = s.tmdb_id
from (select distinct on (show_id, media_type) show_id, media_type, tmdb_id
      from feed_activities where tmdb_id is not null) s
where t.tmdb_id is null and t.show_id = s.show_id and t.media_type = s.media_type;
```
`activity_at`'e dokunmaz. `in_feed` yeniden hesaplanır ama değeri değişmez.
**Uygulama kapalıyken çalıştır** — `feed_activities` Realtime yayınında.

**Ölçüm sorguları (tekrar çalıştırmak için):**
```sql
-- kalan eksik, tip bazında
select activity_type, count(*) filter (where tmdb_id is null) as eksik,
       count(*) as toplam
from feed_activities group by activity_type order by eksik desc;

-- kalan eksik, yapım bazında (show_title dolu — elle çözüm gerekirse)
select activity_type, show_id, media_type, show_title, count(*) as satir
from feed_activities where tmdb_id is null group by 1,2,3,4 order by satir desc;

-- güvenlik: aynı yapıma iki farklı tmdb_id var mı (BOŞ dönmeli)
select show_id, media_type, count(distinct tmdb_id)
from feed_activities where tmdb_id is not null
group by 1,2 having count(distinct tmdb_id) > 1;
```

> **Çürütülen varsayım (kayıt için):** "eksik satırların dizisi başka bir
> satırda doludur, self-join hepsini çözer" sanılmıştı. Ölçüm bunu çürüttü —
> tek başına yalnızca **6/57** çözüyor, çünkü bir dizinin `tmdb_id`'si hiç
> yazılmamışsa o dizinin TÜM satırları eksik ve kopyalanacak kaynak yok.
> Zincir bu yüzden F5 deploy'unu araya almak zorunda.

**Durum:** kod + `node --check` + 29/29 Worker testi temiz. **Deploy
edilmedi** (F4 izolasyonu — bkz. §0). Deploy sonrası `wrangler tail`'de
`tmdbBackfilled` sayacı izlenir; sıfıra inmesi işin bittiğini gösterir.

---

#### F6 · Takip listesi snapshot'ı
`getVisibleUserIds` bugün `/users/me/following`'e bağlı → Trakt giderse **akış
tamamen boşalır.** Periyodik bir kopya (Supabase'de) en azından salt-okuma bir
akışın yaşamasını sağlar.

> ⚠️ Bu, `004_drop_user_follows.sql` ile kaldırılan takip sisteminin GERİ
> GELMESİ DEĞİL. Amaç farklı: yazma sistemi değil, **senkron kopyası**.

---

#### K2 · 🧹 Kalite Denetimi #2
§4.1 kontrol listesi + F5/F6'nın bıraktığı kalıntılar.

---

#### F7 · ⚠️ Kimlik katmanı refactor — KRİTİK
Detay: `REVIEWS_PLAN.md` §9. Özet:
1. `users.trakt_slug` → **NULLABLE** (UNIQUE kalır)
2. `auth_provider` + **`google_sub` UNIQUE**
3. Worker `verifyAndUpsertUser` → **`resolveCaller(request)`**
4. İstemcide kimlik kaynağı `getMyTraktSlug()` değil `users.id`

**Neden kritik:** 13 uç noktanın TAMAMI bu fonksiyondan geçiyor. Yanlış yapılırsa
tüm yazma yolları aynı anda kırılır. **Bu faz TEK BAŞINA yapılmalı**, başka bir
işle birleştirilmemeli.

**Azaltıcı:** 13 ucun *gövdesi* değişmiyor (hepsi dönen `userId`'yi kullanıyor) —
değişen yalnızca kimliğin nasıl çözüldüğü. Refactor'ü bu sınırda tut.

---

#### F8 · ⚠️ Google giriş + hesap birleştirme — EN KRİTİK
Detay: `REVIEWS_PLAN.md` §9.3.

**Geri dönüşü en pahalı faz.** Birleştirme köprüsü OLMADAN Google girişi
açılırsa, mevcut kullanıcılar ikinci bir boş hesap açar ve içerikleri bölünür
(Spotify/Facebook vakası).

**Değişmez kurallar**
1. Tek `users` satırı = tek kimlik; `trakt_slug`/`google_sub` iki **bağlantı**
   kolonu. Birleştirme = **bağlantıyı taşımak**, içeriği taşımak DEĞİL.
2. **ASLA yalnızca e-postaya bakıp otomatik birleştirme** — Trakt e-postası
   bizce doğrulanmamış, hesap ele geçirme riski.
3. Köprü **İLK GİRİŞTE** gösterilir, kullanıcı içerik üretmeden önce.
4. Yine de iki satır oluşursa: birleştirme tek işlemde, **unique çakışmalarında
   hangisi kazanır** önceden kararlaştırılmış olmalı (öneri: daha yeni).

**Çıkış kriteri:** Trakt'la kaydolmuş bir test hesabı, Google'a geçtiğinde
içeriğini KAYBETMİYOR.

---

#### G2 · 🔒 Güvenlik Denetimi #2 — yeni kimlik yüzeyi
**Programın en kritik güvenlik noktası.** §4.2 + özel maddeler:
- Google token doğrulaması sunucuda mı yapılıyor (`aud`/`iss`/imza kontrolü)?
- `google_sub` gerçekten UNIQUE mi — aynı Google hesabı iki satıra bağlanabiliyor mu?
- Birleştirme akışı bir hesabı **başkasının** hesabına bağlayabiliyor mu?
- Kimlik sağlayıcı değişince IDOR korumaları (`WHERE user_id = ...`) hâlâ geçerli mi?

---

### KOL C — Moderasyon / UGC

#### F9 · ⚠️ Moderasyon altyapı düzeltmesi (S15) — SIRA KRİTİK
`content_reports`'ta **`UNIQUE(reporter_user_id, target_type, target_id)` YOK**
ve `reporter_user_id` nullable.

> **F10'dan ÖNCE yapılmazsa: tek kişi aynı içeriği 5 kez raporlayıp istediği
> yorumu sansürleyebilir.** Otomatik gizlemeyi bu düzeltme olmadan açmak,
> doğrudan bir kötüye kullanım aracı yaratmaktır.

**Kapsam:** UNIQUE kısıtı · `reporter_user_id` zorunlu · rapor yazımının
Worker'dan geçmesi (bugün istemci doğrudan yazıyor — projedeki tek yazma
politikalı tablo).

---

#### F10 · Rapor sayacı + otomatik gizleme
N rapor alan içerik akıştan düşer. Sayaç `feed_activities`/`comments` üzerinde
trigger ile (015'teki `like_count` deseni) veya Worker kontrolüyle.
**Eşik kararı** ve **itiraz yolu** (yanlış gizlenen içerik ne olacak) bu fazda
kararlaştırılır.

**App Store notu:** UGC moderasyonu olmayan uygulamalar reddedilir. Rapor
**arayüzü zaten var** (7 bileşene bağlı) — bu faz onu işlevsel hale getiriyor.

---

#### G3 · 🔒 Güvenlik Denetimi #3 — moderasyon kötüye kullanımı
Tek kullanıcı bir içeriği gizletebiliyor mu · rapor spam'i rate limit'e takılıyor
mu · gizlenen içerik gerçekten okunamıyor mu (yoksa yalnızca UI'da mı saklı).

---

### KOL D — Teknik borç

| Faz | İş | Not |
|---|---|---|
| **F11** | **S11:** `users` anon key ile tamamen okunabiliyor; `is_private`/`publish_watches` dahil. Postgres RLS kolon seviyesinde çalışmadığı için çözüm ayrı `user_settings` tablosu (önerilen) veya kısıtlı VIEW. | `001`'den beri var |
| **F12** | **S10:** 400 satır kuralı — **13 dosya** (K2'de yeniden sayıldı). En büyükler: `services/api/users.ts` (**897**), `download.web.tsx` (814), `index.web.tsx` (695), `library/fetchers.ts` (662), `MediaHero.tsx` (571), `ReportIssueModal.tsx` (542), `user/[slug].web.tsx` (523), **`features/feed/services/feedApi.ts` (522)**, `FeedCard.tsx` (505), `progress.ts` (498), `episode/[id].tsx` (470), `profile.web.tsx` (455), `account.tsx` (415). | `users.ts` öncelikli. ⚠️ `feedApi.ts` ve `account.tsx` F14/Y8 turlarında 400'ü AŞTI — bölünmeleri artık bu fazın kapsamında |
| **F14** | **Elle yazılan içerik için akış görünürlüğü** — `publish_manual` (021). Tasarım: [`FEED_VISIBILITY_PLAN.md`](FEED_VISIBILITY_PLAN.md). F4 sırasında kullanıcı buldu: "Aktivitemi Akışta Gizle" incelemeleri kapsamıyordu. | ✅ **BİTTİ** — 021 çalıştırıldı, deploy edildi, cihazda doğrulandı |
| **F13** | **S16:** `expo-image` yalnızca 4 dosyada, `cachePolicy="disk"` 2 yerde; 12 dosya hâlâ RN `Image`. TMDB'ye giden tekrar isteklerini azaltır. | Yeni altyapı gerekmiyor |

---

## 3. ⚠️ Kritik Noktalar (ayrı ele alınacaklar)

Bu dördü, yanlış yapılırsa **geri dönüşü pahalı** olan noktalar. Her biri kendi
fazında tek başına ele alınmalı, başka işle birleştirilmemeli.

| # | Kritik nokta | Faz | Neden geri dönüşü zor |
|---|---|---|---|
| 1 | **Hesap birleştirme** | F8 | Kullanıcı ikinci hesapta içerik üretmeye başladıktan sonra "iki içerik kümesini birleştirme" problemine dönüşür |
| 2 | **Otomatik gizleme sırası** | F9→F10 | Yanlış sırada açılırsa canlı bir sansür aracı olur |
| 3 | **İlk build dağıtımı** | F4 | Dağıtıldıktan sonra kullanıcıda oluşan veri temizlenemez; şu anki "0 satır" temiz sayfası kaybolur |
| 4 | **Kimlik refactor** | F7 | 13 yazma ucunun tamamı aynı fonksiyondan geçiyor — hata hepsini birden kırar |

---

## 4. Denetim Kontrol Listeleri

### 4.1 🧹 Kalite denetimi (K fazları)

```bash
# 1) Ölü kod — GREP DEĞİL, tip sistemi (AI_RULES §2.5)
npx tsc --noEmit --noUnusedLocals --noUnusedParameters -p .

# 2) Worker sözdizimi + rota bütünlüğü
node --check "C:/Yapay_Zeka_Uygulamalar/kaymaktv-feedback-worker/src/index.js"

# 3) 400 satır kuralı
find app components features hooks services store utils context screens \
  -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | awk '$1>400'

# 4) Migration numara çakışması
ls supabase/schema/ | sed 's/_.*//' | uniq -d

# 5) Çeviri anahtarı senkronu (tr ↔ en)
node -e "const fs=require('fs');for(const f of fs.readdirSync('locales/tr')){const a=Object.keys(JSON.parse(fs.readFileSync('locales/tr/'+f)));const b=Object.keys(JSON.parse(fs.readFileSync('locales/en/'+f)));const x=a.filter(k=>!b.includes(k)),y=b.filter(k=>!a.includes(k));if(x.length||y.length)console.log(f,'tr-only:',x,'en-only:',y)}"

# 6) Sessiz başarısızlık (boş catch) — AI_RULES §2 ihlali adayları
grep -rnE "catch\s*(\([^)]*\))?\s*\{\s*\}" --include="*.ts" --include="*.tsx" app components features hooks services

# 7) Bayat worktree (denetim taramalarında yanlış pozitif kaynağı)
git worktree list

# 8) Debug kalıntısı
grep -rn "console\.log" --include="*.ts" --include="*.tsx" app components features hooks services store | wc -l
```

**Bilinen yanlış alarmlar (her denetimde tekrar çıkacak, bunlar HATA DEĞİL):**
- `locales/*/feed.json` → `newPosts` (tr) vs `newPosts_one`/`newPosts_other` (en).
  **i18next çoğul biçimleri** — Türkçe tek biçim kullanır, İngilizce iki. Doğru davranış.
- `services/tmdbApi.ts` + `services/library/fetchers.ts`'teki 4 boş `catch` —
  önbellek ayrıştırma yolları; hata = "önbellek yok" demek, sessizlik kasıtlı.
  *(Yine de her denetimde tekrar bak: yeni bir boş catch eklendi mi?)*

**Ayrıca her K fazında elle bakılacaklar:**
- Aynı mantığın iki kopyası var mı? (bu projede tekrar eden hata sınıfı)
- Yeni eklenen modül seviyesi önbellek `AuthContext.removeKeys()`'e eklendi mi?
- Silinen her şey için otopsi yapıldı mı (taşındı / değiştirildi / **kazara koptu**)?

### 4.2 🔒 Güvenlik denetimi (G fazları)

> ⚠️ **G1'de iki KONTROL HATASI bulundu ve düzeltildi.** Aşağıdaki yöntemler
> ilk hâlleriyle yanlış sonuç veriyordu — bir "açık" yanlış alarmı, bir de
> gerçek bir kör nokta. Ayrıntı: `HISTORY.md` Madde 179.

**1) Anon key ile YAZMA reddediliyor mu?**
```
INSERT  → HTTP 401 + kod 42501 beklenir (politika ihlali)
UPDATE  → ⚠️ HTTP 204 BEKLENİR VE BU NORMALDİR
DELETE  → ⚠️ HTTP 204 BEKLENİR VE BU NORMALDİR
```
> 🔴 **Sadece HTTP koduna BAKMA.** RLS'te UPDATE/DELETE için politika yoksa
> satırlar o işleme *görünmez* olur → PostgREST "0 satır etkilendi" anlamında
> **204 döner**, yani "izin verildi" gibi görünür. Doğru test:
> `Prefer: return=representation` ekleyip **etkilenen satır sayısını** ölç.
> `[]` (0 satır) = RLS çalışıyor. Dolu dizi = **gerçek açık**.
> Ek doğrulama: işlemden sonra satırı tekrar okuyup değişmediğini teyit et.

**2) PostgREST enjeksiyon yüzeyi**
```bash
grep -oE 'rest/v1/[^`"]*\$\{[a-zA-Z0-9_.]+\}[^`"]*' \
  "C:/Yapay_Zeka_Uygulamalar/kaymaktv-feedback-worker/src/index.js"
```
> 🔴 **Bu grep ÇOK SATIRLI URL kurulumlarını KAÇIRIR.** `+` ile birleştirilen
> şablonlar (ör. `fetchExistingReview`) taramaya hiç girmiyor. Bu yüzden grep
> tek başına yeterli DEĞİL — her yeni Supabase sorgusu **elle** de kontrol
> edilmeli. Her interpolasyon için sor: doğrulanıyor mu?
> (`UUID_RE` / `Number.isFinite` / beyaz liste / `encodeURIComponent`)

**3) CANLI enjeksiyon testi (en güvenilir yöntem)**
Worker'ın girdi doğrulaması **token doğrulamasından ÖNCE** çalışıyor — yani
sahte bir token'la, hiçbir şey yazmadan gerçek saldırı girdileri denenebilir.
Beklenen: hepsi `400`, geçerli girdi ise `401`'e (token) ilerler.
Denenecekler: `showId` içine PostgREST/SQL enjeksiyonu · beyaz liste dışı
`mediaType` · biçim dışı ve enjeksiyonlu `episodeNumber` · tutarsız kombinasyon
(film + bölüm) · eksik `tmdbId` · sınır aşan/çok kısa metin.

**4) İstemciye sızan sırlar**
```bash
grep -rhoE "EXPO_PUBLIC_[A-Z_]+" --include="*.ts" --include="*.tsx" --include="*.js" \
  app components features services utils store server.js | sort -u
```
> Her biri GERÇEKTEN public olmalı (client id, anon key, URL). **Sunucu
> tarafındaki `||` fallback'lerine de bak** — `process.env.X || process.env.EXPO_PUBLIC_X`
> deseni bir sızıntı değil ama sızıntıyı DAVET eder (G1'de TMDB'de bulundu).

**5) `.env` / `dist` git dışı mı?**
```bash
git check-ignore -v .env dist
```

**Her G fazında elle bakılacaklar:**
- **IDOR:** her yeni yazma ucu `WHERE user_id = <doğrulanan çağıran>` taşıyor mu?
- **Rate limit:** yeni uç noktanın bucket'ı var mı? Üçüncü taraf kotası
  harcıyorsa daha sıkı mı?
- **RLS:** yeni tablo eklendiyse yazma politikası bilinçli mi verildi/verilmedi?
- **Yeni kolon mahrem mi?** `users_select_all USING(true)` yüzünden `users`
  tablosundaki HER yeni kolon **herkese açık** olur (bkz. S11).
- **GENERATED kolonlar:** Worker onlara yazmaya çalışmamalı (Postgres reddeder).

### ✅ G1'de kapatıldı — TMDB anahtar fallback'i
`server.js:33` → `process.env.TMDB_API_KEY || process.env.EXPO_PUBLIC_TMDB_API_KEY`

Fallback **kaldırıldı**; anahtar artık yalnızca öneksiz `TMDB_API_KEY` ile
okunuyor. Aktif bir sızıntı hiç olmamıştı (üç kontrolle doğrulanmıştı) ama
`EXPO_PUBLIC_` öneki Expo'da "bundle'a göm" demek olduğu için, o adla yapılacak
ilk yanlış tanımda sessizce sızardı. Trakt'ta aynı fallback Madde 25'te
kaldırılmıştı; TMDB'de gözden kaçmıştı.

---

## 5. Sıra Bağımlılıkları (ihlal edilemez)

```
020 migration ──→ wrangler deploy        (Worker 5000 sınırıyla gidiyor)
F2            ──→ K1                     (bölüm sayfası taşınmadan silinemez)
F1..G1        ──→ F4 🔓                  (kilit ancak doğrulama sonrası kalkar)
F7            ──→ F8                     (kimlik katmanı olmadan Google giriş yok)
F8            ──→ G2                     (denetlenecek yüzey önce var olmalı)
F9            ──→ F10                    (⚠️ SANSÜR VEKTÖRÜ)
```

---

## 6. Açık Madde Takibi

Tam liste ve gerekçeler: [`REVIEWS_PLAN.md`](REVIEWS_PLAN.md) → "AÇIK MADDELER".

| Kapanan | Faz |
|---|---|
| S1, S3, S4, S5 | v2 P1 |
| S2, S6, S12, S17 | v2 P2 |

| Açık | Faz |
|---|---|
| S7 (aynı kişi iki kez), S13 (Error Boundary) | F1 |
| S8 (sınır tutarsızlığı — kalan yarısı) | F2 |
| S9 (Google yazamıyor), S14 (hesap birleştirme) | F7, F8 |
| S15 (rapor UNIQUE yok) | F9 |
| S11 (kullanıcı sayımı) | F11 |
| S10 (400 satır) | F12 |
| S16 (görsel önbellek) | F13 |

---

# 📥 SONRADAN BULUNANLAR (işlenmeyi bekleyen)

> **Bu bölümün amacı:** Bir fazı uygularken karşılaşılan ama **o fazın kapsamı
> dışında** kalan bulgular burada birikir ki unutulmasın. Odak dağılmasın diye
> anında düzeltilmezler; ilgili faza atanır ve kapandığında **buradan silinip**
> `HISTORY.md`'ye geçer.
>
> **Kural:** Buraya bir şey yazarken (a) nerede bulunduğu, (b) neden şimdi
> düzeltilmediği, (c) hangi faza ait olduğu MUTLAKA yazılır. Yoksa bir süre
> sonra "bu neydi?" listesine döner.

## ✅ Kapananlar (K1)
**Y1** (`onPublished` gereksiz tam tazeleme) · **Y2** (`MediaReviewsSection`
400 satır aşımı) · **Y3** (bileşen adı içeriğini anlatmıyor) — üçü de K1'de
kapatıldı, ayrıntı `HISTORY.md` Madde 177.

## Y4 · Trakt yorumları iki farklı görsel dille çiziliyor
**Nerede:** `components/reviews/TraktCommentRow.tsx` (sayfa içi önizleme) ile
`components/comments/CommentItem.tsx` ("Tümünü Gör" sheet'i)

Kullanıcı sayfada soluk paletli, `TRAKT` rozetli, butonsuz satırlar görüyor;
"Tümünü Gör"e basınca aynı yorumlar **farklı** bir tasarımla açılıyor.
İşlevsel hata değil, görsel tutarsızlık.

**Neden K1'de yapılmadı:** K1 bir **ölü kod** turuydu; bu ise saf bir tasarım
kararı ve "hangi tasarım kazanacak" sorusunun cevabı yok. `CommentItem`'a
dokunmak `CommentSheet` + `CommentReplies`'ı da kapsar, yani K1'i UI yeniden
tasarımına genişletirdi.
**Faz:** ayrı bir UI turu.

## Y9 · Yorum yolunda görünürlük hiç kontrol edilmiyor
**Nerede:** `features/feed/services/feedSocial.ts` (`fetchComments`, yalnızca
`activity_id` ile okuyor) · Worker `index.js` `fetchActivityForComment`
(yorum yazma yetkisi kontrolü — `in_feed`/görünürlük bakmıyor)
**Bulundu:** 021 turunda, bağımsız tarama (2026-08-17).

Bir aktivite akıştan gizli olsa bile (bölüm incelemesi, yazarın gizlediği
içerik) `activity_id`'sini bilen biri yorumlarını okuyabiliyor ve Worker
üzerinden yeni yorum yazabiliyor. Kart görünmüyor ama altındaki konuşma
erişilebilir.

**Neden 021'de yapılmadı:** 021'in kapsamı akış kartlarının görünürlüğüydü.
Yorum yolu ayrı bir yüzey (`comments` tablosu + ayrı Worker ucu) ve
"gizli içeriğe yorum yazılabilmeli mi" ayrı bir ürün sorusu — ör. kendi gizli
gönderindeki mevcut konuşmayı okuyabilmen makul olabilir.
**Faz:** G2 veya F9/F10 (moderasyon turu) — yazma yüzeyi zaten orada denetleniyor.

## ✅ Kapananlar (K2 turu)
**Y8** (profil aktivitelerinde engel filtresi yok) — kapatıldı. Not: ilk
raporda "engellediğin kişinin aktivitelerini görebiliyorsun" denmişti,
**yanlıştı** — profil ekranları `isBlockedEitherWay` ile `<BlockedProfileLock />`
gösteriyor, görsel sızıntı yoktu. Gerçek kusur korumanın TEK katmanının UI
olması ve sorgunun yine de gitmesiydi. Ayrıntı: `HISTORY.md` Madde 183.

## Y7 · Trakt 429'u kullanıcıya "token geçersiz" diye gösteriliyor
**Nerede:** Worker `verifyAndUpsertUser` (`index.js:474-484`) → 13 yazma ucunun
tamamının döndüğü `"Trakt token geçersiz veya süresi dolmuş."` mesajı.
**Bulundu:** F4 sırasında canlıda (2026-08-17).

Kullanıcı kısa sürede çok sayıda senkron tetikledi, Trakt kendi rate limit'ini
uyguladı (429), `verifyAndUpsertUser` null döndü ve kullanıcı **"token geçersiz"**
mesajı gördü. Token'ın hiçbir sorunu yoktu — birkaç dakika sonra sorunsuz çalıştı.

**Neden ciddi:** yanlış teşhis kullanıcıyı yanlış eyleme yönlendiriyor. "Token
geçersiz" gören kullanıcı çıkış yapıp yeniden giriş dener, hatta hesabında sorun
olduğunu sanır — oysa yapması gereken tek şey beklemek.

Kod bu ayrımı **zaten biliyor**: `console.error` Trakt'ın durum kodunu logluyor
ve oradaki yorum "ikisi de client'a aynı mesajı gösteriyor" diye açıkça
uyarıyor. Yani eksik olan teşhis değil, o teşhisin kullanıcıya taşınması.

**Öneri:** `verifyAndUpsertUser` null yerine `{ ok: false, reason: 'rate_limit' |
'invalid_token' | 'trakt_down' }` döndürsün; uçlar buna göre mesaj seçsin.
**Neden F4'te yapılmadı:** 13 uç noktanın TAMAMI bu fonksiyonun dönüş tipine
bağlı — F4 bir doğrulama fazı, imza değiştirecek bir refactor değil.
**Faz:** F7 (kimlik katmanı refactor) — `resolveCaller(request)` zaten bu
fonksiyonun yerini alacak, dönüş tipi orada tasarlanmalı.

## Y6 · "Tümünü Gör" kendi incelemelerimizi GÖSTERMİYOR
**Nerede:** `app/{show,movie,episode}/[id].tsx` → `onSeeAllTrakt={() => setCommentSheetVisible(true)}`
**Bulundu:** F4-T13 sırasında, kullanıcı tarafından (2026-08-17).

Kullanıcı sayfada **tek kesintisiz liste** görüyor (F1'in amacı buydu): üstte
KaymakTV incelemeleri, altında ayraç, sonra Trakt yorumları. "Tümünü Gör"e
basınca açılan sheet ise **yalnızca Trakt yorumlarını** içeriyor — kendi
incelemesi ortadan kayboluyor.

**Bu bir hata değil, tasarımın görünen yüzüyle çelişmesi.** Buton teknik
olarak `TraktCommentsBlock`'a ait ve Trakt'ın kendi sayfalamalı sheet'ini
(`useComments` + `CommentSheet`) açıyor — doğru çalışıyor. Ama kullanıcı iki
ayrı blok olduğunu GÖRMÜYOR (F1 bilinçli olarak ayrımı yumuşattı), dolayısıyla
"tümü"nün bir kısmının eksilmesini bir kayıp gibi algılıyor.

**Y4 ile aynı kök:** iki veri kümesi tek listede birleştirildi ama "Tümünü
Gör" yolu hâlâ yalnızca Trakt'ı biliyor. İkisi **birlikte** ele alınmalı.

**Seçenekler (karar verilmedi):**
1. Butonu Trakt bloğunun içine görsel olarak bağla ("Trakt'ta tümünü gör")
   — en ucuzu, dürüst ama listenin birleşikliğini zayıflatır
2. Sheet'e bizim incelemelerimizi de ekle — sayfalama iki kaynaklı olur
   (`useComments`'ın imleci Trakt'a özel; REVIEWS_PLAN §4'teki merge-sort
   maliyeti burada geri gelir)
3. Bizim incelemeler zaten sayfada tamamı görünüyorsa buton yalnızca Trakt
   içindir — bunu etiketle açıkça söyle

**Neden F4'te düzeltilmedi:** F4 bir **doğrulama** fazı, UI tasarım turu değil.
Ayrıca hangi seçeneğin doğru olduğu bir ürün kararı ve `CommentSheet` +
`CommentReplies`'a dokunmayı gerektiriyor.
**Faz:** Y4 ile aynı UI turu.

## Y5 · `refreshData` üç hook'ta tüketilmiyor
**Nerede:** `useShowDetail` · `useMovieDetail` · `useEpisodeDetail`
**Bulundu:** K1'de, Y1 kapatılırken.

Y1 ile `onPublished` kalkınca `refreshData`'nın son tüketicisi gitti. Ekranların
destructuring'inden **kaldırıldı** (orası gerçekten ölüydü) ama **hook'larda
bırakıldı.**

**Neden tamamen silinmedi:** silmek üç seviyeli bir zincire dönüşüyordu →
`refreshData` → `invalidateShowDetailCache`/`invalidateMovieDetailCache` →
`services/library/mutations/invalidation.ts`. Bu, çalışan bir önbellek
geçersizleştirme katmanını, yerine bir şey koymadan budamak olurdu. Ayrıca
hiçbir ekranda pull-to-refresh YOK (doğrulandı) — eklendiği gün doğrudan bu
fonksiyona bağlanacak.
**Faz:** pull-to-refresh eklenirse kendiliğinden kapanır; eklenmezse ayrı bir
budama turunda yeniden değerlendirilir.

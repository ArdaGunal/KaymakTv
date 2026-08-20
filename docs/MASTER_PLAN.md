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

**Son güncelleme:** 2026-08-20 · **Aktif faz:** F7 kod bitti — elle adım 1-2 bekliyor
**Push YAPILMADI** — `origin/main` hâlâ `368b127`'de.
Yereldeki fark: `git log --oneline origin/main..HEAD`.

> Buraya son commit hash'i ve commit SAYISI yazılmıyor: ikisi de her faz
> sonunda bayatlıyor (hash iki oturum üst üste yanlış bilgi verdi, sayı ise
> yazıldığı commit'te bile hatalı oluyor). Tek doğru kaynak `git log`.

### 🔴 BEKLEYEN ELLE ADIMLAR — sıra önemli

| # | İş | Not |
|---|---|---|
| 1 | **`025_integrity_fixes.sql` çalıştır** | B1 (`uq_feed_rated`+`media_type`) · B4 (retention `rated` muafiyeti) · B3 (`is_visible`). Ön kontrol içeriyor, çakışma bulursa kendini durdurur |
| 2 | **İstemciyi yeniden yükle** | ⚠️ **1'den SONRA.** `fetchMediaReviews` `.eq('is_visible', true)` kullanıyor; migration olmadan yapım sayfası inceleme listesi kırılır |
| 1b | **`026_identity_layer.sql` çalıştır** (F7) | `trakt_slug` NULLABLE · `auth_provider` · `google_sub` UNIQUE · **`google_sub` anon'dan GRANT ile gizlenir**. Ön kontrol içeriyor. Sonundaki 4 doğrulama sorgusunu çalıştır — özellikle **anon `google_sub` görememeli AMA `id,username` görebilmeli** (ikincisini atlamak "her şeyi kilitledim" hatasını gizler) |
| 2b | **Worker deploy** (F7) | `npx wrangler deploy`. ⚠️ **`026`'dan SONRA.** Sıra ters olursa yeni Worker `google_sub` kolonuna yazmaya çalışmaz (F7'de henüz yazmıyor) ama `026`'nın GRANT'ı olmadan istemci `auth_provider` kolonunu okuyamaz. Deploy sonrası **bir kez giriş yapıp bir yorum/beğeni** dene — 14 kimlik noktasının tamamı aynı fonksiyondan geçiyor |
| 3 | ~~Cloudflare rate limiting kuralı~~ | **ATLANDI (kullanıcı kararı).** Domain Worker altyapısı üzerinden sunulduğu için zone seviyesi WAF paneli açılmadı. Kod seviyesindeki `express-rate-limit` (Madde 192'de canlıda ölçüldü) birincil koruma olarak kabul edildi — ikinci hat yok ama tek hat çalışıyor |
| 4 | **Pi'de `node server.js`'i yeniden başlat** | `.env`'e `NODE_ENV=production` eklendi ama **canlıda henüz etkili değil** — `dotenv` bunu yalnızca süreç başlarken okur, dosya değişikliği çalışan sürece işlemez. Canlıda ölçüldü (2026-08-18): `Origin: http://localhost:9999` hâlâ `access-control-allow-origin` alıyor. Pratik risk düşük (CORS bir tarayıcı korumasıdır) ama madem hedef kapatmaksa restart şart |
| 5 | *(ops.)* F5 backfill 2-3. adım | `watched_episode` 43 · `rated` 8 eksik `tmdb_id`. Uygulamayı aç → self-join UPDATE'i tekrar çalıştır (F5 bölümü) |

### ✅ Tamamlananlar (ayrıntı `HISTORY.md`)
Kol A (F1-F4) · F5 · F6 · F9 · F10 · F14 · K1 · K2 · G1 · Y7(kısmi) · Y8 ·
🔓 build kilidi kalktı (Madde 184) · sistem denetimi + K1 açığı kapatıldı (Madde 190).

### Doğrulama komutları
```bash
npx tsc --noEmit --noUnusedLocals --noUnusedParameters -p .
node --check "C:/Yapay_Zeka_Uygulamalar/kaymaktv-feedback-worker/src/index.js"
node --check server.js
cd ../kaymaktv-feedback-worker && npx vitest run   # 34/34
```

> ⚠️ **`kaymaktv-feedback-worker` bir git reposu DEĞİL.** Worker kodunun tek
> kopyası diskte; F5/F6/F9/Y7 değişikliklerinin geri dönüş noktası yok.

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
| **F5** | `tmdb_id` tüm aktivite tiplerine | 🟡 **DEPLOY EDİLDİ** — backfill zinciri 1/3 adım (51 satır kaldı, kilitleyici değil) |
| **F6** | Takip listesi snapshot'ı — [`FOLLOW_SNAPSHOT_PLAN.md`](FOLLOW_SNAPSHOT_PLAN.md) | ✅ **BİTTİ** — `022` + Worker canlıda doğrulandı, istemci sertleştirme cihazda sorunsuz |
| **K2** | 🧹 **Kalite denetimi #2** | ✅ **BİTTİ** — kimliğe bağlı 2 önbellek çıkışta temizlenmiyordu |
| **F14** | Elle yazılan içerik için akış görünürlüğü — [`FEED_VISIBILITY_PLAN.md`](FEED_VISIBILITY_PLAN.md) | ✅ **BİTTİ** — `021`, cihazda doğrulandı |
| **F9** | Moderasyon altyapı düzeltmesi (S15) | ✅ **BİTTİ** — `023` + `/feed/report`, canlıda doğrulandı (`yeni` → `TEKRAR`) |
| **F10** | Rapor sayacı + otomatik gizleme — [`MODERATION.md`](MODERATION.md) | ✅ **BİTTİ** — `024` canlıda. Eşik **3 kişi**, itiraz = raporu `dismissed` yapmak |
| **D0** | 🔍 **Sistem denetimi** (4 alt ajan) | ✅ **BİTTİ** — K1 açığı bulundu+kapatıldı, `025` yazıldı, Y12-Y21 kaydedildi |
| **F15** | 🩹 **Denetim düzeltmeleri — kullanıcıya dokunanlar** | 🟡 **Cihazda test edildi (Madde 194), Y22 bulunup kapandı (Madde 195).** Y16·Y18 doğrulandı. Y21 hâlâ **doğrulanmadı** (test doğal akış sonuna denk geldi). Y22'nin kod düzeltmesi mantık testinden geçti, **cihazda henüz denenmedi** |
| **F16** | 🔒 Açık proxy güvenliği (Y12) | ✅ **BİTTİ** — `server/security.js` Pi'ye deploy edildi ve **canlıda doğrulandı**: `ACAO: *` gitti, liste dışı Trakt uçları 403, `redirect_uri` guard'ı çalışıyor. Cloudflare kuralı (elle adım 3) ikinci hat olarak açık |
| **F17** | 🧹 Kopya birleştirme + bayat doküman (Y19) | ✅ **BİTTİ** — `confirmAsync` + `formatRelativeTime` tek kopyaya indirildi, `utils/confirmDialog.ts` başlığı düzeltildi, Android promise askıda kalma kusuru kapandı |
| **F7** | ⚠️ Kimlik katmanı refactor | 🟢 **KOD BİTTİ** (Madde 196) — `026` + `resolveCaller` + istemci kimliği. `tsc` ✅ · Worker 34/34 ✅ · GRANT kolon listesi canlıdan doğrulandı ✅. **Elle adım 1b + 2b bekliyor** |
| **F8** | ⚠️ **Google giriş + hesap birleştirme** | ⬜ — F7'nin elle adımları tamamlanınca. Karar: **Worker kendi doğrular** (Google JWKS ile imza+`aud`+`iss`+`exp`), Supabase Auth kullanılmayacak |
| **G2** | 🔒 **Güvenlik denetimi #2** — yeni kimlik yüzeyi | ⬜ |
| **G3** | 🔒 **Güvenlik denetimi #3** — moderasyon kötüye kullanımı | ⬜ — Y14 (RLS'siz gizleme) buraya |
| **F11** | S11 — **yeniden çerçevelendi** (Y15) | ⬜ — ayar yarısı kolon `GRANT`'ı ile, üye listesi yarısı F7'ye |
| **F12** | S10: 400 satır kuralı borcu | ⬜ — **16 dosyaya çıktı**, `users.ts` 963 |
| **F13** | S16: `expo-image` yayılımı | ⬜ |
| **F18** | Worker'ı git'e al | ⬜ — tek kopya diskte, geri dönüş noktası yok |

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

## 1. Program Haritası — 5 iş kolu

```
A. İNCELEME SİSTEMİNİ BİTİR        F1 ✅ F2 ✅ K1 ✅ F3 ✅ G1 ✅ F4 ✅🔓
   (kilidi açan kol)                        ── KOL TAMAMLANDI ──

B. TRAKT'TAN BAĞIMSIZLIK           F5 🟡  F6 ✅  K2 ✅ → F7 → F8 → G2
   (stratejik kol)                                       ⚠️    ⚠️

C. MODERASYON / UGC                F9 ✅ → F10 ✅ → G3
   (App Store gerekliliği)         ── altyapı TAMAM, G3 kaldı ──

D. TEKNİK BORÇ                     F11 · F12 · F13 · F18
   (paralel, fırsat buldukça)

E. DENETİM DÜZELTMELERİ            F15 ✅ F16 ✅ F17 ✅
   (2026-08-18 sistem denetimi)         ── KOL TAMAMLANDI ──
```

**Kol A bitti** — build kilidi kalktı. **Kol C'nin altyapısı bitti** (F9+F10).
**Kol E bitti** — 4 alt ajanlı sistem denetiminden (D0) çıkan F15/F16/F17'nin
üçü de kapandı. Kalan bulgular (Y13-Y15, Y9, Y11) `SONRADAN BULUNANLAR`
bölümünde kayıtlı, ayrı fazlara (G3, F11, Worker turu) dağıtıldı.

**Kol E kapandı** (F15 → F16 → F17, üçü de bitti). Sıradaki büyük iş **F7 → F8**
(Kol B, kimlik katmanı + Google giriş) — ama bu büyük, riskli ve tek başına
yapılması gereken bir iş; F15 açılırken bilinçli olarak ertelendi. F5 backfill
2-3. adımı (§0) ops. bir ara-iş olarak her an yapılabilir.

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

#### F7 · ⚠️ Kimlik katmanı refactor — 🟢 KOD BİTTİ, elle adımlar bekliyor
Detay: `REVIEWS_PLAN.md` §9 · uygulama: `HISTORY.md` Madde 196. Özet:
1. `users.trakt_slug` → **NULLABLE** (UNIQUE kalır) — `026`
2. `auth_provider` + **`google_sub` UNIQUE** — `026`
   ⚠️ **`auth_provider` UNIQUE DEĞİL.** Görev tanımında sehven öyle yazılmıştı;
   uygulansaydı sistemde toplam 2 kullanıcı olabilirdi.
3. Worker `verifyAndUpsertUser` → **`resolveCaller(body, env)`**
   ⚠️ `request` DEĞİL `body`: bir `Request` gövdesi iki kez okunamaz ve uçlar
   onu zaten okumuş oluyor. `request` geçirmek her uçta `clone()` gerektirirdi.
4. İstemcide kimlik kaynağı `getMyTraktSlug()` değil `users.id`
   ⚠️ `getMySupabaseUserId()` "zaten vardı" ama **içeride `getMyTraktSlug()`
   çağırıyordu** — yani Trakt'a bağımlıydı. Disk öncelikli hâle getirildi.

**Neden kritik:** yazma uçlarının TAMAMI bu fonksiyondan geçiyor. Yanlış
yapılırsa tüm yazma yolları aynı anda kırılır. **Bu faz TEK BAŞINA yapılmalı**,
başka bir işle birleştirilmemeli.

**Azaltıcı:** uçların *gövdesi* değişmiyor (hepsi dönen `userId`'yi kullanıyor) —
değişen yalnızca kimliğin nasıl çözüldüğü. Refactor'ü bu sınırda tut.

> 🔢 **"13 uç" SAYISI YANLIŞTI** (F7 sırasında ölçüldü, HISTORY Madde 196).
> `grep -c "verifyAndUpsertUser(token, env)"` **13** döndürüyordu ama bunun
> **1'i fonksiyonun kendi tanımıydı**. Gerçek dağılım:
> **12 uç** `resolveCaller` + **2 uç** `resolveCallerWithReason` = **14
> kimlik doğrulama noktası**. Sayı bu belgede, `REVIEWS_PLAN`'da ve
> `HISTORY`'nin beş maddesinde "13" olarak yayılmıştı.

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

**Mimari kararı (2026-08-20, kullanıcı):** Google ID token'ını **Worker kendi
doğrular** — Google JWKS ile imza + `aud` (kendi Client ID'miz) + `iss` + `exp`.
Supabase Auth KULLANILMAYACAK (paneldeki provider açık ama devrede değil);
gerekçe: `auth.users` + `public.users` iki tablo arası senkron, F8'in en riskli
kısmı olan birleştirmeyi karmaşıklaştırırdı. `resolveCallerWithReason`'da dal
yeri hazır.

> 🔴 **DOĞRULAMA F8'DE YAZILIR, G2'DE YALNIZCA DENETLENİR.** İmza/`aud`/`iss`
> doğrulaması olmadan Google girişi açılırsa herkes sahte token'la başkası
> olabilir. "G2'de test ederiz" yeterli değil — test etmek ≠ yazmak.

**F7'de bulunan ve F8'i doğrudan etkileyen üç nokta:**
1. 🔴 **`on_conflict=trakt_slug` Google dalında KULLANILAMAZ.** `026` ile
   `trakt_slug` nullable oldu ve Postgres'te NULL'lar çakışma üretmez — Google
   kullanıcısı o upsert'ten geçerse **her girişte yeni satır** oluşur, yani
   F8'in önlemeye çalıştığı bölünmenin ta kendisi. Google dalı `google_sub`
   üzerinden upsert etmeli. (Uyarı Worker'da `verifyTraktCaller` başlığına da
   yazıldı.)
2. 🟠 **Google kullanıcısının akışı BOŞ olur.** `getVisibleUserIds` Trakt
   following listesine dayanıyor (`REVIEWS_PLAN` §9.2 madde 5). Kırılma değil
   ama ölü bir ilk deneyim — F8 kapsamına mı, ayrı faza mı alınacağı
   kararlaştırılmalı.
3. 🟢 **İstemci tarafı hazır:** `setMySupabaseUserId()` yazıldı ve Google giriş
   akışının `users.id`'yi doğrudan yazması için bekliyor; `getMySupabaseUserId`
   artık Trakt'a düşmeden diskten okuyor.

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
| **F11** | **S11 — YENİDEN ÇERÇEVELENDİ (Y15).** Eski not *"RLS kolon seviyesinde çalışmadığı için çözüm ayrı `user_settings` tablosu"* diyordu — **eksik bir önerme**: RLS satır seviyesindedir ama **kolon seviyesinde `GRANT` vardır ve PostgREST ona uyar.** Yeni plan: (a) ayar yarısını tek `GRANT` ifadesiyle kapat, (b) üye listesi yarısını F7'ye devret. | ⚠️ `feedPrivacy.ts` `users`'tan okuyor, Worker'a taşınmalı. Ayrıntı: Y15 |
| **F12** | **S10:** 400 satır kuralı — **16 dosyaya ÇIKTI** (denetimde yeniden sayıldı; K2'de 13'tü). `users.ts` **963** (897'den), `download.web.tsx` 861, `index.web.tsx` 753, `fetchers.ts` 733, `feedApi.ts` 597. Sınırı YENİ geçenler: `traktClient.ts` 402, `AddToListModal.tsx` 406, `explore.tsx` 408. | 🔴 **Borç büyüyor.** `users.ts` öncelikli ve bölme çizgisi boyut değil SORUMLULUK olmalı: `users/{sync,lists,calendar,settings}.ts`. `traktApi.ts` barrel'ı `export *` kullandığı için **hiçbir tüketici import'u değişmez** — bu, bölünmeyi en ucuz yapan şey |
| **F14** | **Elle yazılan içerik için akış görünürlüğü** — `publish_manual` (021). Tasarım: [`FEED_VISIBILITY_PLAN.md`](FEED_VISIBILITY_PLAN.md). F4 sırasında kullanıcı buldu: "Aktivitemi Akışta Gizle" incelemeleri kapsamıyordu. | ✅ **BİTTİ** — 021 çalıştırıldı, deploy edildi, cihazda doğrulandı |
| **F13** | **S16:** `expo-image` yalnızca 4 dosyada, `cachePolicy="disk"` 2 yerde; 12 dosya hâlâ RN `Image`. TMDB'ye giden tekrar isteklerini azaltır. | Yeni altyapı gerekmiyor |
| **F18** | **Worker git'te değil.** `kaymaktv-feedback-worker` hiç versiyon kontrolünde değil; F5/F6/F9/Y7 değişikliklerinin tek kopyası diskte. `git init` + `.gitignore` + ilk commit. | Kısa iş, yüksek sigorta değeri |

---

### KOL E — Denetim Düzeltmeleri 🆕

> 2026-08-18 sistem denetiminden (D0) çıktı. Bulguların tamamı
> "SONRADAN BULUNANLAR"da **Y12-Y21** olarak kayıtlı; buradaki fazlar onları
> gruplandırıyor.

#### F15 · 🩹 Kullanıcıya dokunan düzeltmeler — **SIRADAKİ**

Bu fazın seçim ölçütü: **bugün gerçek bir kullanıcıyı yanıltan veya emeğini
kaybettiren** kusurlar. Performans/mimari borcu buraya girmez.

| # | Bulgu | Kullanıcı ne yaşıyor |
|---|---|---|
| **Y17** | `episode/[id].tsx` hata durumunda sahte veri | Trakt düşünce sayfa "Bölüm 5 · Henüz özet yok" diye **başarıyla açılmış gibi** görünüyor; `first_aired` boş olduğu için **"TBA" rozeti** çiziliyor ve **"İzledim" butonu kayboluyor** → uygulama *"bu bölüm yayınlanmadı"* diyor. **Uygulama yalan söylüyor.** |
| **Y16** | 3 yazma yüzeyinde onaysız metin kaybı | 1000 karakterlik gönderi, klavyeyi kapatmak için arka plana dokununca **tek dokunuşla, onaysız** gidiyor. `WriteReviewSheet` bunu çözmüş; kapatma tarafı diğer üçüne taşınmamış |
| **Y18** | Gizlilik anahtarı sessizce başarısız | "Gizle" der, Worker 401/429 döner, anahtar sessizce geri açılır → **gizlediğini sanır.** Gizlilik kontrolünde sessizlik kabul edilemez |
| **Y21** | Akışta "devamı yüklenemedi" çıkmazı | En altta spinner kaybolur, hiçbir şey gelmez, hiçbir mesaj yok. `onEndReached` tekrar tetiklenmez — kullanıcı akışın bittiğini mi bozulduğunu mu anlayamaz |
| **Y20** | `SectionErrorBoundary` tek yerde | Tek render istisnası tüm ekranı düşürüyor. S13'ün gerekçesi pratikte uygulanmamış |

**Ortak desen:** dördü de `AI_RULES` §2 (sessiz başarısızlık yasağı) ihlali.
Y17 ve Y18 daha ağır — orada sessizlik değil, **yanlış bilgi** var.

**Çıkış kriteri:** her düzeltme için "kullanıcı ne görüyor" senaryosu cihazda
doğrulanmış olmalı.

#### F16 · 🔒 Açık proxy güvenliği (Y12)
`kaymaktv.com/api/tmdb` ve `/api/trakt-proxy` kimliksiz, rate-limit'siz,
CORS `*`. Canlıda doğrulandı. **Trakt ücretlendirmeye geçtiği için doğrudan
fatura riski** + TMDB anahtarının kota aşımıyla askıya alınması.

**Sıra:** (1) Cloudflare WAF rate-limit `/api/*` — **kodsuz, anında, önce bu**
· (2) `cors({origin})` + `express-rate-limit` + Trakt uç beyaz listesi.
**Not:** SSRF yok (host değiştirilemiyor, `api_key` ezilemiyor) — sorun
kimliksiz kota tüketimi.

#### F17 · 🧹 Kopya birleştirme + bayat doküman (Y19) — ✅ BİTTİ
`formatRelativeTime` ve `confirmAsync`'in ikişer kopyası ıraksamıştı.
İlkinde İngilizce arayüz Türkçe zaman gösteriyordu; ikincisinde Android'de
diyalog dışına dokunulunca promise sonsuza dek askıda kalıyordu.

**Sonuç:** her ikisi de kök `utils/`'e birleştirildi, `features/feed/utils/`
kopyaları silindi. Kanonik dosya seçimi importer sayımı **yanlış tahmin
edilseydi** yanlış yöne giderdi — ayrıntı HISTORY Madde 193.

> **Neden önemsiz görünüp önemliydi:** `utils/confirmDialog.ts`'in başlığı
> patch'ten beri **yalandı** ve denetimde bir alt ajanı 60 çağrı noktası
> boyunca yanlış yöne sürüklemişti. Başlık bu turda düzeltildi.

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

## 🔍 SİSTEM DENETİMİ BULGULARI (2026-08-18, 4 alt ajan)
Ayrıntı: `HISTORY.md` Madde 190. Kapatılanlar: **K1** (anon sansür açığı),
**B1/B3/B4** (`025`). Aşağıdakiler açık:

### ✅ Y12 · `kaymaktv.com` açık proxy — KAPANDI (canlıda doğrulandı)
`server.js` → `/api/tmdb` ve `/api/trakt-proxy` kimlik doğrulaması, Origin
kontrolü ve rate limit olmadan çalışıyor; `app.use(cors())` ile herkese açık.
Canlıda doğrulandı: `GET kaymaktv.com/api/tmdb?endpoint=/configuration` → 200.
**Trakt ücretlendirmeye geçti** — bu doğrudan fatura ve anahtar banlanma riski.
**Not:** SSRF YOK (host değiştirilemiyor, `api_key` ezilemiyor) — sorun
kimliksiz kota tüketimi.

**Durum (F16, HISTORY Madde 192): KAPANDI.** `server/security.js` Raspberry
Pi'ye deploy edildi ve `kaymaktv.com` üzerinde ölçüldü: `ACAO: *` **gitti**
(yalnızca `https://kaymaktv.com` başlık alıyor, `Origin`'siz native istekler
etkilenmiyor), liste dışı Trakt uçları **403**, `redirect_uri` guard'ı
**400** veriyor, `ratelimit-policy: 300;w=60` başlıkları geliyor.
**Açık kalan tek şey ikinci hat:** Cloudflare rate limiting kuralı (§0 adım 3).

### 🟠 Y13 · `watched_movie` için unique kısıt YOK
`003`/`005` yalnızca `watched_episode` ve `rated` için kısıt tanımlıyor;
`watched_movie` (013'te eklendi) korumasız. `/feed/publish` ile `/feed/sync`
yarışında kalıcı çift kayıt oluşabilir ve **kendini onarmaz** (`Set` iki satırı
tek anahtara indirger). Canlıda çift kayıt yok — kapatmak için doğru an.
**Neden `025`'e girmedi:** kısıt eklenince senkronun TOPLU INSERT'i tek
çakışan satır yüzünden tüm partiyi düşürür → 502. Önce Worker tek-tek INSERT
+ 23505 yutma desenine geçmeli. **Faz:** Worker turu.

### 🟠 Y14 · Gizlenen içerik anon key ile hâlâ okunabiliyor
`in_feed`/`is_visible` yalnızca istemci sorgusunun filtresi; RLS karşılığı yok
(`feed_activities_select_all USING(true)`). `?in_feed=eq.false` ile moderasyon
gizlemesi dahil tüm gizli içerik tam metniyle okunuyor (canlıda doğrulandı).
Bu, **G3'ün sorduğu sorunun** cevabı: gizleme kozmetik.
**Çözüm:** `report_count < 3` satır-seviyesi bir kural, RLS'e taşınabilir
(kullanıcı-seviyesi değil, `auth.uid()` gerekmiyor). ⚠️ `feedReviews.ts`'in
bölüm sayfası yolunu kırabilir — önce doğrulanmalı. **Faz:** G3.

### 🟠 Y15 · S11 — ayar sızıntısı kolon GRANT'ı ile kapatılabilir
MASTER_PLAN'daki *"RLS kolon seviyesinde çalışmadığı için çözüm ayrı
`user_settings` tablosu"* önermesi **eksik**: RLS satır seviyesindedir ama
**kolon seviyesinde `GRANT` vardır ve PostgREST ona uyar.**
```sql
REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT  SELECT (id, username, avatar_url, trakt_slug) ON public.users TO anon, authenticated;
```
Tek ifade; `is_private`/`publish_*`/`created_at` anon'a kapanır. Trigger
zinciri, `verifyCaller` upsert'i, `handleFeedPrivacy` — hiçbiri değişmez
(hepsi `service_role`). **Sınırı dürüstçe:** üye listesi (`id`, `trakt_slug`)
açık kalır — onu kapatmak akışı Worker'a taşımak demek (F7/F8).
**F11 yeniden çerçevelenmeli:** "S11'i çöz" değil → "ayar yarısını GRANT ile
kapat, üye listesi yarısını F7'ye devret".
⚠️ `feedPrivacy.ts` `users`'tan okuyor — Worker'a taşınmalı.

### ✅ Y16 · Yazma yüzeylerinde onaysız metin kaybı — KAPANDI (F15)
`ComposePostModal` · `FeedCommentSheet` · `NoteEditorModal`: arka plana
dokunma / X / Android geri tuşu metni **onaysız siliyor**. `WriteReviewSheet`
bunu `confirmAsync` ile çözmüş (F4-T9'da doğrulandı) — kapatma tarafı diğer
üçüne hiç taşınmamış. 1000 karakterlik bir gönderi tek dokunuşla gidiyor.
**Çözüm:** `WriteReviewSheet`'teki `handleRequestClose` deseni.

### ✅ Y17 · Hata durumunda sahte veri — KAPANDI (F15, üç ekran birden)
`useEpisodeDetail` `hasError` tutmuyor; Trakt 500/timeout'ta sayfa "Bölüm 5 ·
Henüz özet yok · Tarih yok" diye **başarıyla açılmış gibi** görünüyor. Dahası
`first_aired` boş olduğu için **"TBA" rozeti** çiziliyor ve **"İzledim" butonu
kayboluyor** — kullanıcıya "bu bölüm yayınlanmadı" deniyor. Boş ekrandan kötü:
uygulama yalan söylüyor. `show`/`movie` ekranları da "bulunamadı" diyor (yanlış
teşhis) ve "Tekrar Dene" sunmuyor. Üç hook'ta da `refreshData` var, **üçünde de
kullanılmıyor** (Y5 ile aynı kök).

### ✅ Y18 · Gizlilik anahtarı sessizce başarısız — KAPANDI (F15)
`useFeedPrivacy` catch'i yalnızca `console.warn` + switch'i geri alıyor.
Kullanıcı "gizle" der, Worker 401/429 döner, anahtar sessizce geri açılır →
**gizlediğini sanır.** Bir gizlilik kontrolünde sessizlik kabul edilemez
(AI_RULES §2). `ReportContentModal`'daki `notice` deseni yeniden kullanılmalı.

### ✅ Y19 · İki modülün iki kopyası ıraksamıştı — KAPANDI (F17)
`formatRelativeTime`: `utils/` (i18n'li, yıla kadar) vs `features/feed/utils/`
(**Türkçe sabit kodlu**, günde duruyor) → İngilizce arayüzde akış Türkçe zaman
gösteriyordu; `ReviewItem` ile `CommentItem` yan yana farklı dil kullanıyordu.
`confirmAsync`: **kanonik olduğu iddia edilen** `utils/` sürümünde `onDismiss`
yoktu → Android'de diyalog dışına dokunulunca **promise sonsuza dek askıda**
kalıyordu; fix zaten `features/feed/utils/`'teki kopyada vardı.

**Kapanış (HISTORY Madde 193):** ikisi de kök `utils/`'e birleştirildi —
`formatRelativeTime` artık `common:` önekli çeviri anahtarları kullanıyor
(çağıranın namespace'inden bağımsız), `confirmAsync` `onDismiss` fix'ini
kazandı. `utils/confirmDialog.ts`'in yalan başlığı da düzeltildi.

> ⚠️ **İmporter sayımı ilk bakışta ters çıkıyordu.** Import path'leri
> `'../utils/confirmDialog'` gibi görünüyordu ama hangi dosyaya çözüldüğü
> **çağıranın kendi dizinine bağlıydı** — literal string aynı olsa bile 17
> importer'dan 10'u kök dosyaya, 7'si feed kopyasına gidiyordu. Path'ler tek
> tek çözülmeden "16'ya 1" gibi bir ilk izlenim yanlış kanonik dosyayı
> seçtirebilirdi.

### 🟡 Y20 · `SectionErrorBoundary` yayılımı — 🟢 KISMEN KAPANDI (F15)
**Yapıldı:** akış kartları (`feed.tsx` renderItem, `silent` — bozuk tek kart
artık tüm akışı düşürmüyor) · `show/[id].tsx` → `MediaCast`.
**Kalan:** `MediaHero` (595 satır, Trakt ham verisini okuyor — en değerlisi) ·
`SeasonAccordion` · `HorizontalMediaList` · `movie/[id].tsx` blokları.
**Neden kısmi:** kalanlar çok satırlı JSX blokları; script ile sarmalamak
riskliydi, elle ve tek tek yapılmalı.

<details><summary>özgün bulgu</summary>

### `SectionErrorBoundary` tüm projede TEK yerde
`MediaCommentsSection`'da, üstelik `silent`. `MediaHero`, `MediaCast`,
`SeasonAccordion`, `FeedCard` korumasız → tek render istisnası tüm ekranı
`ErrorFallback`'e düşürüyor. S13'ün gerekçesi pratikte uygulanmamış.

</details>

### ✅ Y21 · Akışta "devamı yüklenemedi" çıkmazı — KAPANDI (F15), ⚠️ CİHAZDA DOĞRULANMADI
`useFeed` `loadMore` hatasında yalnızca `console.warn`; kullanıcı zaten en
alttadır, `onEndReached` yeniden tetiklenmez, footer `null` döner. Spinner
kaybolur ve **hiçbir şey olmaz**. Aynı sınıf: liste doluyken `refresh()`
başarısızlığı tamamen görünmez.

> **T1 (HISTORY Madde 194) bu dalı tetiklemedi** — test doğal akış sonuna
> (`!hasMore`) denk geldi, `loadMoreFailed` hiç devreye girmedi. Kod
> değişmedi, yalnızca doğrulama eksik: akış ortasındayken, daha sayfa
> varken uçak modu açılarak tekrar denenmeli.

### ✅ Y22 · Devre kesici, "Tekrar Dene"yi görünmez kılıyordu — KAPANDI (HISTORY Madde 195)
`services/api/traktClient.ts` + `utils/circuitBreaker.ts`: her Trakt
endpoint'i **5 art arda hatada 30 saniye** boyunca isteği ağa hiç
göndermeden reddediyor. Yanıtsız ağ hatası (uçak modu) bu sayıma dahildi.
`useEpisodeDetail`/`useShowDetail`/`useMovieDetail` devre kesici reddiyle
gerçek ağ hatasını ayırt etmiyordu — ikisi de aynı `LoadFailedState` genel
mesajına düşüyordu, "Tekrar Dene" internet geri gelse bile 30 saniye
boyunca işe yaramıyormuş gibi görünüyordu.

**Kapanış:** üç hook'a `isCircuitBreakerError` eklendi (`results[0].reason
?.isCircuitBreakerRejection` kontrolü), ekranlar bu durumda `LoadFailedState`'e
ayrı bir metin geçiyor (*"Çok fazla deneme yapıldı — birkaç saniye bekleyip
tekrar dene."*, `media:loadFailedCircuitBreakerText`). `tsc` temiz,
`Promise.allSettled` davranışı simüle edilerek 4 senaryo (breaker reddi /
gerçek ağ hatası / başarı / 401) test edildi, dördü de doğru ayrıldı.
**Doğrulanamayan:** cihazda gerçek uçak modu senaryosu tekrar denenmedi.

> ⚠️ **Kapsam dışı bırakılan, ayrı bir kusur adayı:** `useMovieDetail`'in
> dış `catch` bloğu `hasError`'ı hiç set etmiyor (yalnızca `console.error`).
> `useShowDetail`/`useEpisodeDetail`'deki dallardan farklı davranıyor.
> Y22'nin kapsamı dışında tutuldu, kayda geçti.

## Y11 · Gizlenen yorumlar `comment_count`'ta sayılmaya devam ediyor
**Nerede:** `015_feed_social.sql` → `bump_activity_comment_count` trigger'ı ·
`024` ile gelen `comments.is_visible`
**Bulundu:** F10 uygulanırken (2026-08-18).

`comment_count` trigger'ı `comments` INSERT/DELETE'ini sayıyor, görünürlüğe
bakmıyor. 3+ bildirim alan bir yorum gizlendiğinde kart hâlâ *"3 yorum"*
gösterir ama açınca 2 yorum görünür.

**Neden F10'da düzeltilmedi:** düzeltmek `015`'teki artırma/azaltma trigger'ını
yeniden hesaplamaya çevirmeyi gerektiriyor (görünürlük değişimi artırma
mantığına sığmıyor — `024`'ün `sync_report_count`'ta aynı sebeple yeniden
hesaplama seçmesiyle aynı gerekçe). Bu, çalışan bir sayaç trigger'ına dokunmak
demek ve F10'un kapsamını genişletirdi.

**Bugün tetiklenmiyor:** eşik 3 farklı kişi; mevcut ölçekte (10'dan az
kullanıcı) hiç gizlenme olmayacak. Ölçek büyümeden önce kapatılmalı.
**Faz:** F10 sonrası küçük bir düzeltme turu ya da bir sonraki K fazı.

## Y10 · "İçeriği Bildir" metin içermeyen kartlarda da görünüyor
**Nerede:** `features/feed/components/FeedCard.tsx` → `onReport={!isOwnActivity ? … }`
**Bulundu:** kullanıcı, F9 sonrası (2026-08-18).

*"X, S01E02'yi izledi"* gibi bir sistem logunda bildirilecek kullanıcı içeriği
yok; moderatör `content_reports`'ta içeriği boş bir satır görüyor.

**Ama "izleme kartı = sistem mesajı" varsayımı YANLIŞ:** `FeedCard.tsx:227`
her aktivite tipinde not eklemeye izin veriyor (`onEdit` tip ayrımı yapmıyor,
Worker `handleFeedNote` de yapmıyor) ve not varsa o kartın **birincil içeriği**
oluyor — Twitter'ın alıntı tweet'i deseni, bilinçli bir özellik. Yani nota
iliştirilen metin tam anlamıyla UGC ve bildirilebilir kalmalı.

**Doğru koşul** aktivite tipi değil içeriğin varlığı:
`onReport={!isOwnActivity && !!activity.note ? … }` — `rated` ve notsuz
`watched_*` gizlenir, notlu her şey görünür kalır. Maraton kartında rapor
zaten yok (sentetik gruplama, tek `target_id`'ye bildirilemez).

**Neden yapılmadı:** kullanıcı kararı — Google Play UGC politikası açısından
menüden bildirme seçeneği KALDIRMAK, gereksiz bir seçenek bırakmaktan daha
riskli. Fazladan "Bildir" zararsız; eksik olanı politika ihlali olabilir.
**Faz:** Google Play politikası netleştiğinde yeniden değerlendirilir.

## Y7 · Trakt hata sebepleri tek mesaja düşüyordu — 🟡 KISMEN KAPANDI
**Durum:** `verifyCaller` + `authErrorResponse` eklendi (Madde 188).
`/feed/sync` ve `/feed/report` geçirildi; **kalan ~11 uç hâlâ eski
sarmalayıcıyı** kullanıyor ve tek mesaj gösteriyor.

Sebep artık HER durumda **loglanıyor** (`[verifyCaller] …`), yani teşhis için
`wrangler tail` yeterli. Geçirilen iki uçta kullanıcı da doğru mesajı
görüyor: 429 → *"birkaç dakika sonra dene, oturununda sorun yok"*,
401 → *"çıkış yapıp tekrar giriş yap"*, 5xx → *"sorun senin hesabında değil"*.

**Kalan iş:** diğer uçlar dokunuldukça `verifyCaller` + `authErrorResponse`
ikilisine geçirilecek. Toplu bir refactor **bilinçli olarak yapılmadı** —
13 yazma ucunu tek seferde değiştirmek `MASTER_PLAN` §3'teki "kimlik
refactoru" riskinin ta kendisi. **Faz:** F7 (`resolveCaller`) bunu tamamlar;
bugünkü `verifyCaller` onun tohumu.

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

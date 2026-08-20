# KaymakTV — İnceleme & Yorum Sistemi · MİMARİ PLAN v2 (Trakt'tan Kopuş)

> **Bu doküman OTURUMLAR ARASI DEVİR belgesidir.** Yeni bir oturum açıldığında
> önce §0'ı (Durum Panosu) ve §0.1'i (Nasıl Devam Edilir) oku — geri kalanı
> referans. Her faz bitiminde §0 güncellenmeli.
>
> **Kronolojik kayıt:** `docs/HISTORY.md` Madde 165-173.
> **Tetikleyici:** Trakt API'nin ücretlendirmeye geçmesi (2026-08).
>
> 📍 **Sıra/faz takibi bu dosyada DEĞİL:** program haritası, denetim fazları ve
> bağımlılıklar [`docs/MASTER_PLAN.md`](MASTER_PLAN.md)'de. Bu doküman inceleme
> sisteminin **tasarım gerekçelerini** saklar.

---

## 0. Bu doküman ne İÇİN var

İnceleme sisteminin **tasarım gerekçelerini** saklar — "neden Trakt'a yazmayı
bıraktık?", "neden `tmdb_id` zorunlu?", "neden tek liste iki blok?". Kod
yorumlarının onlarcası buraya `§` numarasıyla atıf yapıyor.

> 📍 **Faz/sıra takibi BURADA DEĞİL.** Hangi fazdayız, sıradaki iş ne, hangi
> denetim ne zaman → [`docs/MASTER_PLAN.md`](MASTER_PLAN.md).
> *(Bu dosyada bir zamanlar ikinci bir durum panosu vardı; MASTER_PLAN'dakiyle
> ıraksadığı için kaldırıldı — iki kopya birbirinden sapınca hangisinin doğru
> olduğu bilinemez hâle geliyor.)*

**Uygulama durumu:** v2 (Trakt'tan kopuş) kod tarafı TAMAMLANDI; `019` + `020`
migration'ları ve Worker deploy'u canlıda doğrulandı. Kalan: uçtan uca cihaz
testi (MASTER_PLAN F4).

---

## 0.1 YENİ OTURUMA NASIL DEVAM EDİLİR

1. **§0 Durum Panosu**'ndan aktif fazı bul.
2. `docs/HISTORY.md`'nin **son maddesini** oku (o ana kadar ne yapıldığı orada).
3. Değişiklik yapmadan önce **doğrula, varsayma**:
   ```bash
   npx tsc --noEmit --noUnusedLocals --noUnusedParameters -p .   # istemci
   node --check "C:/Yapay_Zeka_Uygulamalar/kaymaktv-feedback-worker/src/index.js"
   ```
4. Faz bitince **üçünü birden** güncelle: §0 panosu · `docs/HISTORY.md` yeni madde ·
   ilgili `docs/*.md`.
5. **Zorunlu kurallar:** `docs/AI_RULES.md` — özellikle §2.5 (ölü kod bırakma,
   silmeden önce otopsi) ve §3 (her özellik sonrası doküman).

### Bu projede kolay unutulan 6 şey
1. **Migration'lar elle çalıştırılır** — otomatik göç yok, takip tablosu yok.
   Worker deploy'u da elle (`wrangler deploy`).
2. **PostgREST `on_conflict` KISMİ index'lerle çalışmaz** (HISTORY Madde 89).
   `feed_activities`'e upsert YOK — "oku, bellekte karşılaştır, düz INSERT/PATCH".
3. **Supabase Auth kullanılmıyor.** RLS `auth.uid()` veremez → tüm yazmalar Worker
   `service_role` ile; sahiplik `WHERE user_id = <doğrulanan çağıran>` ile zorlanır.
4. **Karakter sınırı ÜÇ yerde senkron:** DB CHECK (gerçek kaynak) · Worker
   `MAX_NOTE_LENGTH` · istemci `MAX_REVIEW_CHARS`. Şu an **5000**.
5. **Oturum izolasyonu:** yeni bir modül seviyesi önbellek eklersen
   `AuthContext.removeKeys()`'e de ekle, yoksa önceki hesabın verisi sızar.
6. **`activity_at` düzenlemede DEĞİŞMEZ** — yoksa eski bir kayıt akışın tepesine
   fırlar ("gizli spam").

---

## 1. Mimari Vizyon

**İlke:** Trakt bir **veri sağlayıcı**dır, bir **bağımlılık** değil. Kullanıcının
KaymakTV'de ürettiği hiçbir şey Trakt'ın ayakta olmasına bağlı olmamalı.

```
        ESKİ (v1)                          YENİ (v2)
   ┌──────────────────┐              ┌──────────────────┐
   │     Worker       │              │     Worker       │
   └───┬──────────┬───┘              └────────┬─────────┘
       ▼          ▼                           ▼
   ┌────────┐ ┌────────┐              ┌──────────────┐    ┌────────────┐
   │ Trakt  │ │Supabase│              │   Supabase   │    │   Trakt    │
   │(YAZMA) │ │        │              │ (TEK YAZMA)  │    │ (SALT OKU) │
   └────────┘ └────────┘              └──────────────┘    └────────────┘
```

### Onaylanan kararlar
| # | Karar |
|---|---|
| 1 | Git'ten geri dönülmüyor — **çıkarma** yöntemi |
| 2 | Trakt'a **YAZMA tamamen kalkıyor** (inceleme, yorum, yanıt) |
| 3 | **Tek kesintisiz liste, iki blok** — üstte biz, altta Trakt salt-okunur |
| 4 | **Bölüm incelemeleri bize yazılacak** ama **ANA AKIŞA DÜŞMEYECEK** |
| 5 | **Slug bazlı tekilleştirme** |
| 6 | `trakt_comment_id` **silinmiyor** (ileride önbellekleme anahtarı) |
| 7 | Karakter sınırı: **maks 5000, min 3** |
| 8 | Aynı yapıma **hem dizi hem bölüm** incelemesi yazılabilir |
| 9 | `CommentReplies` **kalıyor** — Trakt yanıtları salt okunur |
| 10 | Trakt bloğu yoksa **sessizce gizlen**, hata gösterme |

---

## 2. Veri Modeli

### 2.1 Migration numaralandırması — ⚠️ DÜZELTİLDİ
İnceleme migration'ı ilk yazıldığında `018_feed_reviews.sql` adıyla oluşturulmuş
ve mevcut **`018_content_reports.sql`** ile çakışıyordu (aynı numara → belirsiz
çalıştırma sırası). Yeniden adlandırıldı:

| Eski | Yeni | Durum |
|---|---|---|
| `018_feed_reviews.sql` | **`019_feed_reviews.sql`** | ✅ çalıştırıldı (018 adıyla) |
| `019_reviews_local_only.sql` | **`020_reviews_local_only.sql`** | ✅ çalıştırıldı |

> Repoda `010` ve `012` numaralarında da eski çakışmalar var (dokunulmadı,
> ikisi de çalıştırılmış). **Yeni migration eklerken `ls supabase/schema/` ile
> son numarayı kontrol et.**

### 2.2 `019`'dan KALAN (hâlâ doğru)
`'reviewed'` tipi · **`tmdb_id` zorunluluğu** (pivotun tüm mantığı) · `note`
zorunluluğu · yapım başına tek inceleme unique'i · dizi/film sayfası kısmi
indeksi · **retention muafiyeti** · `trakt_comment_id` (kullanılmıyor ama duruyor
— Trakt kapanırsa "Trakt bloğu"nu önbelleğe almanın dedup anahtarı olur).

### 2.3 `020_reviews_local_only.sql` (çalıştırıldı)
- **`note` sınırı 1000 → 5000** (S1 + S8)
- **`in_feed` TÜRETİLMİŞ kolon:**
  ```sql
  GENERATED ALWAYS AS (NOT (activity_type='reviewed' AND episode_number IS NOT NULL)) STORED
  ```
  *Neden elle bayrak değil:* `008_drop_feed_hidden.sql`'in dersi — elle yönetilen
  bayrak senkron dışı kalır. *Neden sorguya koşul değil:* akış sorgusundaki
  hassas keyset `.or(...)` ifadesini kırma riski.
- Bölüm incelemesi için **ek şema gerekmedi** — `019`'daki unique index zaten
  `COALESCE(episode_number,'')` içeriyordu.

---

## 3. Yazma Yolu (yalnızca Supabase) — ✅ uygulandı

```
POST /feed/review
1. Rate limit (20/dk)  2. verifyAndUpsertUser  3. isPrivate → 403
4. Girdi: note 3..5000 · showId+mediaType+showTitle+tmdbId · opsiyonel episodeNumber
5. Supabase INSERT veya PATCH   6. {success, activity:{id, activityAt}}
```
**Söküldü:** Trakt POST/PUT · 409 kurtarma · `findMyTraktComment` ·
`traktWriteErrorMessage` · `traktOk` modeli · 5 kelime kuralı ·
`/feed/review/delete` (silme artık `/feed/delete`).

> **Dikkat (uygulama sırasında yakalanan tuzak):** `fetchExistingReview`'de `episode_number`
> NULL karşılaştırması `eq.` ile YAPILMAZ (SQL'de NULL != NULL) — `is.null`
> gerekir. Atlanırsa genel inceleme hiç bulunamaz, her düzenleme unique index'e
> çarpar.

---

## 4. Birleşik Liste — "Tek akış, iki blok"

```
┌─ Yorumlar ──────────────────────────────┐
│  [ İnceleme Yaz ]                        │
│  ● senin incelemen        ❤ 3   💬 1  ⋯  │  ← KaymakTV bloğu
│  ● ayse                   ❤ 7   💬 0  ⋯  │     sayfalama YOK, en yeni önce
│  ──────  Trakt topluluğundan  ──────     │  ← yumuşak ayraç (SEKME DEĞİL)
│                        [beğeni ▾]        │  ← sıralama SADECE bu bloğu yönetir
│  ○ someuser  ᴛʀᴀᴋᴛ                       │  ← salt okunur: buton YOK
│  [ Daha Fazla Yükle ]                    │
└──────────────────────────────────────────┘
```

**Sayfalama sorunu neden yok:** gerçek interleave iki imleçli merge-sort ister
(kırılgan). Ölçek gereksiz kılıyor — canlıda 512 izleme, 124 puan, **0 inceleme**;
bir yapımda bizim sayımız uzun süre 0-2, Trakt'ınki yüzlerce. Bloklar sıralı
olunca `useComments.loadMore` **hiç değişmeden** çalışır.

**Sıralama:** birleşik "beğeniye göre" matematiksel olarak anlamsız (iki farklı
evrenin sayıları). `CommentSortBar` ayracın altına taşınır, yalnızca Trakt bloğunu
yönetir.

### 4.1 🔴 ASENKRON YÜKLEME — mevcut bir performans hatası
**Risk (kullanıcı tespiti) DOĞRULANDI ve zaten yaşanıyor.** `hooks/useShowDetail.ts`
satır ~66:

```js
const results = await Promise.allSettled([
  getShowSummary(traktIdNum),
  getShowSeasons(traktIdNum),
  getRelatedShows(traktIdNum),
  getMediaComments(traktIdNum, 'show')   // ⚠️ ekranı BLOKLUYOR
]);
```

`allSettled` **hepsinin** bitmesini bekler — yani Trakt'ın yorum uç noktası
yavaşsa **özet, sezonlar ve tüm sayfa** onu bekliyordu. `useMovieDetail` ve
`useEpisodeDetail`'de aynı
desen var.

**İyi haber:** bizim tarafımız zaten bağımsız — `useMediaReviews`,
`MediaCommentsSection` içinde mount olunca kendi isteğini atıyor.

**Çözüm (P3):** `getMediaComments`'i bloklayan batch'ten ÇIKAR, ayrı bir
`useEffect` + kendi `isLoadingComments` durumuyla yükle (dosyada satır ~128'de
tazeleme için ZATEN bu desen var: `.then(...).catch(() => {})`). Sonuç: sayfa
Supabase hızında açılır, Trakt bloğu kendi spinner'ıyla arkadan gelir.

### 4.2 🟡 Render hatası — `SectionErrorBoundary` (P3)
Projede Error Boundary VAR (`app/_layout.tsx`, Expo Router konvansiyonu) ama
**kök seviyede**: bir render istisnası TÜM ekranı fallback'e düşürür. "Sadece o
blok kaybolsun" için blok bazlı bir sarmalayıcı gerekiyor.

> **Not:** *veri* hatası (500/404/CORS/timeout) zaten korunuyor —
> `Promise.allSettled` + per-call `.catch`. Canlı kanıt: Faz 4 doğrulamasında bu
> ortamda tüm Trakt çağrıları CORS'a takıldı, sayfa beyaz ekran vermedi.
> Korunmayan yalnızca **render** istisnası.

---

## 5. Çift Kayıt — slug tekilleştirmesi (P3)

Aynı kişinin hem KaymakTV incelemesi hem Trakt yorumu varsa birleşik listede yan
yana çıkar. Eşleştirme anahtarı iki tarafta da var: bizde `users.trakt_slug`,
Trakt'ta `comment.user.ids.slug` (`hooks/useComments.ts` zaten okuyor).

**Kural:** Trakt bloğu çizilirken, yazar slug'ı o sayfadaki KaymakTV inceleme
yazarlarından biriyle eşleşen satırlar elenir. Tek `Set.has()`, ek istek yok.

---

## 6. 🧹 Temizlik Zinciri — ✅ TAMAMLANDI

### Silinenler
| Dosya | Satır | Neden |
|---|---|---|
| `components/WriteCommentSheet.tsx` | ~370 | ✅ silindi |
| `components/MyInlineComment.tsx` | 227 | ✅ silindi — yerini `MediaCommentsSection` aldı |
| `hooks/useMyMediaComment.ts` | ~115 | ✅ silindi — iki tüketicisi de öldü |

> Silme, bölüm sayfası yeni akışa geçtikten SONRA yapıldı — o ekran bu üç
> dosyayı en son kullanan yerdi.

### `services/api/comments.ts` — yazma yarısı
🗑️ `addComment` · `updateComment` · `deleteComment` · `addCommentReply` ·
`getUserComments` + `invalidateUserCommentsCache` + `userCommentsCache`
✅ Kalan: `getMediaComments` · `getCommentReplies` · `getEpisodeComments` ·
`cacheBustParam` → dosya salt-okuma servisine iner (~177 → ~90 satır).

### Diğer
- `components/comments/CommentReplies.tsx` → yazma kısmı (`addCommentReply` +
  `TextInput`) silinir, **okuma kalır** (Karar 9)
- `feedReviews.deleteFeedItemsRouted` → silinir; `useFeed`/`useUserActivity`
  eski `deleteActivitiesBulk` haline döner
- `feedReviews`'teki `traktOk` modeli → silinir
- `WriteReviewSheet`'te Trakt ön-doldurma + 5 kelime kuralı → silinir
- `utils/commentValidation.ts` → tamamı silindi (Trakt'ın sunucu kurallarıydı);
  yerine yalnızca kendi sınırlarımızı taşıyan `utils/reviewLimits.ts`

---

## 7. UI/UX Ayrımı (P3)

**En güçlü sinyal: buton YOKLUĞU.**

| | KaymakTV | Trakt |
|---|---|---|
| Avatar | dolu, marka çerçevesi | soluk/gri |
| Kullanıcı adı | `#e2e8f0` kalın | `#94a3b8` |
| Rozet | kendi incelemende `sen` | küçük `Trakt` pili |
| Metin | `#cbd5e1` | `#94a3b8` |
| Aksiyon satırı | ❤️ · 💬 · ⋯ | **HİÇBİRİ** |
| Dokunma | yanıt sheet'i | `CommentSheet` (ölü uç olmasın) |

**Üç kural:** (1) ayraç sekme değil, ince çizgi + etiket · (2) Trakt satırlarını
**disabled/gri gösterme** (bozuk sanılır) — "sönük ama canlı" · (3) **boş durum
kritik**: bugünkü ölçekte neredeyse her yapımda bizim blok boş olacak, hata gibi
değil davet gibi görünmeli.

---

## 8. Bölüm İncelemeleri (P4)
`app/episode/[id].tsx` → `MediaCommentsSection` (`mediaType='show'` +
`episodeNumber`). Satır normal bir `reviewed` kaydı, tek farkı `episode_number`
dolu; `in_feed` kolonu akıştan otomatik eler.

---

## 9. 🔴 Google Girişi + Hesap Birleştirme (P7)

### 9.1 Blokaj (S9)
```sql
users.trakt_slug TEXT UNIQUE NOT NULL   -- 002_fix_user_identity.sql
```
+ Worker'daki **13 uç noktanın hepsi** `traktAccessToken` zorunlu tutuyor.
→ **Google ile giren kullanıcı bugün hiçbir şey yazamaz; satırı bile oluşamaz.**

### 9.2 Yapılacaklar
1. `users.trakt_slug` → **NULLABLE** (UNIQUE kalır; Postgres birden fazla NULL'a
   izin verir). Trakt artık **bağlantı**, kimlik **anahtarı** değil.
2. `users`'a `auth_provider` + **`google_sub` UNIQUE** (Google'ın kalıcı kimliği —
   e-posta değişebilir, `sub` değişmez).
3. Worker: `verifyAndUpsertUser(token)` → **`resolveCaller(request)`**; içeride
   sağlayıcıya göre doğrular. **13 uç noktanın gövdesi DEĞİŞMEZ** — hepsi zaten
   dönen `userId`'yi kullanıyor.
4. İstemcide kimlik kaynağı `getMyTraktSlug()` değil dahili `users.id`.
   ⚠️ **"`getMySupabaseUserId()` zaten var, altyapı yarı hazır" YANILTICIYDI**
   (F7'de ölçüldü): fonksiyon vardı ama İÇERİDE `getMyTraktSlug()` çağırıp
   slug'dan türetiyordu — yani tamamen Trakt'a bağımlıydı ve Google
   kullanıcısında `null` dönerdi. F7'de disk öncelikli hâle getirildi
   (bellek → disk → yalnızca gerekirse slug).
5. **Akış görünürlüğü:** `getVisibleUserIds` Trakt following listesine dayanıyor →
   Google kullanıcısının akışı **boş** olur. Kendi takip sistemimiz sorusunu açar.

### 9.3 🔴 HESAP BİRLEŞTİRME — Spotify/Facebook tuzağı
**Senaryo:** Mevcut kullanıcı (Trakt ile girmiş, incelemeleri var) bir gün
"Google daha kolay" deyip Google'a basar → sistem onu **yeni kullanıcı** sanar,
boş hesap açar, eski içeriği öteki satırda kalır.

**Bu, geri dönüşü en pahalı hatadır** — kullanıcı yeni hesapta içerik üretmeye
başladıktan sonra birleştirme "iki içerik kümesini birleştirme" problemine
dönüşür.

**Tasarım kuralları:**
1. **Tek `users` satırı = tek kimlik.** `trakt_slug` ve `google_sub` o satırın
   iki **bağlantı kolonu**. Birleştirme = **bağlantıyı taşımak**, içeriği
   taşımak değil.
2. **ASLA yalnızca e-postaya bakıp otomatik birleştirme.** Trakt'tan gelen
   e-posta bizim tarafımızdan doğrulanmış değil → hesap ele geçirme riski.
3. **Doğru akış — kullanıcı onaylı köprü:**
   ```
   Google ile giriş → bu google_sub'a bağlı satır var mı?
     VAR   → normal giriş
     YOK   → "Daha önce Trakt ile giriş yaptın mı?"
             ├─ Hayır → yeni satır oluştur (auth_provider='google')
             └─ Evet  → Trakt OAuth akışını başlat
                        → dönen trakt_slug'ın satırı VAR mı?
                           VAR → o satıra google_sub'ı EKLE (birleşme tamam,
                                 hiçbir içerik taşınmadı)
                           YOK → yeni satır, iki bağlantıyla birden
   ```
4. **Köprüyü İLK GİRİŞTE göster** — kullanıcı içerik üretmeden önce. Sonradan
   sunmak, iki içerik kümesi doğurur.
5. **Yine de iki satır oluştuysa** (kaçınılmaz bir azınlık): birleştirme
   Worker'da tek bir işlem olmalı — B'nin `feed_activities`/`comments`/
   `feed_activity_likes`/`user_blocks` satırlarındaki `user_id`'yi A'ya taşı,
   sonra B'yi sil. ⚠️ **Unique kısıtlar çakışabilir** (ör. aynı yapıma iki
   hesaptan da inceleme) — çakışanlarda hangisinin kazanacağı önceden
   kararlaştırılmalı (öneri: **daha yeni olan**).

---

## 10. 🟠 Moderasyon (P8) — tahmin edilenden İYİ durumda

**Keşif: altyapı ZATEN VAR.** `supabase/schema/018_content_reports.sql`:
- `content_reports` tablosu: `target_type` (`activity` | `comment` |
  **`trakt_comment`**), `reason` (spam/harassment/hate_speech/spoiler/illegal/
  other), `detail` ≤500, `status` (open/reviewed/dismissed)
- İndeksler: `(target_type, target_id)` ve `(status)`
- **RLS'te INSERT politikası VAR** (`WITH CHECK (status = 'open')`) — projede
  istemcinin doğrudan yazabildiği **tek tablo**; `status`'ü kendisi ayarlayamaz.
- UI **7 bileşene bağlı**: `CardMenu`, `FeedCard`, `FeedCommentItem`,
  `CommentItem`, `ComposePostModal`, `ReportContentModal` ve yeni `ReviewItem`.

**Eksik olan tek şey: otomatik gizleme.** "5 rapor alan içerik akıştan düşsün".

### ⚠️ Otomatik gizlemeden ÖNCE kapatılması gereken açık
`content_reports`'ta **`UNIQUE(reporter_user_id, target_type, target_id)` YOK**
ve `reporter_user_id` **nullable**. Yani:

> **Bugün otomatik gizleme eklenirse, TEK bir kişi aynı içeriği 5 kez raporlayıp
> istediği yorumu sansürleyebilir.**

**Sıra ŞART:** (1) UNIQUE kısıtı + `reporter_user_id` zorunlu → (2) sayaç/eşik →
(3) otomatik gizleme. Eşik `feed_activities`'e türetilmiş bir kolonla ya da
Worker'ın kontrol ettiği bir sayaçla uygulanabilir.

**App Store gerekçesi geçerli:** UGC moderasyonu olmayan uygulamalar reddedilir.
Rapor **arayüzü** zaten var (kabul için asgari şart genelde bu), otomatik gizleme
ikinci aşama.

---

## 11. 🟡 TMDB Görsel Bağımlılığı (ertelendi — şu an sorun değil)

Trakt'tan koptukça posterler/meta veri için TMDB'ye bağımlılık artıyor.

**Mevcut durum (ölçüldü):**
- `expo-image@~3.0.11` **kurulu** ✅
- Ama yalnızca **4 dosyada** kullanılıyor; **12 dosya** hâlâ React Native
  `Image` (önbelleksiz)
- `cachePolicy="disk"` yalnızca **2 yerde** (`MediaPoster.tsx`,
  `profile/ListCard.tsx`)

**Yani azaltıcı önlem yarı uygulanmış.** Kullanıcı kararı: acil değil, afiş
kaydetme planı ileride. **Ucuz önlem (fırsat bulunca):** görsel gösteren tüm
yolları `expo-image` + `cachePolicy="disk"`'e çevir — yeni kütüphane, yeni
altyapı gerektirmiyor, TMDB'ye giden tekrar isteklerini doğrudan azaltır.

**Not:** TMDB proxy'si (Raspberry Pi) şu an bir kalkan; ölçek büyürse posterleri
kendi sunucumuza indirip dağıtma (TV Time'ın TheTVDB sonrası yaptığı) gündeme
gelir.

---

## 12. 🔒 Güvenlik Denetimi (Worker sadeleştirme turunda yapıldı)

### ✅ Sağlam
| Kontrol | Sonuç |
|---|---|
| **Anon key ile YAZMA** | **HTTP 401 — reddedildi** (canlı test) |
| **PostgREST enjeksiyonu** | Her kullanıcı girdisi doğrulanıyor: UUID'ler `UUID_RE`, `showId` `Number.isFinite && >0`, `mediaType` beyaz liste, `episodeNumber` regex **+ `encodeURIComponent`**. `table`/`ownerColumn`/`onConflict` kod içi sabit. |
| **IDOR** | Sahiplik her zaman `WHERE user_id = <doğrulanan çağıran>` |
| **service_role** | Yalnızca Worker ortamında; `.env`/`dist` git dışı |
| **Trakt yazma yüzeyi** | **Kapandı** — `traktFetch` GET-only |

### 🟠 S11 — kullanıcı sayımı + gizlilik ayarı sızıntısı
`users_select_all USING (true)` → anon key'i olan herkes (anahtar istemci
bundle'ında: **herkes**) tüm kullanıcı listesini çekebiliyor. **Canlı doğrulandı:**
5 kullanıcının `trakt_slug`, `username`, **`is_private`, `publish_watches`**
döndü — yani *kimin ne gizlediği* herkese açık.

Postgres RLS **satır** seviyesinde çalışır, kolon seviyesinde değil. Seçenekler:
**(a)** gizlilik ayarlarını `user_settings` tablosuna taşı, SELECT politikası
verme *(önerilen)* · **(b)** kısıtlı VIEW · **(c)** kabul et ve dokümante et.
**Pivotun yarattığı açık değil — `001`'den beri var.**

### 🟡 Kabul edilen artık riskler
- Rate limiter **isolate başına** çalışıyor; azami etki saldırganın **kendi
  kimliği altında** spam üretmesi (her yazma sahiplik kapsamlı)
- Geçerli Trakt token'ı olan herkes yazabilir — beyaz liste yok (kimlik modelinin
  kendisi)

---

## 13. Dürüst Kayıp Listesi

1. **Erişim.** İncelemeler Trakt topluluğuna görünmez olur.
2. **Trakt'tan içeri alma.** 409-kurtarma gitti; Trakt'ta yazılan KaymakTV'ye
   taşınamaz (elle kopyalama gerekir).
3. **Tek kaynak avantajı.** Aynı kişinin aynı yapım hakkında iki bağımsız metni
   olabilir; biri düzenlenince diğeri güncellenmez. §5'teki tekilleştirme bunu
   **gizler ama çözmez.**

---

# 📌 AÇIK MADDELER

| # | Sorun | Durum |
|---|---|---|
| **S1** | `note` 1000 sınırı dar | ✅ **P1** — 5000 oldu (üç yer senkron) |
| **S2** | `invalidateUserCommentsCache` | ✅ Konusuz — `getUserComments` siliniyor (P5) |
| **S3** | Rate limiter Trakt yazmayı koruyor | ✅ **P1** — Trakt'a yazma yok |
| **S4** | `findMyTraktComment` 200 sınırı | ✅ **P1** — silindi |
| **S5** | `/feed/privacy` `watched_movie` temizlemiyor | ✅ **P1** — düzeltildi |
| **S6** | `deleteFeedItemsRouted` kısmi başarısızlık | ✅ **P2** — yönlendirici kaldırıldı |
| **S7** | Aynı kişi listede iki kez | ⬜ **P3** — slug tekilleştirmesi |
| **S8** | Karakter sınırı tutarsızlığı | 🟡 Yarısı **P1**; bölüm sayfası **P4**'te kapanır |
| **S9** | **Google girişi hiçbir şey yazamaz** | 🔴 **P7** — §9 |
| **S10** | 400 satır kuralı: 17 dosya | 🟠 Ayrı refactor turu — §14 |
| **S11** | `users` anon key ile tamamen okunabiliyor | 🟠 **AÇIK** — §12 |
| **S12** | Dizi/film sayfası Trakt yorumlarını **bloklayarak** yüklüyor | ✅ **ÇÖZÜLDÜ** (öne alındı) — §4.1 |
| **S13** | 🆕 Blok bazlı Error Boundary yok | ⬜ **P3** — §4.2 |
| **S14** | 🆕 **Hesap birleştirme köprüsü yok** | 🔴 **P7** — §9.3 |
| **S15** | 🆕 `content_reports`'ta UNIQUE yok → tek kişi 5 raporla sansürleyebilir | 🟠 **P8** — §10 |
| **S16** | TMDB görsel önbelleklemesi yarım (12 dosya `Image`) | 🟡 Ertelendi — §11 |
| **S17** | 🆕 **Tünel problemi** — uzun inceleme hata/kazara kapatmada kaybolmasın | ✅ **P2** — hata sheet'i kapatmıyor + kapatmadan önce onay |

## 14. S10 — 400 satır kuralı ihlalleri
Bu planın yolunda: `app/episode/[id].tsx` (551, **P4 dokunacak — bölme fırsatı**) ·
`FeedCard.tsx` (527) · `feedApi.ts` (494) · `app/show/[id].tsx` (412).
Kapsam dışı en büyükler: `services/api/users.ts` (**963**) ·
`app/(public)/download.web.tsx` (861) · `index.web.tsx` (753) ·
`services/library/fetchers.ts` (733).

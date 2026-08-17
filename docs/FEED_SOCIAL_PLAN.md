# KaymakTV Akış — Sosyal Katman TASARIM KAYDI (Not/Alıntı, Yorum, Beğeni, Engelleme)

> **Bu bir PLAN değil, tamamlanmış bir tasarımın GEREKÇE kaydıdır.** Tüm katmanlar
> (DB 015/016 + Worker + Client + UI) canlıda. Doküman, "neden böyle yapıldı"
> sorusunun cevabını sakladığı için duruyor — kod yorumlarının birçoğu buraya
> `§` numarasıyla atıf yapıyor. Yapılan işin kronolojik özeti: `docs/HISTORY.md`
> Madde 155.

**Durum:** ✅ Tamamlandı ve canlıda doğrulandı.
**Sonradan değişenler (bu dokümanın yazıldığı andan sonra):**
- Not/alıntı karakter sınırı **500 → 1000** (Madde 157: aynı `note` alanı artık bağımsız gönderileri de taşıyor). §3.5'teki "500" yalnızca **yorumlar** (`comments.body`) için hâlâ geçerli.
- Aktivite silme (hard delete + tombstone) ve kart başına "⋯" menüsü eklendi (Madde 161).
- Realtime artık INSERT/UPDATE'e ek olarak **DELETE** de dinliyor (Madde 162).

---

## 1) Neden bu sırayla?

Önce **veritabanı (migration 015 + 016)**, sonra **Worker uç noktaları**, en son **React Native UI + Realtime entegrasyonu**. Kullanıcının açık talebi: "acele başlamak istemiyorum" — her katman ayrı onaydan geçecek. Bu doküman DB katmanının tam tasarımını kayıt altına alıyor; Worker ve UI fazları migration'lar onaylandıktan sonra ayrı bir tur olarak işlenecek.

---

## 2) Kapsam — 3 yeni sosyal birim

1. **Kişisel Not/Alıntı** — kullanıcı zaten var olan bir `feed_activities` satırına (izledim/puan verdim) kendi yorumunu ekleyebilir ("Çok güzeldi!"). Letterboxd mantığı: log + kişisel not aynı satırda.
2. **Yorum** — bir aktiviteye (not olsun olmasın) başkaları yorum yazabilir. **Trakt'ın kendi yorum sistemiyle karışmaz** — tamamen ayrı, yalnızca KaymakTV içinde, bizim Supabase'imizde yaşar.
3. **Beğeni** — hem aktivitelere hem yorumlara uygulanır (toggle: aç/kapa).

Artı: **Kullanıcı Engelleme** — KaymakTV'ye özel, Trakt'a hiç dokunmaz.

---

## 3) Veri modeli kararları

### 3.1 Not/Alıntı — yeni tablo değil, mevcut satıra ek alan
`feed_activities`'e `note TEXT` + `note_spoiler BOOLEAN`. Ayrı bir tabloya gerek yok — not, o aktivitenin 1:1 bir parçası, kart çizmek için ekstra join gerektirmemesi önemli.

### 3.2 Yorumlar — YENİ TABLO AÇMIYORUZ, var olan `comments` tablosunu kullanıyoruz
Keşif: `supabase/schema/001_feed_schema.sql`'de zaten **kullanılmayan** bir `comments` tablosu var — "Phase 2'de kullanılacak, şimdiden şema hazır" notuyla, tam da bu iş için: `activity_id → feed_activities(id) CASCADE`, `user_id → users(id) CASCADE`, `body`, `created_at`, index'i (`idx_comments_activity`) ve RLS SELECT politikası (`comments_select_all`) bile hazır. Yeni bir `feed_activity_comments` tablosu açıp aynı şeyi ikinci kez kurmak yerine, bu dormant tabloyu **iki kolon ekleyerek** (`spoiler`, `like_count`) canlandırıyoruz — daha az kod, daha az kafa karışıklığı, sıfırdan aynısını inşa etmenin israfı yok.

Karakter sınırı: **500**, üç katmanda (aşağıda 3.5).

### 3.3 Beğeniler — iki yeni, sade tablo
`feed_activity_likes` (aktivite beğenisi) ve `feed_comment_likes` (yorum beğenisi) — polymorphic/tek-tablo-hepsi-içinde tasarım yerine iki küçük, apaçık tablo tercih edildi (projenin "üç benzer satır, erken soyutlamadan iyidir" ilkesiyle uyumlu). İkisi de `UNIQUE(hedef_id, user_id)` ile çift beğenmeyi engelliyor.

### 3.4 Sayaçlar — Postgres trigger (kullanıcının önerisi, doğru çözüm)
`feed_activities.like_count` / `comment_count`, `comments.like_count` — `AFTER INSERT/DELETE` trigger'larıyla otomatik güncellenir. Uygulama asla `COUNT(*)` sorgusu atmaz, akış tek sorguda hazır sayılarla gelir. Projede ilk trigger kullanımı bu, ama yabancı değil: `supabase/schema/014_feed_retention.sql`'deki `pg_cron` + `security definer` fonksiyon deseninin doğal devamı.

### 3.5 500 karakter sınırı — 3 katman
1. **DB (gerçek kaynak):** `CHECK (char_length(body) <= 500)` — Worker atlanıp doğrudan Supabase'e yazılsa bile durur.
2. **Worker:** kullanıcıya anlaşılır hata mesajı.
3. **UI:** canlı karakter sayacı, gönder butonunu erken devre dışı bırakır.

### 3.6 Spoiler
Yazarken switch, kartta/yorumda varsayılan bulanık + "Spoiler var, görmek için dokun". Açma durumu **sunucuya kaydedilmez** — yalnızca ekran state'i, gereksiz bir DB alanı olmasın.

---

## 4) Engelleme (Block) mimarisi

### 4.1 Tablo
`user_blocks`: `id, blocker_id → users(id) CASCADE, blocked_id → users(id) CASCADE, created_at, UNIQUE(blocker_id, blocked_id), CHECK(blocker_id != blocked_id)` — `user_follows`'taki (artık kaldırılmış ama emsal) `CHECK (follower_id != following_id)` deseniyle birebir aynı mantık.

### 4.2 Trakt Takip vs. KaymakTV Engel — KESİN KARAR
**Engel, görünürlükte takipten her zaman üstündür. KaymakTV'nin engeli Trakt'a hiç dokunmaz.** Kullanıcı Trakt'ta hâlâ takip ediyor/takip ediliyor olabilir — KaymakTV arayüzü bunu önemsemez, yalnızca kendi `user_blocks` tablosuna bakar. Trakt salt bir veri sağlayıcı; onun sosyal grafiğine müdahale etmek proje felsefesine aykırı (bkz. `docs/feed.md` "Mimari Pivot" bölümü — aynı gerekçeyle follow sistemi de Trakt'a bırakılmıştı).

### 4.3 Filtreleme — 5 okuma noktası (hepsi AYNI blocked-id kümesini paylaşmalı)
1. Ana akış (`getVisibleUserIds`)
2. Yorum listesi
3. Profil sayfası ("Bu profili görüntüleyemezsiniz" kilidi)
4. **Realtime** (`useFeedRealtime.ts`) — atlanırsa engellenen kişinin yeni paylaşımı sayfa yenilenince görünmez ama WebSocket'ten CANLI sızar.
5. **Dizi/film sayfasındaki inceleme listesi** (`feedApi.fetchMediaReviews`) — *2026-08-16'da eklendi, bkz. `docs/REVIEWS_PLAN.md` §4.4.* Atlanırsa engellediğin kişinin incelemesi ana akışta görünmez ama **HER dizi sayfasında** karşına çıkar.

Beşi de aynı yardımcı fonksiyonu (`getBlockedUserIds()`) paylaşmalı, `getVisibleUserIds` ile aynı önbellekleme deseninde.

> ⚠️ 5. nokta diğer dördünden **yapısal olarak farklı**: orada "görünür kullanıcılar"
> sonlu bir kümedir ve engellenenler o kümeden ÇIKARILIR (`Set.delete`). Bir yapımın
> inceleme listesinde ise herkes görünürdür — çıkarılacak bir küme yok, bu yüzden
> dışlama SORGUYA taşınır (`user_id=not.in.(...)`). Bellekte filtrelemek sayfa
> kotasını engellenen kayıtlarla harcardı.

### 4.4 Yazma tarafı koruması (UI gizlemek yetmez)
Worker'ın `/feed/comment` ve `/feed/like` uç noktaları, işlemi kabul etmeden önce "aktivite/yorum sahibiyle işlemi yapan arasında `user_blocks` kaydı var mı" diye kontrol etmeli. UI butonu gizlemek yalnızca kazara tıklamayı önler — biri doğrudan API'ye istek atarsa (UI'ı hiç kullanmadan) bu kontrol olmadan engel bir "öneri" olmaktan öteye geçmez.

### 4.5 UI
Profilde "..." menüsü → "Kullanıcıyı Engelle"; engellenen profil kilit ekranı; Ayarlar → "Engellenen Kullanıcılar" listesi (kaldırma seçeneğiyle). Bu faz Worker/UI turunda ele alınacak.

---

## 5) Veri temizliği (retention) — ek iş GEREKMİYOR

Mevcut `014_feed_retention.sql` zaten yeterli:
- Bir `feed_activities` satırı kullanıcı-başı 200 eşiğini aşıp gece silinince, `comments`/`feed_activity_likes`'taki ilgili satırlar `ON DELETE CASCADE` ile **otomatik** gider — ayrı bir cron job'a gerek yok.
- Beğeniler zaten kendi kendini temizler (toggle — geri alınca satır direkt silinir, birikmez).
- **Yorumlar zaman bazlı SİLİNMEZ** — kullanıcının bilerek yazdığı içerik, otomatik log değil. Yalnızca üç yoldan gider: kullanıcı kendi siler, ana aktivite CASCADE ile silinir, ya da "Bildir" → geliştirici Supabase Table Editor'den elle kaldırır (bu ölçekte otomatik moderasyon sistemi gereksiz).
- Hesap silme (mevcut `/account/delete`) zaten `users` satırını silip CASCADE'i tetikliyordu — yeni tablolar da aynı zincirin parçası olduğu için **ek kod gerekmeden** kapsanıyor.

---

## 6) Migration sırası

- `supabase/schema/015_feed_social.sql` — not/alıntı, yorum (mevcut `comments` tablosunu genişletme), beğeniler, sayaç trigger'ları, realtime genişletmesi (`comments` tablosu).
- `supabase/schema/016_user_blocks.sql` — engelleme tablosu.

İkisi ayrı dosya: biri sorun çıkarırsa diğerini etkilemeden geri alınabilir (kullanıcının onayladığı gerekçe).

---

## 7) Kapsam durumu

**Bu doküman yazıldığında "sonraki tur"a bırakılmış ve O ZAMANDAN BERİ TAMAMLANMIŞ olanlar** (Madde 155'te uygulandı, burada tarihsel doğruluk için bırakıldı):
- ✅ Worker uç noktaları (`/feed/note`, `/feed/comment`, `/feed/comment/delete`, `/feed/like`, `/feed/block`, `/feed/unblock` + engel kontrolleri)
- ✅ React Native UI (kart altı ❤️/💬 satırı, yorum sheet'i, engel butonu, Ayarlar → Engellenen Kullanıcılar)
- ✅ `useFeedRealtime.ts` genişletmesi (UPDATE dinleme + blok filtresi; DELETE de Madde 162'de eklendi)

**Sonradan değişen (bu doküman yazıldıktan sonra):**
- **İnceleme (`reviewed`) tipi eklendi** (2026-08-16, bkz. `docs/REVIEWS_PLAN.md`). §2'deki "Yorum — Trakt'ın kendi yorum sistemiyle karışmaz, tamamen ayrı" ifadesi **artık HER ŞEY için geçerli**: inceleme de yanıtlar da yalnızca bizim veritabanımızda yaşıyor. (Kısa bir dönem inceleme "dual-write"tı — Trakt API'nin ücretlendirmeye geçmesiyle o mimari terk edildi.)
- §4.3'teki okuma noktası sayısı 4 → **5** (dizi/film sayfasındaki inceleme listesi).

**Hâlâ v1 kapsamı DIŞINDA (bilinçli):**
- Yanıt (nested comment) — yorumlar tek seviyeli.
- Gerçek push bildirimi — beğeni/yorum geldiğinde bildirim yok.
- Tür bazlı gizlilik (ör. "pembe dizileri paylaşma") — yalnızca izleme/puanlama ayrımı var.
- Maraton kartına not/yorum/beğeni — sentetik gruplama olduğu için hedefi belirsiz (bkz. Madde 156).

---

## 8) İlgili dosyalar

- `supabase/schema/001_feed_schema.sql` — orijinal `comments` tablosu (şimdi canlandırılıyor)
- `supabase/schema/014_feed_retention.sql` — trigger/cron deseninin emsali
- `docs/feed.md` — ana tasarım dokümanı
- `features/feed/services/feedApi.ts` — `getVisibleUserIds` (blok filtresinin ekleneceği yer)
- `features/feed/hooks/useFeedRealtime.ts` — realtime genişlemesinin ekleneceği yer

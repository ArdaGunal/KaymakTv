-- ═══════════════════════════════════════════════════════════════════════════
-- 025 — Veri Bütünlüğü Düzeltmeleri (Sistem Denetimi bulguları)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam: 4 alt ajanla yapılan sistem denetimi (2026-08-18). Üç bulgu, üçü de
-- Worker deploy'undan BAĞIMSIZ. Ayrıntı: docs/HISTORY.md Madde 190.
--
-- ⚠️ Bu dosyada BİLİNÇLİ OLARAK OLMAYAN bir düzeltme var: `watched_movie` için
-- unique index (denetim bulgusu B2). Gerekçe: kısıt eklenirse senkronun TOPLU
-- INSERT'i (`supabaseInsert(env,"feed_activities",newWatchedRows)`) tek bir
-- çakışan satır yüzünden TÜM partiyi düşürür ve 502 döner. Önce Worker'ın
-- tek-tek INSERT + 23505 yutma desenine geçmesi gerekiyor. Kısıtı tek başına
-- eklemek yeni bir kırılganlık yaratır — bkz. MASTER_PLAN "SONRADAN BULUNANLAR".
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) `uq_feed_rated` — `media_type` EKSİKTİ (denetim: B1)
-- ─────────────────────────────────────────────────────────────────────────
-- 🔴 SORUN: `003`/`005`'teki kısıt `(user_id, show_id)` üzerinde. Ama Trakt
-- id'leri DİZİ ve FİLM için AYRI uzaylardan geliyor — aynı sayı ikisinde de
-- geçerli olabilir ve ikisi de aynı `show_id` kolonunda saklanıyor.
--
-- Proje bunu ÜÇ YERDE doğru tespit etmiş, kısıtı hiç düzeltmemiş:
--   • Worker `ratedKeyOf(showId, mediaType)` — dedup anahtarı media_type İÇERİYOR
--   • `013_realtime_feed.sql` — `deleted_feed_activities`'e media_type ekledi
--   • `handleFeedSync`'teki yorumlar
--
-- TETİKLENDİĞİNDE NE OLUR (kalıcı hasar):
--   1. Kullanıcı X, trakt-show 614'e (Futurama) puan verir → satır yazılır
--   2. Aynı kullanıcı trakt-movie 614'e (Home Alone) puan verir
--   3. Worker `"614|movie"` anahtarını mevcut `"614|show"` ile eşleştiremez
--      → YENİ satır sayar → düz INSERT
--   4. Postgres `uq_feed_rated (user_id, show_id)` ihlali → 23505
--   5. `handleFeedSync` `writeError` dalına düşer → HTTP 502
--   6. HER SONRAKİ SENKRON aynı INSERT'i üretir → o kullanıcının akışı bir
--      daha ASLA güncellenmez. Kendi kendini onarmaz.
--
-- Canlıda ölçüldü (2026-08-18): `rated` satırlarında çakışma YOK — yani açık
-- henüz tetiklenmemiş. Kapatmak için doğru an.

-- Ön kontrol: çakışma varsa migration DURMALI (kısıt oluşturulamaz zaten,
-- ama sebebi anlaşılır bir mesajla söylensin).
DO $$
DECLARE dup_count INT;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT 1 FROM feed_activities
    WHERE activity_type = 'rated'
    GROUP BY user_id, show_id
    HAVING count(DISTINCT media_type) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      '025 DURDURULDU: % adet (user_id, show_id) çifti hem dizi hem film puanı taşıyor. '
      'Yeni kısıt bunları kabul etmez. Önce incele: '
      'SELECT user_id, show_id, array_agg(media_type), array_agg(show_title) '
      'FROM feed_activities WHERE activity_type = ''rated'' '
      'GROUP BY 1,2 HAVING count(DISTINCT media_type) > 1;', dup_count;
  END IF;
END $$;

DROP INDEX IF EXISTS uq_feed_rated;
CREATE UNIQUE INDEX uq_feed_rated
  ON feed_activities (user_id, show_id, media_type)
  WHERE activity_type = 'rated';

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Retention: `rated` muafiyeti (denetim: B4)
-- ─────────────────────────────────────────────────────────────────────────
-- 🔴 SORUN: `014`'ün "sonsuz döngü yapısal olarak imkânsız" gerekçesi
-- `rated` için GEÇERSİZ. O gerekçe şuydu: "senkronun eriştiği pencere (50)
-- her zaman korunan pencerenin (200) İÇİNDE kalır."
--
-- Bu YALNIZCA `watched_*` için doğru — orada Trakt son 50 kaydı döndürüyor.
-- `rated` için Trakt **LİMİTSİZ** tüm puanları döndürüyor (Worker'ın kendi
-- yorumu: "rated: Trakt her seferinde TÜM güncel puanları döndürüyor").
--
-- DÖNGÜ:
--   1. Aktif kullanıcının eski `rated` satırları 200. sıranın altına düşer
--   2. Gece prune → SİLİNİR (muafiyet listesinde yok)
--   3. Sabah senkron → Trakt hepsini döndürür → GERİ EKLENİR
--   4. `activity_at = r.rated_at` (orijinal eski damga) → yine 200 altında
--   5. Ertesi gece → 2'ye dön
--
-- ASIL ZARAR (Madde 185'in birebir aynısı): her döngüde satır YENİ bir `id`
-- alır. `feed_activity_likes` ve `comments` ON DELETE CASCADE bağlı →
-- o karta yapılmış TÜM beğeni ve yorumlar her gece KALICI olarak yok olur.
--
-- Canlıda ölçüldü: bir kullanıcı TAM 200 satırda — sınırın üstünde.
--
-- ÖLÇEK RİSKİ YOK: `rated` zaten yapım başına TEK satırla sınırlı
-- (yukarıdaki `uq_feed_rated`), sınırsız büyüyemez. Muafiyet `014`'ün
-- gerekçesini zayıflatmıyor — tam tersine, o gerekçenin `rated` için hiç
-- geçerli olmadığını kabul ediyor.
CREATE OR REPLACE FUNCTION public.prune_feed_activities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        -- `id` ikincil anahtar: toplu sezon işaretlemesinde TÜM bölümler AYNI
        -- `activity_at` damgasını alır; tek anahtarla sıralama deterministik
        -- olmaz ve her çalıştırmada farklı satırlar silinirdi.
        PARTITION BY user_id
        ORDER BY activity_at DESC, id DESC
      ) AS rn
    FROM feed_activities
    -- 018: elle yazılmış içerik ('posted','reviewed') sıralamaya HİÇ girmiyor.
    -- 025: 'rated' EKLENDİ — yukarıdaki döngü gerekçesi.
    WHERE activity_type NOT IN ('posted', 'reviewed', 'rated')
  )
  DELETE FROM feed_activities fa
  USING ranked r
  WHERE fa.id = r.id
    AND r.rn > 200;

  GET DIAGNOSTICS deleted_count = row_count;
  RAISE NOTICE 'prune_feed_activities: % satir silindi', deleted_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) `feed_activities.is_visible` — moderasyon gizlemesi KENDİ kolonuna
-- ─────────────────────────────────────────────────────────────────────────
-- 🔴 SORUN (denetim: B3): `in_feed` ÜÇ kural taşıyor ama kuralların GÖRÜNÜRLÜK
-- KAPSAMLARI aynı değil:
--
--   (a) 020 · bölüm incelemesi     → akışta gizli, BÖLÜM SAYFASINDA görünmeli
--   (b) 021 · yazar gizliyor       → akışta gizli, YAPIM SAYFASINDA görünmeli
--   (c) 024 · 3+ bildirim          → HER YERDE gizlenmeli
--
-- Üçü `AND` ile tek kolona bindiği için, (a) ve (b)'nin yaşaması adına
-- `fetchMediaReviews` filtreyi bilinçli olarak UYGULAMIYOR — ve bu 021 için
-- DOĞRUYDU. Ama 024 aynı kapıya daha GENİŞ kapsamlı bir kural bindirdi.
--
-- Sonuç: 3 kişinin bildirdiği bir inceleme akıştan düşüyor ama dizi/film
-- sayfasında DURUYOR — üstelik orada takip filtresi de yok, yani uygulamadaki
-- EN GENİŞ kitleye açık. "Bildirilen içerik kaldırılır" iddiası fiilen yanlış.
--
-- ÇÖZÜM: moderasyon kuralını ayrı bir kolona al. `comments.is_visible` (024)
-- ile birebir simetrik — aynı isim, aynı anlam, aynı yön (pozitif).
--
-- ⚠️ MANTIK TEKRARI BİLİNÇLİ: `in_feed` de `report_count < 3` içermeye devam
-- ediyor. Bir GENERATED kolon başka bir GENERATED kolona referans veremez;
-- ikisi de `report_count`'a DOĞRUDAN bakıyor. Eşik değişirse İKİSİ BİRDEN
-- güncellenmeli (024'teki eşik notu buraya da geçerli).
ALTER TABLE feed_activities DROP COLUMN IF EXISTS is_visible;
ALTER TABLE feed_activities
  ADD COLUMN is_visible BOOLEAN
  GENERATED ALWAYS AS (report_count < 3) STORED;

-- ⚠️ İSTEMCİ SERT BAĞIMLILIĞI: `feedApi.ts` → `fetchMediaReviews` bu kolona
-- `.eq('is_visible', true)` filtresi ekliyor. Bu migration çalıştırılmadan
-- istemci güncellenirse yapım sayfası inceleme listesi "kolon yok" hatası
-- verir. SIRA: önce migration, sonra istemci.

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması
-- ─────────────────────────────────────────────────────────────────────────
--   1) uq_feed_rated artık media_type içeriyor mu?
--     SELECT indexdef FROM pg_indexes
--     WHERE tablename='feed_activities' AND indexname='uq_feed_rated';
--     -- indexdef'te "media_type" GEÇMELİ
--
--   2) Retention muafiyeti uygulandı mı? (t dönmeli)
--     SELECT prosrc LIKE '%''rated''%' FROM pg_proc
--     WHERE proname = 'prune_feed_activities';
--
--   3) is_visible geldi mi ve türetilmiş mi?
--     SELECT column_name, is_generated, generation_expression
--     FROM information_schema.columns
--     WHERE table_name='feed_activities' AND column_name='is_visible';
--
--   4) Bu gece prune neyi silecekti (artık silmeyecek)?
--     WITH ranked AS (
--       SELECT user_id, activity_type,
--              row_number() OVER (PARTITION BY user_id ORDER BY activity_at DESC, id DESC) rn
--       FROM feed_activities WHERE activity_type NOT IN ('posted','reviewed')
--     )
--     SELECT user_id, count(*) FILTER (WHERE activity_type='rated') AS kurtarilan
--     FROM ranked WHERE rn > 200 GROUP BY 1 HAVING count(*) FILTER (WHERE activity_type='rated') > 0;
--
--   5) Moderasyon gizlemesi artık yapım sayfasında da geçerli mi?
--     SELECT id, activity_type, report_count, in_feed, is_visible
--     FROM feed_activities WHERE report_count > 0;
--     -- report_count >= 3 olan satırlarda is_visible = false OLMALI

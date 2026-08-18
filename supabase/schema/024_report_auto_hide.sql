-- ═══════════════════════════════════════════════════════════════════════════
-- 024 — Rapor Sayacı + Otomatik Gizleme (F10)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam: docs/MASTER_PLAN.md F10 · el kitabı: docs/MODERATION.md
--
-- ⚠️ ÖN KOŞUL: `023_content_reports_integrity.sql` ÇALIŞTIRILMIŞ OLMALI.
-- Bu migration'ın tamamı, bir hedefe ait bildirim sayısının GERÇEK KİŞİ SAYISI
-- olduğu varsayımına dayanıyor. O varsayımı `023`'teki
-- `UNIQUE(reporter_user_id, target_type, target_id)` + `NOT NULL` sağlıyor.
-- 023 olmadan tek kişi sınırsız bildirim atıp eşiği tek başına aşabilirdi —
-- yani bu dosya, 023 olmadan doğrudan bir SANSÜR ARACINA dönüşür.
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- 0) EŞİK
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ Bu sayı üç yerde birden GEÇERLİ ve hepsi aşağıda, TEK dosyada:
--   • feed_activities.in_feed         (GENERATED ifadesi)
--   • comments.is_visible             (GENERATED ifadesi)
--   • docs/MODERATION.md              (belgelenmiş davranış)
--
-- GENERATED ifadeleri sabit gerektirdiği için eşik `app_settings`'ten
-- OKUNAMAZ — değiştirmek küçük bir migration ister (ifadeleri DROP+ADD).
-- Bu bilinçli: eşiğin çalışma zamanında değişebilmesi, moderasyon
-- davranışını sessizce kaydırabilecek bir kaldıraç olurdu.
--
-- Kullanıcı kararı (2026-08-18): **3 farklı kişi**.
--
-- 🔴 DÜRÜST NOT: bugünkü ölçekte (10'dan az kullanıcı) bu eşik pratikte
-- TETİKLENMEYECEK. F10'un bugünkü değeri işlevsel değil ALTYAPISAL:
-- Google Play/App Store'un UGC moderasyonu beklentisi ve ölçek büyüdüğünde
-- hazır olmak.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Sayaç kolonları
-- ─────────────────────────────────────────────────────────────────────────
-- "AÇIK (open) bildirim sayısı" — toplam değil. Bu ayrım İTİRAZ YOLUNUN ta
-- kendisi: moderatör bir bildirimi `dismissed` yaptığında sayaç düşer ve
-- içerik KENDİLİĞİNDEN geri gelir. Silme değil gizleme olduğu için geri
-- dönüş bedava.
ALTER TABLE feed_activities ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0;
ALTER TABLE comments        ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Trigger — sayacı YENİDEN HESAPLAR (artırma/azaltma DEĞİL)
-- ─────────────────────────────────────────────────────────────────────────
-- `015`'teki `bump_activity_like_count` artırma/azaltma yapıyor çünkü orada
-- "beğeni" iki durumlu: var veya yok. Burada ÜÇÜNCÜ bir eksen var — `status`
-- (`open`/`reviewed`/`dismissed`). Bir bildirimin durumu değiştiğinde
-- artırma/azaltma mantığı hangi yöne gideceğini bilemez ve zamanla ıraksar.
-- Yeniden hesaplama, INSERT/DELETE/status-UPDATE'in ÜÇÜNÜ de tek yoldan
-- doğru sonuca götürüyor. Maliyeti düşük: hedef başına bir COUNT.
CREATE OR REPLACE FUNCTION public.sync_report_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tgt_type TEXT;
  tgt_id   TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    tgt_type := OLD.target_type;
    tgt_id   := OLD.target_id;
  ELSE
    tgt_type := NEW.target_type;
    tgt_id   := NEW.target_id;
  END IF;

  IF tgt_type = 'activity' THEN
    UPDATE feed_activities
    SET report_count = (
      SELECT count(*) FROM content_reports
      WHERE target_type = 'activity' AND target_id = tgt_id AND status = 'open'
    )
    WHERE id::text = tgt_id;
  ELSIF tgt_type = 'comment' THEN
    UPDATE comments
    SET report_count = (
      SELECT count(*) FROM content_reports
      WHERE target_type = 'comment' AND target_id = tgt_id AND status = 'open'
    )
    WHERE id::text = tgt_id;
  END IF;
  -- 'trakt_comment': içerik bizde değil, güncellenecek satır yok.

  RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_content_reports_sync_count ON content_reports;
CREATE TRIGGER trg_content_reports_sync_count
  AFTER INSERT OR DELETE OR UPDATE OF status ON content_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_report_count();

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Mevcut bildirimler için geri doldurma
-- ─────────────────────────────────────────────────────────────────────────
-- Trigger yalnızca BUNDAN SONRAKİ değişiklikleri yakalar; hâlihazırda
-- kayıtlı bildirimlerin sayacı burada kurulur.
UPDATE feed_activities fa
SET report_count = c.cnt
FROM (
  SELECT target_id, count(*) AS cnt FROM content_reports
  WHERE target_type = 'activity' AND status = 'open' GROUP BY target_id
) c
WHERE fa.id::text = c.target_id AND fa.report_count IS DISTINCT FROM c.cnt;

UPDATE comments cm
SET report_count = c.cnt
FROM (
  SELECT target_id, count(*) AS cnt FROM content_reports
  WHERE target_type = 'comment' AND status = 'open' GROUP BY target_id
) c
WHERE cm.id::text = c.target_id AND cm.report_count IS DISTINCT FROM c.cnt;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) `in_feed` — üçüncü kural ekleniyor
-- ─────────────────────────────────────────────────────────────────────────
-- GENERATED ifadesi ALTER ile değiştirilemez → DROP + ADD (021'deki aynı
-- gerekçe). Akış sorgusu YİNE DEĞİŞMİYOR: `in_feed` hâlâ tek kapı.
--
-- Kurallar sırasıyla:
--   (a) 020 — bölüm incelemeleri ana akışa düşmez
--   (b) 021 — yazarı elle yazdığı içeriği gizliyorsa düşmez
--   (c) 024 — 3+ farklı kişi bildirdiyse düşmez   ← YENİ
ALTER TABLE feed_activities DROP COLUMN IF EXISTS in_feed;
ALTER TABLE feed_activities
  ADD COLUMN in_feed BOOLEAN
  GENERATED ALWAYS AS (
    NOT (activity_type = 'reviewed' AND episode_number IS NOT NULL)
    AND NOT (activity_type IN ('reviewed', 'posted') AND author_hides_manual)
    AND report_count < 3
  ) STORED;

-- ─────────────────────────────────────────────────────────────────────────
-- 5) `comments.is_visible` — yorumlar için karşılığı
-- ─────────────────────────────────────────────────────────────────────────
-- POZİTİF isimlendirme (`is_visible`, `is_hidden` değil) bilinçli: `in_feed`
-- ile aynı yönde okunuyor, istemcide `.eq('is_visible', true)` şeklinde
-- `in_feed` filtresiyle simetrik duruyor. Ters isimlendirme, F14'teki
-- "iki zıt yön" karışıklığının aynısını üretirdi.
ALTER TABLE comments DROP COLUMN IF EXISTS is_visible;
ALTER TABLE comments
  ADD COLUMN is_visible BOOLEAN
  GENERATED ALWAYS AS (report_count < 3) STORED;

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması
-- ─────────────────────────────────────────────────────────────────────────
--   Kolonlar ve türetilmiş ifadeler geldi mi?
--     select table_name, column_name, is_generated, generation_expression
--     from information_schema.columns
--     where (table_name='feed_activities' and column_name in ('report_count','in_feed'))
--        or (table_name='comments'        and column_name in ('report_count','is_visible'));
--
--   Trigger kurulu mu?
--     select tgname from pg_trigger where tgname = 'trg_content_reports_sync_count';
--
--   ✅ CANLI ZİNCİR TESTİ — bunu mutlaka çalıştır:
--     -- 1) Bir aktiviteye 3 SAHTE bildirim ekle (farklı kullanıcılarla!)
--     --    Not: 023'teki UNIQUE yüzünden aynı kullanıcı 3 kez ekleyemez.
--     select id, report_count, in_feed from feed_activities where id = '<AKTİVİTE_ID>';
--     -- report_count = 3, in_feed = false OLMALI
--
--     -- 2) İTİRAZ YOLU: bildirimlerden birini reddet
--     update content_reports set status = 'dismissed'
--     where target_id = '<AKTİVİTE_ID>' and status = 'open'
--     order by created_at limit 1;   -- (Postgres: alt sorgu ile id seçmek gerekebilir)
--     select id, report_count, in_feed from feed_activities where id = '<AKTİVİTE_ID>';
--     -- report_count = 2, in_feed = TRUE — içerik KENDİLİĞİNDEN geri geldi
--
--   Şu an gizlenmiş içerik var mı (moderasyon için):
--     select id, activity_type, report_count, left(note,60) as icerik
--     from feed_activities where report_count > 0 order by report_count desc;

-- ═══════════════════════════════════════════════════════════════════════════
-- 015 — Akış Sosyal Katmanı: Kişisel Not/Alıntı, Yorum, Beğeni, Sayaçlar
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam: docs/FEED_SOCIAL_PLAN.md — tam tasarım kararları orada. Bu dosya
-- yalnızca DB katmanı. Worker uç noktaları ve React Native UI AYRI bir turda
-- (kullanıcının açık isteği: "acele başlamak istemiyorum").
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Idempotent (IF NOT EXISTS /
-- CREATE OR REPLACE / DO blokları) — yanlışlıkla iki kez çalıştırmak
-- zararsızdır.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Kişisel Not/Alıntı — feed_activities'in ÜZERİNE, ayrı tablo DEĞİL
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN AYRI TABLO DEĞİL: Not, o aktivitenin 1:1 bir parçası (Letterboxd
-- mantığı: log + kişisel yorum aynı satırda). Ayrı tablo yalnızca kart
-- çizerken gereksiz bir join ekler.
ALTER TABLE feed_activities
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS note_spoiler BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count INT NOT NULL DEFAULT 0;

-- Yorumlarla AYNI 500 karakter sınırı — not da serbest metin, aynı spam
-- gerekçesi geçerli (bkz. aşağıdaki 500 karakter notu).
ALTER TABLE feed_activities DROP CONSTRAINT IF EXISTS feed_activities_note_length;
ALTER TABLE feed_activities
  ADD CONSTRAINT feed_activities_note_length CHECK (note IS NULL OR char_length(note) <= 500);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Yorumlar — YENİ TABLO AÇMIYORUZ, var olan `comments`'i canlandırıyoruz
-- ─────────────────────────────────────────────────────────────────────────
-- KEŞİF: 001_feed_schema.sql'de "Phase 2'de kullanılacak, şimdiden şema
-- hazır (boş kalacak)" notuyla açılmış ama HİÇ kullanılmayan bir `comments`
-- tablosu var — activity_id/user_id CASCADE FK'leri, index'i
-- (idx_comments_activity) ve RLS SELECT politikası (comments_select_all)
-- ZATEN kurulu. Yeni bir feed_activity_comments tablosu açıp aynısını ikinci
-- kez inşa etmek yerine bu tabloyu iki kolonla tamamlıyoruz.
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS spoiler BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;

-- 500 karakter — DB katmanı GERÇEK KAYNAK. Worker/UI kendi sınırlarını ayrı
-- ayrı uygulayacak (bkz. docs/FEED_SOCIAL_PLAN.md §3.5) ama bu satır, biri
-- Worker'ı atlayıp doğrudan Supabase'e yazsa bile son savunma hattı.
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_body_length;
ALTER TABLE comments
  ADD CONSTRAINT comments_body_length CHECK (char_length(body) >= 1 AND char_length(body) <= 500);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Beğeniler — iki sade tablo (polymorphic tek tablo yerine)
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN İKİ AYRI TABLO: Aktivite beğenisi ile yorum beğenisi farklı hedef
-- tablolara FK verir (feed_activities vs comments). Tek "polymorphic" tabloda
-- (target_type + target_id) bunu ifade etmek CASCADE'i DB seviyesinde
-- kırar — hedef silindiğinde otomatik temizlik için app-katmanı temizlik
-- kodu yazmak gerekirdi. İki küçük, apaçık tablo daha az kod ve daha güvenli.
CREATE TABLE IF NOT EXISTS feed_activity_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES feed_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_activity_likes_activity ON feed_activity_likes(activity_id);

ALTER TABLE feed_activity_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_activity_likes_select_all" ON feed_activity_likes;
CREATE POLICY "feed_activity_likes_select_all" ON feed_activity_likes
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS feed_comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_comment_likes_comment ON feed_comment_likes(comment_id);

ALTER TABLE feed_comment_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_comment_likes_select_all" ON feed_comment_likes;
CREATE POLICY "feed_comment_likes_select_all" ON feed_comment_likes
  FOR SELECT
  USING (true);

-- Yazma politikası YOK (diğer tüm tablolarla aynı desen, bkz. 001) — bu
-- proje Supabase Auth kullanmadığı için auth.uid() tabanlı satır sahipliği
-- çalışmaz. Beğen/beğenme yalnızca Worker'ın service_role anahtarıyla
-- (RLS'i bypass ederek) yazılır — Worker karşı tarafla blok ilişkisi olup
-- olmadığını kontrol ettikten SONRA (bkz. docs/FEED_SOCIAL_PLAN.md §4.4,
-- sonraki turda uygulanacak).

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Sayaçlar — trigger ile otomatik (kullanıcının önerisi)
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN: 15 kart yüklenince her biri için "beğeni/yorum tablosunu say" 15
-- ayrı COUNT(*) sorgusu demek — akışı felç eder. Bunun yerine sayaç
-- feed_activities/comments satırının ÜZERİNDE hazır tutulur, tek sorguda
-- gelir. Eşzamanlı beğenmelerde kayıp güncelleme riski yok — Postgres'te
-- `SET x = x + 1` satır bazlı atomik bir işlemdir.
--
-- SECURITY DEFINER: 014_feed_retention.sql'deki prune fonksiyonlarıyla AYNI
-- gerekçe — tetikleyen isteği hangi rol yaparsa yapsın (anon veya
-- service_role), sayaç güncellemesi RLS'e takılmadan çalışsın.
--
-- GREATEST(...,0): UNIQUE kısıtı çift-silmeyi zaten imkânsız kılıyor ama
-- negatife düşmeyi engelleyen ucuz bir güvenlik payı.

CREATE OR REPLACE FUNCTION public.bump_activity_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feed_activities SET like_count = like_count + 1 WHERE id = NEW.activity_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feed_activities SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.activity_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_feed_activity_likes_count ON feed_activity_likes;
CREATE TRIGGER trg_feed_activity_likes_count
  AFTER INSERT OR DELETE ON feed_activity_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_activity_like_count();

CREATE OR REPLACE FUNCTION public.bump_activity_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feed_activities SET comment_count = comment_count + 1 WHERE id = NEW.activity_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feed_activities SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.activity_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comments_count ON comments;
CREATE TRIGGER trg_comments_count
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_activity_comment_count();

CREATE OR REPLACE FUNCTION public.bump_comment_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_feed_comment_likes_count ON feed_comment_likes;
CREATE TRIGGER trg_feed_comment_likes_count
  AFTER INSERT OR DELETE ON feed_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_comment_like_count();

-- ─────────────────────────────────────────────────────────────────────────
-- 5) Realtime — yorumlar canlı düşsün
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN feed_activity_likes/feed_comment_likes BURADA YOK: beğeni/beğenmeme
-- zaten yukarıdaki trigger'lar aracılığıyla feed_activities.like_count /
-- comments.like_count alanını günceller — bu iki tablo `013_realtime_feed.sql`
-- ile ZATEN yayında (feed_activities) veya aşağıda yayına ekleniyor
-- (comments). Client, ham beğeni tablolarına değil, UPDATE olaylarıyla gelen
-- sayaç değişimine abone olacak (bkz. Worker/UI turu) — bu yüzden çıplak
-- likes tablolarını publication'a eklemek gereksiz ek yüzey olurdu.
ALTER TABLE comments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması (isteğe bağlı — SQL Editor'de tek tek çalıştırılabilir)
-- ─────────────────────────────────────────────────────────────────────────
--   Yeni kolonlar geldi mi?
--     select column_name from information_schema.columns
--     where table_name = 'feed_activities' and column_name in ('note','note_spoiler','like_count','comment_count');
--     select column_name from information_schema.columns
--     where table_name = 'comments' and column_name in ('spoiler','like_count');
--
--   Trigger'lar kuruldu mu?
--     select tgname from pg_trigger where tgname like 'trg_%count%';
--
--   Realtime'a eklendi mi?
--     select tablename from pg_publication_tables where pubname = 'supabase_realtime';

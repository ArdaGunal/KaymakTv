-- KaymakTV Feed (Akış) Sistemi — Phase 1 Şema
-- Bkz. docs/feed.md
--
-- Bu dosyayı Supabase Dashboard → SQL Editor'e yapıştırıp çalıştır.
--
-- ÖNEMLİ GÜVENLİK NOTU: Bu proje Supabase Auth KULLANMIYOR — kimlik doğrulama
-- Trakt OAuth üzerinden yürüyor. Bu yüzden `auth.uid()` bize hiçbir zaman
-- gerçek kullanıcı kimliği vermez (anon key ile gelen her istek Supabase'in
-- gözünde aynı "anonim" rol). Bu nedenle RLS politikaları şimdilik yalnızca
-- OKUMA (SELECT) izni veriyor; YAZMA (INSERT/UPDATE/DELETE) politikası hiç
-- eklenmedi — RLS açıkken politika yoksa varsayılan davranış "reddet"tir.
-- Yazma güvenliği (kimin adına yazıldığını doğrulama), senkronizasyon servisi
-- (docs/feed.md Adım 2) inşa edilirken ayrıca karara bağlanacak.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) users — Trakt kullanıcısının Supabase'deki "aynası"
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trakt_id BIGINT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_trakt_id ON users(trakt_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_all" ON users
  FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) user_follows — Tek yönlü takip ilişkisi (Follow, Friendship değil)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_follows_following ON user_follows(following_id);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_follows_select_all" ON user_follows
  FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) feed_activities — İzleme aktivitesi logu (Phase 1: 4 tip)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE feed_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (
    activity_type IN ('watched_episode', 'started_show', 'completed_show', 'rated')
  ),
  show_id BIGINT NOT NULL, -- Trakt show ID
  show_title TEXT NOT NULL,
  show_poster_url TEXT,
  episode_number TEXT, -- "S03E04" (yalnızca watched_episode)
  rating SMALLINT CHECK (rating BETWEEN 1 AND 10), -- yalnızca rated
  activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- olayın gerçekleştiği an (Trakt'tan gelir)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- bu satırın DB'ye yazıldığı an
);

CREATE INDEX idx_feed_activities_user_time ON feed_activities(user_id, activity_at DESC);
CREATE INDEX idx_feed_activities_time ON feed_activities(activity_at DESC);

ALTER TABLE feed_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_activities_select_all" ON feed_activities
  FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────
-- 4) comments — Phase 2'de kullanılacak, şimdiden şema hazır (boş kalacak)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES feed_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_activity ON comments(activity_id, created_at);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_all" ON comments
  FOR SELECT
  USING (true);

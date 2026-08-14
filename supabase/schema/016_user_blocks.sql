-- ═══════════════════════════════════════════════════════════════════════════
-- 016 — Kullanıcı Engelleme (Block) — KaymakTV'ye özel, Trakt'a dokunmaz
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam: docs/FEED_SOCIAL_PLAN.md §4 — tam tasarım kararları orada.
-- Ayrı bir migration olarak 015'ten BİLİNÇLİ OLARAK bölündü: biri sorun
-- çıkarırsa diğerini etkilemeden geri alınabilsin (kullanıcının kararı).
--
-- KESİN KARAR (kullanıcı onayı): Engel, görünürlükte Trakt takibinden HER
-- ZAMAN üstündür. Trakt'a HİÇ dokunulmaz — `user_blocks` yalnızca KaymakTV
-- arayüzünde (akış, yorumlar, profil, realtime, Worker yazma izinleri)
-- geçerlidir. Kullanıcı Trakt'ta hâlâ karşılıklı takipçi kalabilir; bu proje
-- Trakt'ı yalnızca bir veri sağlayıcı olarak görüyor (bkz. docs/feed.md
-- "Mimari Pivot" — follow sistemi de aynı gerekçeyle Trakt'a bırakılmıştı).
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) user_blocks
-- ─────────────────────────────────────────────────────────────────────────
-- CHECK (blocker_id != blocked_id): kendini engellemeyi DB seviyesinde
-- imkânsız kılar — `user_follows`'taki (artık kaldırılmış, bkz.
-- 004_drop_user_follows.sql) `CHECK (follower_id != following_id)` ile
-- birebir aynı desen.
-- UNIQUE (blocker_id, blocked_id): aynı kişiyi iki kez engellemeyi önler —
-- idempotent bir "engelle" isteği (çift tıklama, ağ yeniden denemesi) hata
-- vermeden no-op olmalı, Worker tarafında ON CONFLICT DO NOTHING ile
-- karşılanacak (sonraki tur).
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

-- İki ayrı indeks: "ben kimi engelledim" (blocker_id) ve "beni kim
-- engelledi" (blocked_id) sorguları EŞİT sıklıkta olacak — görünürlük
-- filtresi ikisinin BİRLEŞİMİNİ (union) alıyor (bkz. docs/FEED_SOCIAL_PLAN.md
-- §4.3: "engelleyen VEYA engellenen" kümesi).
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- ⚠️ NEDEN YİNE `USING (true)` (herkese açık okuma): Bu proje Supabase Auth
-- KULLANMIYOR (bkz. 001_feed_schema.sql başlığı) — auth.uid() hiçbir zaman
-- gerçek kullanıcı kimliği vermez, bu yüzden "yalnızca kendi blok listeni
-- oku" gibi bir RLS kısıtı bu mimaride YAZILAMAZ (diğer tüm tablolarda da
-- aynı durum). Pratik sonuç: feed_activities gibi, bu tablo da anon key ile
-- doğrudan sorgulanabilir teoride — ama bu YENİ bir risk kategorisi değil,
-- projenin zaten kabul ettiği "herkese açık oku, görünürlüğü client'ta
-- filtrele" modelinin devamı. Gerçek erişim kontrolü (kimin kimi
-- engelleyebileceği/görebileceği) Worker'ın kimlik doğrulamasında.
DROP POLICY IF EXISTS "user_blocks_select_all" ON user_blocks;
CREATE POLICY "user_blocks_select_all" ON user_blocks
  FOR SELECT
  USING (true);

-- Yazma politikası YOK — engelleme/kaldırma yalnızca Worker'ın service_role
-- anahtarıyla (RLS'i bypass ederek) yapılır, tıpkı diğer tüm yazma
-- işlemleri gibi (bkz. 001_feed_schema.sql).

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması (isteğe bağlı)
-- ─────────────────────────────────────────────────────────────────────────
--   Tablo ve kısıtlar geldi mi?
--     select conname, contype from pg_constraint where conrelid = 'user_blocks'::regclass;
--
--   Kendini engelleme gerçekten reddediliyor mu (elle test, gerçek bir
--   users.id ile):
--     insert into user_blocks (blocker_id, blocked_id) values ('<bir-id>', '<aynı-id>');
--     -- beklenen: CHECK constraint hatası

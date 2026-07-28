-- Teşhis: feed_activities tablosu tamamen boş kaldı (hem senkron olan iki
-- kullanıcı için de sıfır satır) — Worker'ın Supabase yazma isteğinin
-- yanıtını hiç kontrol etmediği bulundu (bkz. kaymaktv-feedback-worker
-- src/index.js düzeltmesi), bu da olası bir yazma hatasını tamamen
-- sessizce yutuyordu. En olası kök neden: 003_feed_activity_upsert_
-- constraints.sql hiç çalıştırılmamış olabilir — bu durumda Worker'ın
-- kullandığı `on_conflict=user_id,show_id,episode_number,activity_at` ve
-- `on_conflict=user_id,show_id` hedefleri hiçbir unique/index'e karşılık
-- gelmediği için PostgREST her upsert'i reddederdi.
--
-- Bu dosya İDEMPOTENT'tir (IF NOT EXISTS) — 003 zaten başarıyla
-- çalıştıysa bu bir NO-OP'tur, güvenle tekrar çalıştırılabilir.

CREATE UNIQUE INDEX IF NOT EXISTS uq_feed_watched_episode
  ON feed_activities (user_id, show_id, episode_number, activity_at)
  WHERE activity_type = 'watched_episode';

CREATE UNIQUE INDEX IF NOT EXISTS uq_feed_rated
  ON feed_activities (user_id, show_id)
  WHERE activity_type = 'rated';

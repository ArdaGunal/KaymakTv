-- Senkronizasyon servisi (Cloudflare Worker) her çalıştığında Trakt'tan gelen
-- geçmişi tekrar tekrar okuyup Supabase'e yazacak. Bu iki kısmi (partial)
-- unique index olmadan, her senkronizasyonda aynı aktiviteler yinelenerek
-- tekrar tekrar eklenirdi.
--
-- watched_episode: aynı bölümün aynı `activity_at` (Trakt'ın watched_at'i) ile
-- tekrar eklenmesini engeller — ama kullanıcı bölümü GERÇEKTEN yeniden izlerse
-- (farklı watched_at) bu ayrı bir aktivite olarak feed'de görünmeye devam eder.
--
-- rated: bir kullanıcı bir diziye/filme yalnızca TEK bir güncel puan
-- verebilir (Trakt'ta da öyle) — bu yüzden (user_id, show_id) üzerinde tekil;
-- yeniden puanlama var olan satırı GÜNCELLER, yeni satır eklemez.

CREATE UNIQUE INDEX uq_feed_watched_episode
  ON feed_activities (user_id, show_id, episode_number, activity_at)
  WHERE activity_type = 'watched_episode';

CREATE UNIQUE INDEX uq_feed_rated
  ON feed_activities (user_id, show_id)
  WHERE activity_type = 'rated';

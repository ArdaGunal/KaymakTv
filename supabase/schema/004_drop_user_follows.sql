-- Mimari Pivot (bkz. docs/feed.md): Kendi takip sistemimizi (`user_follows`)
-- tamamen terk ediyoruz. "Kim kimi takip ediyor" artık Trakt'ın kendi sosyal
-- grafiğinden (GET /users/me/following) okunuyor — Supabase yalnızca `users`
-- aynasını ve `feed_activities` önbelleğini tutmaya devam ediyor.
--
-- Bu tablo hiçbir zaman gerçek veri taşımadı (Madde 83'te oluşturulup Madde
-- 85'te kaldırıldı, aynı oturumlar içinde) — DROP güvenli.

DROP TABLE IF EXISTS user_follows;

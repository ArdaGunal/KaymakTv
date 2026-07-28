-- KaymakTV'ye özel gizlilik anahtarı — Trakt'taki `private` ayarından
-- BAĞIMSIZ. Kullanıcı Trakt'ta public olsa bile, yalnızca KaymakTV akışında
-- görünmek istemeyebilir. Ayarlar ekranından açılıp kapanacak (bkz.
-- kaymaktv-feedback-worker POST /feed/visibility).
ALTER TABLE users ADD COLUMN feed_hidden BOOLEAN NOT NULL DEFAULT FALSE;

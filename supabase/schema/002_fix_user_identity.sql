-- Düzeltme: 001'de `users.trakt_id BIGINT` olarak varsayılmıştı ama gerçek
-- Trakt API'si kullanıcılar için sayısal ID döndürmüyor — canlı bir istekle
-- doğrulandı: GET https://api.trakt.tv/users/{username} yanıtı yalnızca
-- `username` ve `ids.slug` (ikisi de string) içeriyor:
--   {"username":"sean","ids":{"slug":"sean"}, ...}
-- (Diziler/filmler sayısal trakt ID'sine sahip, kullanıcılar değil.)
--
-- `users` tablosu henüz boş (0 satır) olduğu için ALTER güvenli.

DROP INDEX IF EXISTS idx_users_trakt_id;

ALTER TABLE users DROP COLUMN trakt_id;
ALTER TABLE users ADD COLUMN trakt_slug TEXT UNIQUE NOT NULL;

CREATE INDEX idx_users_trakt_slug ON users(trakt_slug);

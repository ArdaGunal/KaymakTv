-- 074 sınaması: `library_sync_kalan`. YALNIZ geçici, ağsız, kaymak.test=074 etiketli konteyner. Canlıya yapıştırma!
-- Sıra: bu dosyanın KUR bölümü → 074 (iki kez) → DOGRULA bölümü. Betik: psql -v ON_ERROR_STOP=1 -f.
DO $$ BEGIN
  IF current_database() <> 'kaymak_074_test' THEN RAISE EXCEPTION 'Yalniz kaymak_074_test'; END IF;
END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.catalog_entities (
  kaymak_id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT, year INTEGER, runtime INTEGER, tmdb_id BIGINT,
  genres TEXT[], original_language TEXT, original_title TEXT, titles JSONB
);
CREATE TABLE public.catalog_external_ids (
  source TEXT NOT NULL, source_id TEXT NOT NULL, kaymak_id TEXT NOT NULL REFERENCES catalog_entities, retired_at TIMESTAMPTZ,
  PRIMARY KEY (source, source_id)
);
CREATE INDEX ON public.catalog_external_ids (kaymak_id);
CREATE TABLE public.user_watched (user_id UUID, kaymak_id TEXT, watched_at TIMESTAMPTZ, PRIMARY KEY (user_id, kaymak_id, watched_at));
CREATE TABLE public.user_ratings (user_id UUID, kaymak_id TEXT, rated_type TEXT, rating SMALLINT, PRIMARY KEY (user_id, kaymak_id));
CREATE TABLE public.user_watchlist (user_id UUID, kaymak_id TEXT, added_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (user_id, kaymak_id));
CREATE TABLE public.user_favorites (user_id UUID, kaymak_id TEXT, added_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (user_id, kaymak_id));
CREATE TABLE public.user_hidden (user_id UUID, kaymak_id TEXT, hidden_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (user_id, kaymak_id));

INSERT INTO catalog_entities (kaymak_id, type, title, year, runtime, tmdb_id, genres, original_language, original_title, titles) VALUES
  ('show_a', 'show', 'The Hammer and the Rose', 2010, 45, 11, ARRAY['drama'], 'tr', 'Çekiç ve Gül', '{"tr":"Çekiç ve Gül"}'),
  ('movie_b', 'movie', 'The Avengers', 2012, 143, 12, ARRAY['action'], 'en', 'The Avengers', '{"tr":"Yenilmezler"}'),
  ('movie_c', 'movie', 'Emekli Kimlik', 2000, 90, 13, NULL, NULL, NULL, NULL),
  ('episode_d', 'episode', 'Pilot', NULL, 50, 14, NULL, NULL, NULL, NULL),
  ('movie_baska', 'movie', 'Baskasinin', 2001, 90, 15, NULL, NULL, NULL, NULL);
-- Dizi 12 ile film 12 aynı sayı: ters çeviri tipe göre ayrılmalı (036). 999 emekli kimlik elenmeli.
INSERT INTO catalog_external_ids VALUES
  ('trakt:show', '12', 'show_a', NULL),
  ('trakt:movie', '12', 'movie_b', NULL),
  ('trakt:movie', '999', 'movie_c', now()),
  ('trakt:episode', '77', 'episode_d', NULL),
  ('trakt:movie', '55', 'movie_baska', NULL),
  ('trakt:slug', 'x', 'movie_b', NULL);

\set ben '''11111111-1111-1111-1111-111111111111'''
\set baska '''22222222-2222-2222-2222-222222222222'''
\set bos '''33333333-3333-3333-3333-333333333333'''
INSERT INTO user_watched VALUES
  (:ben, 'movie_b', '2026-01-01T00:00:00Z'), (:ben, 'movie_b', '2026-03-01T00:00:00Z'),
  (:ben, 'movie_c', '2026-02-01T00:00:00Z'), (:ben, 'episode_d', '2026-02-02T00:00:00Z'),
  (:baska, 'movie_baska', '2026-04-01T00:00:00Z');
INSERT INTO user_ratings VALUES (:ben, 'show_a', 'show', 9), (:ben, 'movie_b', 'movie', 8), (:ben, 'episode_d', 'episode', 7), (:baska, 'movie_baska', 'movie', 1);
INSERT INTO user_watchlist VALUES (:ben, 'show_a', '2026-05-01T00:00:00Z'), (:baska, 'show_a', '2026-05-02T00:00:00Z');
INSERT INTO user_favorites VALUES (:ben, 'movie_b', '2026-06-01T00:00:00Z');
INSERT INTO user_hidden VALUES (:ben, 'show_a', '2026-07-01T00:00:00Z');

\i /schema/074_library_sync_kalan.sql
\i /schema/074_library_sync_kalan.sql

CREATE TEMP TABLE sonuc AS SELECT public.library_sync_kalan(:ben) AS j, public.library_sync_kalan(:bos) AS b;
CREATE TEMP TABLE sinama (ad TEXT, tamam BOOLEAN);
INSERT INTO sinama
SELECT 'iki oynatma, son damga', (SELECT e->>'plays' = '2' AND (e->>'last_watched_at')::timestamptz = '2026-03-01T00:00:00Z' FROM sonuc, jsonb_array_elements(j->'filmler') e WHERE e->>'trakt_id' = '12')
UNION ALL SELECT 'film basligi tasiyor', (SELECT e->>'original_language' = 'en' AND e->'titles'->>'tr' = 'Yenilmezler' AND e->>'runtime' = '143' FROM sonuc, jsonb_array_elements(j->'filmler') e WHERE e->>'trakt_id' = '12')
UNION ALL SELECT 'emekli kimlik cozulmez, satir null ile gelir', (SELECT count(*) = 1 FROM sonuc, jsonb_array_elements(j->'filmler') e WHERE e->>'title' = 'Emekli Kimlik' AND e->'trakt_id' = 'null')
UNION ALL SELECT 'bolum filmlere karismaz', (SELECT jsonb_array_length(j->'filmler') = 2 FROM sonuc)
UNION ALL SELECT 'baskasinin filmi yok', (SELECT NOT (j::text LIKE '%Baskasinin%') FROM sonuc)
UNION ALL SELECT 'dizi 12 ile film 12 karismaz', (SELECT count(*) = 1 FROM sonuc, jsonb_array_elements(j->'puan') e WHERE e->>'trakt_id' = '12' AND e->>'rated_type' = 'show' AND e->>'tip' = 'show')
UNION ALL SELECT 'bolum puani bolum kimligi', (SELECT count(*) = 1 FROM sonuc, jsonb_array_elements(j->'puan') e WHERE e->>'trakt_id' = '77' AND e->>'rating' = '7')
UNION ALL SELECT 'uc puan', (SELECT jsonb_array_length(j->'puan') = 3 FROM sonuc)
UNION ALL SELECT 'liste damgasi ve baslik', (SELECT (e->>'damga')::timestamptz = '2026-05-01T00:00:00Z' AND e->>'original_title' = 'Çekiç ve Gül' FROM sonuc, jsonb_array_elements(j->'izlemeListesi') e)
UNION ALL SELECT 'favori tip', (SELECT e->>'tip' = 'movie' FROM sonuc, jsonb_array_elements(j->'favori') e)
UNION ALL SELECT 'gizli tip + kimlik', (SELECT e->>'tip' = 'show' AND e->>'trakt_id' = '12' FROM sonuc, jsonb_array_elements(j->'gizli') e)
UNION ALL SELECT 'bos kullanicida bes bos dizi', (SELECT b = '{"filmler":[],"puan":[],"izlemeListesi":[],"favori":[],"gizli":[]}'::jsonb FROM sonuc)
UNION ALL SELECT 'anon EXECUTE yok', NOT has_function_privilege('anon', 'public.library_sync_kalan(uuid)', 'EXECUTE')
UNION ALL SELECT 'authenticated EXECUTE yok', NOT has_function_privilege('authenticated', 'public.library_sync_kalan(uuid)', 'EXECUTE')
UNION ALL SELECT 'service_role EXECUTE var', has_function_privilege('service_role', 'public.library_sync_kalan(uuid)', 'EXECUTE')
UNION ALL SELECT 'SECURITY DEFINER + search_path', (SELECT prosecdef AND proconfig::text LIKE '%search_path=public%' FROM pg_proc WHERE proname = 'library_sync_kalan');

SELECT ad, tamam FROM sinama ORDER BY tamam NULLS FIRST, ad;
SELECT count(*) FILTER (WHERE tamam) || '/' || count(*) AS sonuc FROM sinama;

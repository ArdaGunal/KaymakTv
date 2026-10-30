-- M562 · 070 sınaması — KURULUM. Yalnız geçici, ağsız, kaymak.test=M562 etiketli konteynerde.
-- Sıra: bu dosya → 069 → 063'ün library_sync_diziler bloğu → 051 → 070 (iki kez) → catalog-basliklar-070-dogrula.sql
-- Sonuç (2026-10-30): PG 15 ve PG 17.11'de 27/27; ön kontrol ayrışmış gövde ve farklı imzada durdu, kolon eklenmedi.
-- YALNIZ geçici M562 konteyneri. Canlıya yapıştırma!
DO $$ BEGIN
  IF current_database() <> 'kaymak_m562_test' THEN RAISE EXCEPTION 'Yalniz kaymak_m562_test'; END IF;
END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Supabase'in varsayılanı: public şemadaki yeni işlevlere anon/authenticated EXECUTE alır (hafıza: default function grants)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.catalog_entities (
  kaymak_id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('show','movie','season','episode','person')),
  parent_id TEXT REFERENCES catalog_entities(kaymak_id),
  season_number INTEGER, episode_number INTEGER,
  title TEXT, year INTEGER, runtime INTEGER, tmdb_id BIGINT,
  first_aired TIMESTAMPTZ, genres TEXT[], updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.catalog_external_ids (
  source TEXT NOT NULL, source_id TEXT NOT NULL,
  kaymak_id TEXT NOT NULL REFERENCES catalog_entities(kaymak_id), retired_at TIMESTAMPTZ,
  PRIMARY KEY (source, source_id)
);
CREATE TABLE public.user_watched (user_id UUID, kaymak_id TEXT REFERENCES catalog_entities, watched_at TIMESTAMPTZ);
CREATE TABLE public.user_watchlist (user_id UUID, kaymak_id TEXT REFERENCES catalog_entities);
CREATE TABLE public.user_hidden (user_id UUID, kaymak_id TEXT);
CREATE TABLE public.user_show_state (user_id UUID, kaymak_id TEXT, state TEXT);

-- Veri: Çekiç (dizi, 1 sezon, 1 izlenmiş + 1 gelecek bölüm), bir film (izleme listesinde, gelecekte)
INSERT INTO catalog_entities (kaymak_id, type, title, year, runtime, tmdb_id) VALUES
  ('K-CEKIC', 'show', 'The Hammer and The Rose: A Behzat Ç. Story', 2022, 60, 209475),
  ('K-FILM', 'movie', 'Avengers: Doomsday', 2026, 150, 1003596);
UPDATE catalog_entities SET first_aired = now() + interval '20 days' WHERE kaymak_id = 'K-FILM';
INSERT INTO catalog_entities (kaymak_id, type, parent_id, season_number) VALUES ('K-S1', 'season', 'K-CEKIC', 1);
INSERT INTO catalog_entities (kaymak_id, type, parent_id, season_number, episode_number, title, first_aired, runtime) VALUES
  ('K-E1', 'episode', 'K-S1', 1, 1, 'Bolum 1', now() - interval '10 days', 55),
  ('K-E2', 'episode', 'K-S1', 1, 2, 'Bolum 2', now() + interval '3 days', 55);
INSERT INTO catalog_external_ids VALUES ('trakt:show', '199742', 'K-CEKIC', NULL), ('trakt:movie', '900001', 'K-FILM', NULL);
INSERT INTO user_watched VALUES ('11111111-1111-1111-1111-111111111111', 'K-E1', now() - interval '9 days');
INSERT INTO user_watchlist VALUES ('11111111-1111-1111-1111-111111111111', 'K-FILM');

CREATE FUNCTION public.test_assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', label; END IF; RAISE NOTICE 'PASS: %', label; END $$;

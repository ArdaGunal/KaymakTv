-- SADECE PORTSUZ, HARCANABİLİR YEREL POSTGRES (M462). Canlıya yapıştırma!
DO $$ BEGIN
  IF current_database() <> 'kaymak_m462_test' THEN
    RAISE EXCEPTION 'Bu test yalnız kaymak_m462_test veritabanında koşulur.';
  END IF;
END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.users(id uuid PRIMARY KEY);
CREATE TABLE public.catalog_entities(kaymak_id text PRIMARY KEY, type text);
CREATE TABLE public.catalog_external_ids(source text, source_id text, kaymak_id text REFERENCES catalog_entities,
  retired_at timestamptz, PRIMARY KEY(source, source_id));
CREATE TABLE public.user_ratings(
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  kaymak_id text NOT NULL REFERENCES catalog_entities, rated_type text NOT NULL,
  rating smallint NOT NULL, source text NOT NULL DEFAULT 'kaymak', PRIMARY KEY(user_id, kaymak_id));
CREATE TABLE public.feed_activities(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users ON DELETE CASCADE,
  activity_type text, show_id bigint, media_type text, rating int, activity_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX uq_feed_rated ON feed_activities (user_id, show_id, media_type) WHERE activity_type = 'rated';
CREATE TABLE public.comments(id int PRIMARY KEY, activity_id uuid REFERENCES feed_activities ON DELETE CASCADE);
\i /tmp/062.sql
\i /tmp/062.sql

CREATE FUNCTION public.test_assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
RAISE NOTICE 'PASS: %', label; END $$;

INSERT INTO users VALUES ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
INSERT INTO catalog_entities VALUES ('show_a','show'),('movie_a','movie'),('show_b','show'),('episode_a1','episode');
-- 1396: dizi ve film AYNI Trakt numarası (036 uyarısı); show_b'nin emekli eski kimliği 777.
INSERT INTO catalog_external_ids VALUES
 ('trakt:show','1396','show_a',null),('trakt:movie','1396','movie_a',null),
 ('trakt:show','500','show_b',null),('trakt:show','777','show_b',now()),
 ('trakt:episode','9001','episode_a1',null);
INSERT INTO user_ratings(user_id,kaymak_id,rated_type,rating) VALUES
 ('11111111-1111-1111-1111-111111111111','show_a','show',8),
 ('11111111-1111-1111-1111-111111111111','movie_a','movie',6),
 ('11111111-1111-1111-1111-111111111111','show_b','show',7),
 ('11111111-1111-1111-1111-111111111111','episode_a1','episode',9),
 ('22222222-2222-2222-2222-222222222222','show_a','show',5);
INSERT INTO feed_activities(user_id,activity_type,show_id,media_type,rating) VALUES
 ('11111111-1111-1111-1111-111111111111','rated',1396,'show',8),
 ('11111111-1111-1111-1111-111111111111','rated',1396,'movie',6),
 ('11111111-1111-1111-1111-111111111111','rated',777,'show',7),
 ('11111111-1111-1111-1111-111111111111','watched_episode',1396,'show',null),
 ('22222222-2222-2222-2222-222222222222','rated',1396,'show',5);
INSERT INTO comments SELECT 1, id FROM feed_activities WHERE media_type='movie';

SELECT test_assert((SELECT tetikleyici_aktif AND NOT anon_yetkisi AND NOT authenticated_yetkisi FROM (
  SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='rated_feed_unrate' AND tgenabled='O') AS tetikleyici_aktif,
         has_function_privilege('anon','public.rated_feed_unrate()','EXECUTE') AS anon_yetkisi,
         has_function_privilege('authenticated','public.rated_feed_unrate()','EXECUTE') AS authenticated_yetkisi) k),
  'tetikleyici aktif, anon/authenticated fonksiyonu çağıramaz; iki kez kurulum idempotent');

DELETE FROM user_ratings WHERE user_id='11111111-1111-1111-1111-111111111111' AND kaymak_id='show_a';
SELECT test_assert((SELECT count(*)=0 FROM feed_activities WHERE user_id='11111111-1111-1111-1111-111111111111' AND activity_type='rated' AND show_id=1396 AND media_type='show'), 'dizi puanı kalkınca dizi puan kartı silinir');
SELECT test_assert((SELECT count(*)=1 FROM feed_activities WHERE user_id='11111111-1111-1111-1111-111111111111' AND activity_type='rated' AND media_type='movie'), 'aynı Trakt numaralı FİLM puan kartı korunur');
SELECT test_assert((SELECT count(*)=1 FROM feed_activities WHERE activity_type='watched_episode'), 'izleme olayı korunur');
SELECT test_assert((SELECT count(*)=1 FROM feed_activities WHERE user_id='22222222-2222-2222-2222-222222222222'), 'başka kullanıcının aynı yapım kartı korunur');

DELETE FROM user_ratings WHERE kaymak_id='episode_a1';
SELECT test_assert((SELECT count(*)=4 FROM feed_activities), 'bölüm puanı silmek akışa dokunmaz');

DELETE FROM user_ratings WHERE kaymak_id='show_b';
SELECT test_assert((SELECT count(*)=0 FROM feed_activities WHERE show_id=777), 'emekli eski kimlikle yazılmış kart da silinir');

-- Yeniden puan → publish TEMİZ yeni satır yazabilir (benzersiz indeks çakışmaz).
INSERT INTO user_ratings(user_id,kaymak_id,rated_type,rating) VALUES ('11111111-1111-1111-1111-111111111111','show_a','show',9);
INSERT INTO feed_activities(user_id,activity_type,show_id,media_type,rating) VALUES ('11111111-1111-1111-1111-111111111111','rated',1396,'show',9);
SELECT test_assert((SELECT rating=9 FROM feed_activities WHERE user_id='11111111-1111-1111-1111-111111111111' AND activity_type='rated' AND media_type='show'), 'yeniden puan yeni kart olarak yazılır');

-- Film puanı kalkınca kart ve yorumu CASCADE gider (Trakt yolundaki mevcut kural).
DELETE FROM user_ratings WHERE kaymak_id='movie_a';
SELECT test_assert((SELECT count(*)=0 FROM feed_activities WHERE media_type='movie') AND (SELECT count(*)=0 FROM comments), 'film kartı + yorumu silinir (bilinen bedel)');

-- Hesap silme kademesi hata vermez.
DELETE FROM users WHERE id='11111111-1111-1111-1111-111111111111';
SELECT test_assert((SELECT count(*)=0 FROM user_ratings WHERE user_id='11111111-1111-1111-1111-111111111111')
  AND (SELECT count(*)=0 FROM feed_activities WHERE user_id='11111111-1111-1111-1111-111111111111')
  AND (SELECT count(*)=1 FROM feed_activities WHERE user_id='22222222-2222-2222-2222-222222222222'), 'hesap silme kademesi temiz, diğer kullanıcı etkilenmez');

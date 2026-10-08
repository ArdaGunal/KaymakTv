-- SADECE PORTSUZ, HARCANABİLİR YEREL POSTGRES. Canlı SQL Editor'e yapıştırma!
DO $$ BEGIN
  IF current_database() <> 'kaymak_m449_test' THEN
    RAISE EXCEPTION 'Bu test yalnız kaymak_m449_test veritabanında koşulur.';
  END IF;
END $$;

CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.users(id uuid PRIMARY KEY);
CREATE TABLE public.catalog_entities(
  kaymak_id text PRIMARY KEY, type text, parent_id text REFERENCES catalog_entities,
  season_number int, episode_number int);
CREATE TABLE public.catalog_external_ids(
  source text, source_id text, kaymak_id text REFERENCES catalog_entities,
  PRIMARY KEY(source,source_id));
CREATE TABLE public.user_watched(
  user_id uuid REFERENCES users, kaymak_id text REFERENCES catalog_entities,
  watched_at timestamptz, PRIMARY KEY(user_id,kaymak_id,watched_at));
CREATE TABLE public.feed_activities(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users,
  activity_type text, show_id bigint, media_type text, episode_number text,
  activity_at timestamptz, in_feed bool DEFAULT true, is_visible bool DEFAULT true);
CREATE TABLE public.deleted_feed_activities(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users,
  activity_type text CHECK(activity_type IN ('watched_episode','watched_movie','started_show','completed_show','rated')),
  show_id bigint NOT NULL, media_type text, episode_number text, activity_at timestamptz NOT NULL);
CREATE TABLE public.feed_comments(id int PRIMARY KEY, activity_id uuid REFERENCES feed_activities ON DELETE CASCADE);
CREATE TABLE public.feed_likes(id int PRIMARY KEY, activity_id uuid REFERENCES feed_activities ON DELETE CASCADE);
\i /tmp/060.sql
\i /tmp/060.sql
CREATE FUNCTION public.test_assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
RAISE NOTICE 'PASS: %', label; END $$;

INSERT INTO users VALUES ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
INSERT INTO catalog_entities VALUES
('show_a','show',null,null,null),('season_a','season','show_a',1,null),
('episode_a1','episode','season_a',1,1),('episode_a2','episode','season_a',1,2),
('season_a100','season','show_a',100,null),('episode_a100','episode','season_a100',100,100),
('movie_a','movie',null,null,null),('movie_b','movie',null,null,null),
('show_b','show',null,null,null),('season_b','season','show_b',1,null),('episode_b1','episode','season_b',1,1);
INSERT INTO catalog_external_ids VALUES
('trakt:show','100','show_a'),('trakt:show','101','show_a'),
('trakt:show','200','show_b'),('trakt:movie','100','movie_a'),('trakt:movie','300','movie_b');
INSERT INTO user_watched VALUES
('11111111-1111-1111-1111-111111111111','episode_a1','2026-10-01 12:00Z'),
('11111111-1111-1111-1111-111111111111','episode_a2','2026-10-01 12:01Z'),
('11111111-1111-1111-1111-111111111111','episode_a100','2026-10-01 12:02Z'),
('11111111-1111-1111-1111-111111111111','episode_b1','2026-10-01 12:03Z'),
('11111111-1111-1111-1111-111111111111','movie_a','2026-10-01 12:00Z'),
('11111111-1111-1111-1111-111111111111','movie_a','2026-10-02 12:00Z'),
('22222222-2222-2222-2222-222222222222','episode_a1','2026-10-01 12:00Z');
INSERT INTO feed_activities(user_id,activity_type,show_id,media_type,episode_number,activity_at)
VALUES
('11111111-1111-1111-1111-111111111111','watched_episode',100,'show','S01E01','2026-10-01 12:00Z'),
('11111111-1111-1111-1111-111111111111','watched_episode',101,'show','S01E01','2026-10-01 12:00Z'),
('11111111-1111-1111-1111-111111111111','watched_episode',100,'show','S01E02','2026-10-01 12:01Z'),
('11111111-1111-1111-1111-111111111111','watched_episode',100,'show','S100E100','2026-10-01 12:02Z'),
('11111111-1111-1111-1111-111111111111','watched_episode',200,'show','S01E01','2026-10-01 12:03Z'),
('11111111-1111-1111-1111-111111111111','watched_movie',100,'movie',null,'2026-10-01 12:00Z'),
('11111111-1111-1111-1111-111111111111','watched_movie',100,'movie',null,'2026-10-02 12:00Z'),
('11111111-1111-1111-1111-111111111111','started_show',100,'show',null,'2026-10-01 12:00Z'),
('11111111-1111-1111-1111-111111111111','completed_show',100,'show',null,'2026-10-01 12:02Z'),
('11111111-1111-1111-1111-111111111111','reviewed',100,'movie',null,'2026-10-01 12:00Z'),
('11111111-1111-1111-1111-111111111111','posted',100,'movie',null,'2026-10-01 12:00Z'),
('11111111-1111-1111-1111-111111111111','rated',100,'movie',null,'2026-10-01 12:00Z'),
('22222222-2222-2222-2222-222222222222','watched_episode',100,'show','S01E01','2026-10-01 12:00Z');
INSERT INTO feed_comments SELECT 1,id FROM feed_activities WHERE activity_type='watched_movie' AND activity_at='2026-10-01 12:00Z';
INSERT INTO feed_likes SELECT 1,activity_id FROM feed_comments;

SELECT test_assert(NOT has_function_privilege('anon','delete_watched_with_feed(uuid,text[],boolean,timestamptz)','EXECUTE'), 'anon RPC kapalı');
SELECT test_assert(NOT has_function_privilege('authenticated','delete_watched_with_feed(uuid,text[],boolean,timestamptz)','EXECUTE'), 'authenticated RPC kapalı');
SELECT test_assert(has_function_privilege('service_role','delete_watched_with_feed(uuid,text[],boolean,timestamptz)','EXECUTE'), 'service_role RPC açık');
SELECT test_assert(NOT has_function_privilege('anon','guard_retracted_watch_publish()','EXECUTE'), 'anon trigger fonksiyonu kapalı');

SELECT test_assert(delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['movie_a'],false,'2026-10-01 12:00Z') = '{"silinen":1,"geri_cekilen":1}'::jsonb, 'tek film izleme damgası');
SELECT test_assert((SELECT count(*)=1 FROM user_watched WHERE kaymak_id='movie_a'), 'diğer yeniden izleme korunur');
SELECT test_assert((SELECT count(*)=1 FROM feed_activities WHERE activity_type='watched_movie' AND in_feed AND is_visible), 'diğer film olayı korunur');
SELECT test_assert((SELECT count(*)=2 FROM feed_activities WHERE activity_type='watched_movie'), 'film feed hard-delete edilmez');
SELECT test_assert((SELECT count(*)=1 FROM feed_comments) AND (SELECT count(*)=1 FROM feed_likes), 'yorum ve beğeni CASCADE kaybı yok');
SELECT test_assert((SELECT count(*)=3 FROM feed_activities WHERE activity_type IN ('posted','reviewed','rated') AND is_visible AND in_feed), 'not inceleme puan korunur');
SELECT test_assert(delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['season_a'],true) = '{"silinen":2,"geri_cekilen":3}'::jsonb, 'sezon iki bölüm ve eski alias');
SELECT test_assert((SELECT count(*)=1 FROM user_watched WHERE kaymak_id='episode_a100'), 'diğer sezon korunur');
SELECT test_assert((SELECT count(*)=2 FROM feed_activities WHERE activity_type IN ('started_show','completed_show') AND in_feed), 'kısmi sezon silmede dizi özetleri korunur');
INSERT INTO feed_activities(user_id,activity_type,show_id,media_type,episode_number,activity_at)
VALUES ('11111111-1111-1111-1111-111111111111','watched_episode',100,'show','S99E99','2026-10-01 12:02Z');
SELECT test_assert(delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['show_a'],true) = '{"silinen":1,"geri_cekilen":4}'::jsonb, 'tam dizi + S100E100 + özetler + eksik katalog bölümü');
SELECT test_assert((SELECT count(*)=1 FROM user_watched WHERE user_id='22222222-2222-2222-2222-222222222222') AND (SELECT count(*)=1 FROM feed_activities WHERE user_id='22222222-2222-2222-2222-222222222222' AND in_feed), 'başka kullanıcı korunur');
SELECT test_assert((SELECT count(*)=1 FROM user_watched WHERE kaymak_id='episode_b1'), 'başka dizi korunur');
SELECT test_assert(delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['show_a'],true) = '{"silinen":0,"geri_cekilen":0}'::jsonb, 'tekrar silme idempotent');

-- Eski yayın hem mevcut arşivli satır hem hiç yayınlanmamış damga için engellenir.
INSERT INTO feed_activities(user_id,activity_type,show_id,media_type,episode_number,activity_at)
VALUES ('11111111-1111-1111-1111-111111111111','watched_episode',100,'show','S01E01','2026-10-01 12:00Z');
SELECT test_assert((SELECT count(*)=0 FROM feed_activities WHERE user_id='11111111-1111-1111-1111-111111111111' AND activity_type='watched_episode' AND show_id=100 AND episode_number='S01E01' AND in_feed), 'eski publish diriltemez');
INSERT INTO user_watched VALUES ('11111111-1111-1111-1111-111111111111','episode_a1','2026-10-03 12:00Z');
SELECT test_assert(delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['episode_a1'],true) = '{"silinen":1,"geri_cekilen":0}'::jsonb, 'henüz publish olmayan izleme silme');
INSERT INTO feed_activities(user_id,activity_type,show_id,media_type,episode_number,activity_at)
VALUES ('11111111-1111-1111-1111-111111111111','watched_episode',100,'show','S01E01','2026-10-03 12:00Z');
SELECT test_assert((SELECT count(*)=0 FROM feed_activities WHERE activity_at='2026-10-03 12:00Z'), 'gecikmiş ilk publish engellenir');
INSERT INTO feed_activities(user_id,activity_type,show_id,media_type,episode_number,activity_at)
VALUES ('11111111-1111-1111-1111-111111111111','watched_episode',100,'show','S01E01','2026-10-04 12:00Z');
SELECT test_assert((SELECT count(*)=1 FROM feed_activities WHERE activity_at='2026-10-04 12:00Z' AND in_feed), 'yeni damgalı izleme engellenmez');

-- user_watched sıfırken eski yetim film feed'i de açık sıfırlamayla çekilir.
INSERT INTO feed_activities(user_id,activity_type,show_id,media_type,activity_at)
VALUES ('11111111-1111-1111-1111-111111111111','watched_movie',300,'movie','2026-10-01 12:00Z');
SELECT test_assert(delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['movie_b'],true) = '{"silinen":0,"geri_cekilen":1}'::jsonb, 'sıfır geçmişte yetim film olayı');

-- Aktivite yazma hatası geçmiş silmesini de atomik olarak geri alır.
CREATE FUNCTION public.test_fail_retract() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'simulated feed failure'; END $$;
CREATE TRIGGER test_fail_retract BEFORE UPDATE ON feed_activities FOR EACH ROW EXECUTE FUNCTION test_fail_retract();
DO $$ BEGIN
  BEGIN
    PERFORM delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['movie_a'],true);
    RAISE EXCEPTION 'beklenen test hatası olmadı';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'simulated feed failure' THEN RAISE; END IF;
  END;
  PERFORM test_assert((SELECT count(*)=1 FROM user_watched WHERE kaymak_id='movie_a'), 'feed hatasında geçmiş rollback');
END $$;
DROP TRIGGER test_fail_retract ON feed_activities;
SELECT test_assert(delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['movie_a'],true) = '{"silinen":1,"geri_cekilen":1}'::jsonb, 'tam film sıfırlama');

DO $$ BEGIN
  BEGIN
    PERFORM delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['show_a'],false,'2026-10-01 12:00Z');
    RAISE EXCEPTION 'beklenen onay hatası olmadı';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%tumu:true%' THEN RAISE; END IF;
  END;
  PERFORM test_assert(true, 'kök silmede açık onay zorunlu');
END $$;

-- RPC tablo yetkisi vermeden service_role için çalışır; anon çağıramaz.
SET ROLE service_role;
SELECT public.delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['movie_b'],true);
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['movie_b'],true);
    RAISE EXCEPTION 'anon çağrı beklenmedik biçimde geçti';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT test_assert(true, 'gerçek rol ile anon ret/service_role RPC');

-- Çok bölümlü dizide tek SQL çağrısı; 1500 kimlik HTTP URL'e taşınmaz.
INSERT INTO catalog_entities VALUES ('show_big','show',null,null,null),('season_big','season','show_big',1,null);
INSERT INTO catalog_entities SELECT 'episode_big_' || i,'episode','season_big',1,i FROM generate_series(1,1500) i;
INSERT INTO catalog_external_ids VALUES ('trakt:show','1500','show_big');
INSERT INTO user_watched SELECT '11111111-1111-1111-1111-111111111111','episode_big_'||i,'2026-10-01 12:00Z' FROM generate_series(1,1500) i;
INSERT INTO feed_activities(user_id,activity_type,show_id,media_type,episode_number,activity_at)
SELECT '11111111-1111-1111-1111-111111111111','watched_episode',1500,'show',
  'S01E'||lpad(i::text,greatest(2,length(i::text)),'0'),'2026-10-01 12:00Z'
FROM generate_series(1,1500) i;
\timing on
SELECT test_assert(delete_watched_with_feed('11111111-1111-1111-1111-111111111111',ARRAY['show_big'],true) = '{"silinen":1500,"geri_cekilen":1500}'::jsonb, '1500 bölümlü tek işlem');
\timing off

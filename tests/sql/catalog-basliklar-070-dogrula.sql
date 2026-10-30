-- 070 sonrası davranış testleri (YALNIZ M562 konteyneri)
DO $$ BEGIN IF current_database() <> 'kaymak_m562_test' THEN RAISE EXCEPTION 'Yalniz kaymak_m562_test'; END IF; END $$;
\set U '''11111111-1111-1111-1111-111111111111'''

SELECT test_assert((SELECT count(*) FROM information_schema.columns WHERE table_name = 'catalog_entities'
  AND column_name IN ('original_language','original_title','titles')) = 3, 'uc kolon var');
SELECT test_assert(pg_get_function_result('public.library_sync_diziler(uuid)'::regprocedure) LIKE '%ilerleme jsonb, original_language text, original_title text, titles jsonb)', 'diziler yeni imza');
SELECT test_assert(pg_get_function_result('public.library_takvim(uuid, integer)'::regprocedure) LIKE '%bolum_adi text, original_language text, original_title text, titles jsonb)', 'takvim yeni imza');

-- Aynanın yazımı (PostgREST merge-duplicates = ON CONFLICT DO UPDATE SET kolon = gelen)
INSERT INTO catalog_entities (kaymak_id, type, title, original_language, original_title, titles)
VALUES ('K-CEKIC', 'show', 'The Hammer and The Rose: A Behzat Ç. Story', 'tr', 'Çekiç ve Gül: Bir Behzat Ç. Hikayesi', '{"tr":"Çekiç ve Gül: Bir Behzat Ç. Hikayesi"}')
ON CONFLICT (kaymak_id) DO UPDATE SET title = EXCLUDED.title, original_language = EXCLUDED.original_language,
  original_title = EXCLUDED.original_title, titles = EXCLUDED.titles;
INSERT INTO catalog_entities (kaymak_id, type, title, original_language, original_title, titles)
VALUES ('K-FILM', 'movie', 'Avengers: Doomsday', 'en', 'Avengers: Doomsday', '{"tr":"Yenilmezler: Kıyamet","en":"Avengers: Doomsday"}')
ON CONFLICT (kaymak_id) DO UPDATE SET title = EXCLUDED.title, original_language = EXCLUDED.original_language,
  original_title = EXCLUDED.original_title, titles = EXCLUDED.titles;

-- RPC'ler yeni alanları döndürür, eski alanlar aynı
SELECT test_assert((SELECT original_title FROM library_sync_diziler(:U)) = 'Çekiç ve Gül: Bir Behzat Ç. Hikayesi', 'diziler original_title');
SELECT test_assert((SELECT original_language FROM library_sync_diziler(:U)) = 'tr', 'diziler original_language');
SELECT test_assert((SELECT titles->>'tr' FROM library_sync_diziler(:U)) = 'Çekiç ve Gül: Bir Behzat Ç. Hikayesi', 'diziler titles');
SELECT test_assert((SELECT (ilerleme->>'completed')::int FROM library_sync_diziler(:U)) = 1, 'diziler ilerleme degismedi (completed 1)');
SELECT test_assert((SELECT (ilerleme->>'watched_minutes')::int FROM library_sync_diziler(:U)) = 55, 'diziler watched_minutes degismedi (55)');
SELECT test_assert((SELECT trakt_id FROM library_sync_diziler(:U)) = 199742, 'diziler trakt_id');
SELECT test_assert((SELECT count(*) FROM library_takvim(:U, 33)) = 2, 'takvim 2 satir (gelecek bolum + film)');
SELECT test_assert((SELECT original_title FROM library_takvim(:U, 33) WHERE tur = 'episode') = 'Çekiç ve Gül: Bir Behzat Ç. Hikayesi', 'takvim bolum satirinda dizinin original_title');
SELECT test_assert((SELECT bolum_adi FROM library_takvim(:U, 33) WHERE tur = 'episode') = 'Bolum 2', 'takvim bolum_adi degismedi');
SELECT test_assert((SELECT titles->>'tr' FROM library_takvim(:U, 33) WHERE tur = 'movie') = 'Yenilmezler: Kıyamet', 'takvim film titles');
SELECT test_assert((SELECT baslik FROM library_takvim(:U, 33) WHERE tur = 'movie') = 'Avengers: Doomsday', 'takvim baslik degismedi');

-- NULL koruması: original_* NULL ile ezilmez
INSERT INTO catalog_entities (kaymak_id, type, title, original_language, original_title, titles)
VALUES ('K-CEKIC', 'show', NULL, NULL, NULL, '{}')
ON CONFLICT (kaymak_id) DO UPDATE SET title = EXCLUDED.title, original_language = EXCLUDED.original_language,
  original_title = EXCLUDED.original_title, titles = EXCLUDED.titles;
SELECT test_assert((SELECT original_title FROM catalog_entities WHERE kaymak_id = 'K-CEKIC') = 'Çekiç ve Gül: Bir Behzat Ç. Hikayesi', 'original_title NULL ile ezilmedi');
SELECT test_assert((SELECT original_language FROM catalog_entities WHERE kaymak_id = 'K-CEKIC') = 'tr', 'original_language NULL ile ezilmedi');
SELECT test_assert((SELECT title FROM catalog_entities WHERE kaymak_id = 'K-CEKIC') IS NOT NULL, 'title korumasi suruyor (069)');
-- titles ÜZERİNE YAZILIR: {} gelince eski çeviri kalkar (elenen kirli çeviri senaryosu)
SELECT test_assert((SELECT titles FROM catalog_entities WHERE kaymak_id = 'K-CEKIC') = '{}'::jsonb, 'titles {} ile uzerine yazildi (eski ceviri silindi)');
-- Kısmi sözlük birleştirilmez: yalnız {"de":…} gelirse "tr" kalkar (Pi her zaman TAM sözlük gönderir)
UPDATE catalog_entities SET titles = '{"de":"Rächer: Doomsday"}' WHERE kaymak_id = 'K-FILM';
SELECT test_assert((SELECT titles FROM catalog_entities WHERE kaymak_id = 'K-FILM') = '{"de":"Rächer: Doomsday"}'::jsonb, 'titles birlestirilmez, aynen yazilir');

-- Kısıtlar
DO $$ BEGIN
  UPDATE catalog_entities SET original_language = 'tur' WHERE kaymak_id = 'K-FILM';
  RAISE EXCEPTION 'FAIL: 3 harfli dil kodu kabul edildi';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: 3 harfli dil kodu reddedildi'; END $$;
DO $$ BEGIN
  UPDATE catalog_entities SET titles = '["x"]' WHERE kaymak_id = 'K-FILM';
  RAISE EXCEPTION 'FAIL: dizi titles kabul edildi';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: nesne olmayan titles reddedildi'; END $$;

-- Yetkiler: varsayılan EXECUTE tuzağına rağmen anon/authenticated kapalı
SELECT test_assert(NOT has_function_privilege('anon', 'public.library_sync_diziler(uuid)', 'EXECUTE'), 'anon diziler EXECUTE yok');
SELECT test_assert(NOT has_function_privilege('authenticated', 'public.library_takvim(uuid, integer)', 'EXECUTE'), 'authenticated takvim EXECUTE yok');
SELECT test_assert(NOT has_function_privilege('anon', 'public.library_takvim(uuid, integer)', 'EXECUTE'), 'anon takvim EXECUTE yok');
SELECT test_assert(has_function_privilege('service_role', 'public.library_sync_diziler(uuid)', 'EXECUTE'), 'service_role diziler EXECUTE var');
SELECT test_assert(has_function_privilege('service_role', 'public.library_takvim(uuid, integer)', 'EXECUTE'), 'service_role takvim EXECUTE var');
SELECT test_assert((SELECT count(*) FROM pg_trigger WHERE tgname = 'catalog_entities_null_koruma' AND NOT tgisinternal) = 1, 'tetik tek');

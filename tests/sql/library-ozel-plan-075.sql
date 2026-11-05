-- 075 sınaması: eski (070, LANGUAGE sql) ve yeni (075, plpgsql) işlev AYNI sonucu verir, kabuk doğrudur.
-- YALNIZ geçici, ağsız konteyner. Canlıya yapıştırma! Sıra: katalog + kullanıcı verisi → 070 işlevleri →
-- `\set`'le bu dosyanın ÖNCE bölümü → 075 → SONRA bölümü. Sonuç: tüm satırlar `t`.
DO $$ BEGIN
  IF current_database() <> 'kaymak_t5_test' THEN RAISE EXCEPTION 'Yalniz gecici test veritabani'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.iz_075 (asama TEXT, fn TEXT, hesap TEXT, ozet TEXT, PRIMARY KEY (asama, fn, hesap));

CREATE OR REPLACE FUNCTION public.iz_075_al(p_asama TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE u UUID; ad TEXT;
BEGIN
  FOREACH ad IN ARRAY ARRAY['11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000009'] LOOP
    u := ad::uuid;
    INSERT INTO iz_075 SELECT p_asama, 'diziler', ad, count(*) || ':' || COALESCE(md5(string_agg(t::text, '|' ORDER BY t.dizi_id)), '-') FROM public.library_sync_diziler(u) t
      ON CONFLICT (asama, fn, hesap) DO UPDATE SET ozet = EXCLUDED.ozet;
    INSERT INTO iz_075 SELECT p_asama, 'takvim', ad, count(*) || ':' || COALESCE(md5(string_agg(t::text, '|' ORDER BY t::text)), '-') FROM public.library_takvim(u, 3650) t
      ON CONFLICT (asama, fn, hesap) DO UPDATE SET ozet = EXCLUDED.ozet;
  END LOOP;
END $$;

SELECT public.iz_075_al(:'asama');

SELECT fn, hesap, ozet FROM iz_075 WHERE asama = :'asama' ORDER BY 1, 2;

-- Yalnız SONRA aşamasında anlamlı:
SELECT 'ayni sonuc' AS ad, count(*) = 8 AND bool_and(o.ozet = s.ozet) AS tamam
  FROM iz_075 o JOIN iz_075 s USING (fn, hesap) WHERE o.asama = 'once' AND s.asama = 'sonra'
UNION ALL
SELECT 'plpgsql + ozel plan + definer: ' || proname, l.lanname = 'plpgsql' AND p.prosecdef
       AND p.proconfig::text LIKE '%plan_cache_mode=force_custom_plan%' AND p.proconfig::text LIKE '%search_path=public%'
  FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE proname IN ('library_sync_diziler', 'library_takvim')
UNION ALL
SELECT 'yetki: ' || proname, NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE') AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  FROM pg_proc p WHERE proname IN ('library_sync_diziler', 'library_takvim');

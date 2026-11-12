-- 078 fixture testi (YAYIN_ONCESI_PLAN Adım 4e · M610). PG 17'de koşulur:
--   docker run --rm -e POSTGRES_PASSWORD=x -v <depo>:/depo postgres:17-alpine  (ayrıntı: tests/sql/hesap-durumu-078.sh)
-- Supabase'in varsayılanlarını taklit eder: anon / authenticated / service_role rolleri ve
-- public şemasındaki yeni tablo + işlevlere anon/authenticated için VARSAYILAN izin.
-- Her kontrol «TAMAM» / «KALDI» satırı basar; betik KALDI görürse çıkış 1.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- Supabase varsayılanı: public'te oluşturulan her tablo/işlev üç role de açılır.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL);
INSERT INTO public.users (id, username) VALUES
  ('11111111-1111-4111-8111-111111111111', 'hedef'),
  ('22222222-2222-4222-8222-222222222222', 'moderator'),
  ('33333333-3333-4333-8333-333333333333', 'silinecek');

\i /depo/supabase/schema/078_hesap_durumu.sql
-- İkinci kez: tekrar çalıştırılabilir olmalı.
\i /depo/supabase/schema/078_hesap_durumu.sql

CREATE TEMP TABLE sonuc (ad text, gecti boolean);
GRANT ALL ON sonuc TO PUBLIC;

-- Yardımcı: bir rol olarak ifadeyi dener; izin hatası (42501) = reddedildi.
CREATE FUNCTION pg_temp.reddedildi(p_rol text, p_sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', p_rol);
  BEGIN
    EXECUTE p_sql;
    RESET ROLE;
    RETURN false;
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RETURN true;
  END;
END $$;

-- ── İzinler ────────────────────────────────────────────────────────────────
BEGIN;
INSERT INTO sonuc SELECT 'anon hesap_durumu OKUYAMAZ', pg_temp.reddedildi('anon', 'SELECT 1 FROM public.hesap_durumu');
INSERT INTO sonuc SELECT 'anon hesap_durumu YAZAMAZ', pg_temp.reddedildi('anon', $q$INSERT INTO public.hesap_durumu VALUES ('11111111-1111-4111-8111-111111111111','kapali',NULL,'deneme')$q$);
INSERT INTO sonuc SELECT 'girisli hesap_durumu OKUYAMAZ', pg_temp.reddedildi('authenticated', 'SELECT 1 FROM public.hesap_durumu');
INSERT INTO sonuc SELECT 'girisli kendi askisini SILEMEZ', pg_temp.reddedildi('authenticated', 'DELETE FROM public.hesap_durumu');
INSERT INTO sonuc SELECT 'girisli kendine rol VEREMEZ', pg_temp.reddedildi('authenticated', $q$INSERT INTO public.kullanici_rolleri (user_id, rol) VALUES ('11111111-1111-4111-8111-111111111111','admin')$q$);
INSERT INTO sonuc SELECT 'girisli moderasyon kaydini OKUYAMAZ', pg_temp.reddedildi('authenticated', 'SELECT 1 FROM public.moderasyon_kaydi');
INSERT INTO sonuc SELECT 'anon mod_askiya_al CAGIRAMAZ', pg_temp.reddedildi('anon', $q$SELECT public.mod_askiya_al('11111111-1111-4111-8111-111111111111', 1, 'deneme')$q$);
INSERT INTO sonuc SELECT 'girisli mod_kapat CAGIRAMAZ', pg_temp.reddedildi('authenticated', $q$SELECT public.mod_kapat('11111111-1111-4111-8111-111111111111', 'deneme')$q$);
INSERT INTO sonuc SELECT 'girisli mod_aski_kaldir CAGIRAMAZ', pg_temp.reddedildi('authenticated', $q$SELECT public.mod_aski_kaldir('11111111-1111-4111-8111-111111111111', 'deneme')$q$);
INSERT INTO sonuc SELECT 'service_role mod_askiya_al CAGIRABILIR', NOT pg_temp.reddedildi('service_role', $q$SELECT public.mod_askiya_al('33333333-3333-4333-8333-333333333333', 3, 'servis denemesi')$q$);
INSERT INTO sonuc SELECT 'service_role hesap_durumu OKUR', NOT pg_temp.reddedildi('service_role', 'SELECT 1 FROM public.hesap_durumu');
INSERT INTO sonuc SELECT 'service_role moderasyon kaydini DEGISTIREMEZ (yalniz ekler)', pg_temp.reddedildi('service_role', 'UPDATE public.moderasyon_kaydi SET sebep = ''degisti''');
COMMIT;

-- ── Askı ───────────────────────────────────────────────────────────────────
SELECT public.mod_askiya_al('11111111-1111-4111-8111-111111111111', 7, '  hakaret iceren yorumlar  ', '22222222-2222-4222-8222-222222222222') \gset aski_
INSERT INTO sonuc SELECT 'aski: durum aski, bitis ~7 gun, sebep kirpildi',
  durum = 'aski' AND bitis BETWEEN now() + interval '6 days 23 hours' AND now() + interval '7 days 1 hour' AND sebep = 'hakaret iceren yorumlar'
  FROM public.hesap_durumu WHERE user_id = '11111111-1111-4111-8111-111111111111';
INSERT INTO sonuc SELECT 'aski: kayit dustu (yapan, islem, gun)',
  count(*) = 1 AND bool_and(yapan = '22222222-2222-4222-8222-222222222222' AND (ayrinti->>'gun')::int = 7)
  FROM public.moderasyon_kaydi WHERE hedef_user_id = '11111111-1111-4111-8111-111111111111' AND islem = 'aski';

-- Yeniden askı: tek satır kalır, süre yenilenir, ikinci kayıt düşer.
SELECT public.mod_askiya_al('11111111-1111-4111-8111-111111111111', 30, 'tekrar ihlal') \gset aski2_
INSERT INTO sonuc SELECT 'yeniden aski: tek satir, sure 30 gun',
  count(*) = 1 AND bool_and(bitis > now() + interval '29 days')
  FROM public.hesap_durumu WHERE user_id = '11111111-1111-4111-8111-111111111111';
INSERT INTO sonuc SELECT 'yeniden aski: iki kayit', count(*) = 2
  FROM public.moderasyon_kaydi WHERE hedef_user_id = '11111111-1111-4111-8111-111111111111' AND islem = 'aski';

-- ── Kapatma (süresiz) ──────────────────────────────────────────────────────
SELECT public.mod_kapat('11111111-1111-4111-8111-111111111111', 'kalici ihlal') \gset kapat_
INSERT INTO sonuc SELECT 'kapat: durum kapali, bitis NULL',
  durum = 'kapali' AND bitis IS NULL FROM public.hesap_durumu WHERE user_id = '11111111-1111-4111-8111-111111111111';

-- ── Kaldırma ───────────────────────────────────────────────────────────────
INSERT INTO sonuc SELECT 'kaldir: 1 satir silindi', public.mod_aski_kaldir('11111111-1111-4111-8111-111111111111', 'itiraz kabul') = 1;
INSERT INTO sonuc SELECT 'kaldir: hesap aktif (satir yok)', count(*) = 0 FROM public.hesap_durumu WHERE user_id = '11111111-1111-4111-8111-111111111111';
INSERT INTO sonuc SELECT 'kaldir: zaten aktifse 0, kayit dusmez',
  public.mod_aski_kaldir('11111111-1111-4111-8111-111111111111', 'tekrar deneme') = 0
  AND (SELECT count(*) FROM public.moderasyon_kaydi WHERE islem = 'aski_kaldir') = 1;

-- ── Geçersiz girdiler: hiçbir şey yazılmaz ─────────────────────────────────
CREATE FUNCTION pg_temp.hata_verir(p_sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END $$;
INSERT INTO sonuc SELECT 'gun 0 reddedilir', pg_temp.hata_verir($q$SELECT public.mod_askiya_al('11111111-1111-4111-8111-111111111111', 0, 'deneme')$q$);
INSERT INTO sonuc SELECT 'gun 366 reddedilir', pg_temp.hata_verir($q$SELECT public.mod_askiya_al('11111111-1111-4111-8111-111111111111', 366, 'deneme')$q$);
INSERT INTO sonuc SELECT 'olmayan kullanici reddedilir', pg_temp.hata_verir($q$SELECT public.mod_kapat('99999999-9999-4999-8999-999999999999', 'deneme')$q$);
INSERT INTO sonuc SELECT 'bos sebep reddedilir (durum da yazilmaz)',
  pg_temp.hata_verir($q$SELECT public.mod_askiya_al('11111111-1111-4111-8111-111111111111', 5, '  ')$q$)
  AND (SELECT count(*) FROM public.hesap_durumu WHERE user_id = '11111111-1111-4111-8111-111111111111') = 0;
INSERT INTO sonuc SELECT 'elle tutarsiz satir reddedilir (aski + bitis yok)',
  pg_temp.hata_verir($q$INSERT INTO public.hesap_durumu VALUES ('11111111-1111-4111-8111-111111111111','aski',NULL,'deneme')$q$);
INSERT INTO sonuc SELECT 'elle tutarsiz satir reddedilir (kapali + bitis var)',
  pg_temp.hata_verir($q$INSERT INTO public.hesap_durumu VALUES ('11111111-1111-4111-8111-111111111111','kapali',now(),'deneme')$q$);

-- ── Hesap silme: askı gider, kayıt kalır (hedef NULL) ──────────────────────
DELETE FROM public.users WHERE id = '33333333-3333-4333-8333-333333333333';
INSERT INTO sonuc SELECT 'hesap silinince aski satiri gider', count(*) = 0 FROM public.hesap_durumu WHERE user_id = '33333333-3333-4333-8333-333333333333';
INSERT INTO sonuc SELECT 'hesap silinince kayit kalir, hedef NULL',
  count(*) = 1 FROM public.moderasyon_kaydi WHERE sebep = 'servis denemesi' AND hedef_user_id IS NULL;
-- Askıdaki hesap silinebilir (Play veri silme şartı): askı silmeyi engellemez.
SELECT public.mod_kapat('11111111-1111-4111-8111-111111111111', 'silme denemesi') \gset
DELETE FROM public.users WHERE id = '11111111-1111-4111-8111-111111111111';
INSERT INTO sonuc SELECT 'kapali hesap SILINEBILIR', count(*) = 0 FROM public.users WHERE id = '11111111-1111-4111-8111-111111111111';

SELECT CASE WHEN gecti THEN 'TAMAM ' ELSE 'KALDI ' END || ad FROM sonuc;
SELECT 'OZET ' || count(*) FILTER (WHERE gecti) || ' gecti / ' || count(*) FILTER (WHERE NOT gecti OR gecti IS NULL) || ' kaldi' FROM sonuc;

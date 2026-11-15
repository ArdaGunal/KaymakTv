-- 080 yerel sınaması (Kaymak 1.0.1 · Dal 1). PG 15 ve 17'de koşulur — ayrıntı: tests/sql/gorunen-ad-080.sh.
-- Bu dosya düzeneği kurar; deneme satırlarını `gorunen-ad-080-uret.mjs` üretir, sonra `gorunen-ad-080-son.sql`.
-- Her kontrol «TAMAM» / «KALDI» satırı basar; betik KALDI görürse çıkış 1.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

-- 053 sonrası canlı şeklin özü: display_name + eski CHECK.
CREATE TABLE public.users (id serial PRIMARY KEY, username text NOT NULL DEFAULT 'u', display_name text);
ALTER TABLE users ADD CONSTRAINT users_display_name_check CHECK (
  display_name IS NULL OR (char_length(display_name) BETWEEN 1 AND 50 AND display_name = btrim(display_name) AND display_name !~ '[\r\n\t]')
);
-- Canlıdaki gibi temiz adlar (6 satır, 0 şüpheli).
INSERT INTO users (display_name) VALUES ('Arda Günal'), ('Geek Evreni'), (NULL), ('李明');

\i /depo/supabase/schema/080_display_name_kurali.sql
-- İkinci kez: tekrar çalıştırılabilir olmalı.
\i /depo/supabase/schema/080_display_name_kurali.sql

CREATE TEMP TABLE sonuc (ad text, gecti boolean);

-- Kısıt kabul ediyor mu? Alt işlemde dener; 23514 = reddedildi, başka hata = sınama hatası.
CREATE FUNCTION pg_temp.kabul(p_ad text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    INSERT INTO users (display_name) VALUES (p_ad);
    DELETE FROM users WHERE display_name = p_ad;
    RETURN true;
  EXCEPTION WHEN check_violation THEN
    RETURN false;
  END;
END $$;

INSERT INTO sonuc SELECT 'kisit surum 2 tanimda (NFC + izin listesi + NFD isaret kurali)',
  pg_get_constraintdef(oid) LIKE '%IS NFC NORMALIZED%' AND position('normalize(display_name, nfd)' IN lower(pg_get_constraintdef(oid))) > 0
  FROM pg_constraint WHERE conname = 'users_display_name_check';
INSERT INTO sonuc SELECT 'mevcut temiz satirlar korundu', count(*) = 4 FROM users;
-- Uymayan satır varken GERÇEK 080: ADD CONSTRAINT düşer, işlem bütünüyle geri alınır.
-- (Kısıtı önce kaldırıp uymayan satır ekliyoruz; 080'in kendi DROP'u da geri alınınca kısıt YOK kalmalı.)
ALTER TABLE users DROP CONSTRAINT users_display_name_check;
INSERT INTO users (display_name) VALUES ('Arda ★');
\set ON_ERROR_STOP off
\i /depo/supabase/schema/080_display_name_kurali.sql
\set ON_ERROR_STOP on
INSERT INTO sonuc SELECT 'uymayan satir varken 080 hicbir sey degistirmez (kisit eklenmedi, satir duruyor)',
  NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_display_name_check')
  AND EXISTS (SELECT 1 FROM users WHERE display_name = 'Arda ★');
DELETE FROM users WHERE display_name = 'Arda ★';
\i /depo/supabase/schema/080_display_name_kurali.sql
INSERT INTO sonuc SELECT 'satir temizlenince 080 uygulanir', count(*) = 1 FROM pg_constraint WHERE conname = 'users_display_name_check';

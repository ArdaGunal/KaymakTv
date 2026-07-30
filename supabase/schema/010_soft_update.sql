-- Soft Update (İsteğe Bağlı Güncelleme) Şeması
--
-- app_settings tablosuna latest_version alanını ekler.
-- Bu alan, kullanıcılara "yeni sürüm mevcut" uyarısı göstermek için (fakat engellemeden) kullanılır.

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS latest_version TEXT NOT NULL DEFAULT '1.1.2';

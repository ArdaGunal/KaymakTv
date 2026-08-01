-- KaymakTV — error_logs Tablosuna Zaman Damgası Eklendi
--
-- Bu dosyayı Supabase Dashboard → SQL Editor'e yapıştırıp çalıştır.
--
-- BAĞLAM (bkz. docs/HISTORY.md Madde 136): Kullanıcı Discord bildiriminde
-- gerçek bir satır id'si (`return=representation` ile Supabase'den dönen,
-- UYDURMA DEĞİL) gördüğü halde Table Editor'de o satırı BULAMADI. `error_logs`
-- tablosunun birincil anahtarı bir UUID (`549054b7-...` gibi) — Table
-- Editor'ün varsayılan sıralaması bu sütuna göre yapılıyorsa (alfabetik/
-- rastgele görünümlü), YENİ eklenen bir satır listenin ORTASINA/SONUNA
-- düşebilir; "en üstte görünmüyor" izlenimi verir ama satır GERÇEKTEN oradadır.
--
-- ÇÖZÜM: Zamana göre sıralanabilir bir sütun ekleniyor. Postgres 11+'da
-- ADD COLUMN ... DEFAULT NOW() mevcut satırları da (ALTER anındaki zamanla)
-- doldurur — tabloyu YENİDEN YAZMAZ, hızlıdır. Worker tarafında (src/index.js)
-- HİÇBİR değişiklik gerekmiyor; sütun DB seviyesinde otomatik dolduruluyor.

ALTER TABLE error_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Table Editor'ü açtığında bu sütuna göre AZALAN (en yeni üstte) sırala —
-- veya doğrudan aşağıdaki sorguyla kontrol et:
-- SELECT id, created_at, user_id, device_info FROM error_logs ORDER BY created_at DESC LIMIT 20;

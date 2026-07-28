-- KaymakTV "Zorunlu Güncelleme" (Force Update) Şeması
--
-- Bu dosyayı Supabase Dashboard → SQL Editor'e yapıştırıp çalıştır.
--
-- AMAÇ: APK dağıtımı (Play Store dışı / henüz Play Store'a çıkmamış sürüm)
-- kritik bir güncelleme gerektirdiğinde, eski sürümdeki kullanıcıları
-- uygulama içinden geçilemez bir "Güncelleme Gerekli" ekranına yönlendirmek.
-- Yalnızca NATİF (Android APK) tarafında kullanılır — web her zaman en güncel
-- yayını sunduğu için bu kontrolden bilinçli olarak muaftır (bkz.
-- services/versionGate/checkAppVersion.ts).
--
-- GÜVENLİK NOTU: Bu proje Supabase Auth KULLANMIYOR (bkz. 001_feed_schema.sql
-- notu) — RLS yalnızca OKUMA (SELECT) izni veriyor. Bu tabloya YAZMA
-- (min_required_version/update_url güncelleme) Supabase Dashboard'dan elle
-- yapılır; istemci tarafında hiçbir yazma yolu yoktur.

-- ─────────────────────────────────────────────────────────────────────────
-- app_settings — Tek satırlık global uygulama ayarları
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE app_settings (
  -- Bilinçli olarak sabit tekil id: tabloda HER ZAMAN tam olarak bir satır
  -- olacağını garanti eder (istemci `id=1` ile sorgular), "hangi satır güncel"
  -- belirsizliğini yapısal olarak imkânsız kılar.
  id SMALLINT PRIMARY KEY DEFAULT 1,
  min_required_version TEXT NOT NULL,
  update_url TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT app_settings_single_row CHECK (id = 1)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select_all" ON app_settings
  FOR SELECT
  USING (true);

-- Başlangıç satırı: şimdilik hiçbir sürümü engellemesin diye mevcut yayın
-- sürümüyle aynı (`app.json` → expo.version). Gerçek bir zorunlu güncelleme
-- gerektiğinde Dashboard'dan `min_required_version` yükseltilir.
INSERT INTO app_settings (id, min_required_version, update_url)
VALUES (1, '1.1.1', 'https://kaymaktv.com')
ON CONFLICT (id) DO NOTHING;

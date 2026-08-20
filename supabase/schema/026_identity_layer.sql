-- ═══════════════════════════════════════════════════════════════════════════
-- 026 — Kimlik Katmanı: Trakt "anahtar" olmaktan çıkıp "bağlantı" oluyor (F7)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam: MASTER_PLAN F7 · REVIEWS_PLAN §9. Bugün `users.trakt_slug NOT NULL`
-- olduğu için Trakt'ı olmayan bir kullanıcının SATIRI BİLE OLUŞAMIYOR (S9).
-- Bu migration şemayı çok-sağlayıcılı kimliğe hazırlar; Google girişini
-- AÇMAZ (o F8).
--
-- 🔑 TASARIM: tek `users` satırı = tek kimlik. `trakt_slug` ve `google_sub`
-- o satırın İKİ BAĞLANTI KOLONU. Hesap birleştirme = bağlantıyı taşımak,
-- içeriği taşımak DEĞİL (REVIEWS_PLAN §9.3).
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Idempotent.
--
-- ⚠️ SIRA: Bu migration Worker deploy'undan ÖNCE çalıştırılabilir ve
-- çalıştırılmalıdır. Mevcut Worker `trakt_slug` NOT NULL varsayımıyla
-- yazılmadı (her zaman dolu gönderiyor), dolayısıyla kolonu NULLABLE yapmak
-- ESKİ Worker'ı KIRMAZ — geriye dönük uyumlu.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) `trakt_slug` → NULLABLE (UNIQUE KALIR)
-- ─────────────────────────────────────────────────────────────────────────
-- Postgres UNIQUE kısıtı birden fazla NULL'a izin verir (NULL != NULL), yani
-- "Trakt'ı olmayan N kullanıcı" mümkün olurken "aynı Trakt hesabı iki satırda"
-- hâlâ imkânsız. İstediğimiz tam olarak bu.
--
-- 🔴 F8 İÇİN KRİTİK UYARI (buraya yazılıyor ki kaybolmasın):
-- Worker'daki mevcut upsert `on_conflict=trakt_slug` kullanıyor. NULL'lar
-- ÇAKIŞMA ÜRETMEDİĞİ için, Google kullanıcısı bu yoldan geçerse HER GİRİŞTE
-- YENİ SATIR oluşur — F8'in önlemeye çalıştığı şeyin ta kendisi.
-- `resolveCaller`'ın Google dalı ASLA `trakt_slug` üzerinden upsert etmemeli;
-- `google_sub` üzerinden gitmeli.
ALTER TABLE users ALTER COLUMN trakt_slug DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) `auth_provider` — hangi sağlayıcıyla KAYDOLDU
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ BU KOLON UNIQUE DEĞİLDİR ve olmamalıdır. (F7 görev tanımında sehven
-- "auth_provider ve google_sub için UNIQUE" yazılmıştı — uygulanırsa tüm
-- sistemde toplam 2 kullanıcı olabilirdi, ikinci Trakt kullanıcısı
-- kaydolamazdı.) Bu yalnızca bir etikettir.
--
-- Anlamı "şu an hangisiyle giriyor" DEĞİL, "ilk nasıl kaydoldu" — bir
-- kullanıcı ikisine birden bağlıysa iki kolon da dolu olur, bu alan
-- değişmez. Analitik ve destek için tutuluyor.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'trakt';

-- Serbest metin kabul etmesin — yazım hatası sessizce yeni bir "sağlayıcı"
-- icat etmesin.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_provider_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_auth_provider_check
      CHECK (auth_provider IN ('trakt', 'google'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) `google_sub` — Google'ın KALICI kimliği (UNIQUE)
-- ─────────────────────────────────────────────────────────────────────────
-- `sub` seçildi, e-posta DEĞİL: kullanıcı Google hesabının e-postasını
-- değiştirebilir ama `sub` asla değişmez. E-postaya bağlanmak, e-posta
-- değişince kimliğin kopması demekti.
--
-- E-posta bu tabloda HİÇ SAKLANMIYOR — ihtiyaç yok ve `users_select_all`
-- (aşağıdaki nota bakınız) yüzünden saklamak doğrudan bir mahremiyet sızıntısı
-- olurdu.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_sub TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_google_sub_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_google_sub_key UNIQUE (google_sub);
  END IF;
END $$;

-- Kısmi index: `google_sub IS NOT NULL` araması (F8'in giriş yolu) tam tarama
-- yapmasın. UNIQUE kısıtın kendi index'i tüm NULL'ları da taşır; bu daha dar.
CREATE INDEX IF NOT EXISTS idx_users_google_sub
  ON users (google_sub) WHERE google_sub IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) 🔴 `google_sub` ANON KEY'DEN GİZLENİYOR — kolon seviyesinde GRANT
-- ─────────────────────────────────────────────────────────────────────────
-- SORUN: `001_feed_schema.sql` şunu tanımlıyor:
--     CREATE POLICY "users_select_all" ON users FOR SELECT USING (true);
-- Yani `users`'ın TÜM kolonları anon key ile okunabiliyor. `google_sub`
-- eklenince herkes herkesin Google kalıcı kimliğini çekebilirdi.
--
-- ÇÖZÜM: RLS satır seviyesindedir, ama KOLON seviyesinde GRANT vardır ve
-- PostgREST ona uyar (MASTER_PLAN Y15'in aynı tespiti). Aşağıda `anon` ve
-- `authenticated` rollerinden tablo geneli SELECT geri alınıp yalnızca
-- güvenli kolonlar tek tek veriliyor.
--
-- 🔴 NEDEN ŞİMDİ, SONRAYA BIRAKILMADAN: K1 açığı (HISTORY Madde 190) tam
-- olarak "istemci deploy'undan sonra kapatırım" diye ertelendiği için gerçek,
-- sömürülebilir bir açığa dönüşmüştü. Hassas kolon ile onu koruyan GRANT
-- AYNI migration'da olmalı.
--
-- ⚠️ KOLON LİSTESİ ELLE SAYILDI (001+002+007+021, silinenler hariç). Yeni bir
-- kolon eklenirse BURAYA DA eklenmeli, yoksa istemci onu okuyamaz ve sebebi
-- "RLS" sanılıp saatler kaybedilir. Doğrulama sorgusu dosyanın sonunda.
REVOKE SELECT ON users FROM anon, authenticated;

GRANT SELECT (
  id,
  username,
  avatar_url,
  is_private,
  created_at,
  updated_at,
  trakt_slug,
  publish_watches,
  publish_ratings,
  publish_manual,
  auth_provider
) ON users TO anon, authenticated;

-- `service_role` (Worker) kısıtlanmıyor — kimliği çözebilmesi için
-- `google_sub`'ı okuması ŞART ve o rol zaten RLS'i baypas ediyor.

-- ─────────────────────────────────────────────────────────────────────────
-- 5) Bütünlük: en az bir bağlantı kolonu dolu olmalı
-- ─────────────────────────────────────────────────────────────────────────
-- İkisi de NULL olan bir satır "hiçbir şekilde giriş yapılamayan kullanıcı"
-- demektir — sessiz bir yetim kayıt. Bir hata bunu üretirse kısıt anında
-- yakalasın.
DO $$
DECLARE orphan_count INT;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM users WHERE trakt_slug IS NULL AND google_sub IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      '026 DURDURULDU: % adet users satırında hiçbir bağlantı kolonu yok. '
      'Kısıt eklenemez. Önce incele: '
      'SELECT id, username, created_at FROM users '
      'WHERE trakt_slug IS NULL AND google_sub IS NULL;', orphan_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_has_identity_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_has_identity_check
      CHECK (trakt_slug IS NOT NULL OR google_sub IS NOT NULL);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- DOĞRULAMA (migration sonrası elle çalıştır)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1) trakt_slug artık nullable, google_sub geldi:
--    SELECT column_name, is_nullable, data_type
--    FROM information_schema.columns
--    WHERE table_name = 'users' ORDER BY ordinal_position;
--    → trakt_slug: is_nullable = 'YES'
--
-- 2) 🔴 EN ÖNEMLİSİ — anon `google_sub`'ı GÖREMEMELİ:
--    SELECT grantee, column_name FROM information_schema.column_privileges
--    WHERE table_name = 'users' AND privilege_type = 'SELECT'
--      AND grantee IN ('anon','authenticated')
--    ORDER BY grantee, column_name;
--    → listede `google_sub` OLMAMALI, diğer 11 kolon OLMALI.
--
-- 3) Canlı kanıt (anon key ile, istemcinin gördüğü yerden):
--    GET /rest/v1/users?select=google_sub  → 42501 / permission denied
--    GET /rest/v1/users?select=id,username → 200
--    ⚠️ İKİNCİSİNİ ATLAMA: yalnızca birincisini test etmek "her şeyi
--    kilitledim" hatasını gizler.
--
-- 4) Kısıtlar yerinde:
--    SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass;
--    → users_auth_provider_check · users_google_sub_key · users_has_identity_check

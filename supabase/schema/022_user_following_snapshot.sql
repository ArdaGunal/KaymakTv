-- ═══════════════════════════════════════════════════════════════════════════
-- 022 — Takip Listesi Snapshot'ı (F6, Kol B: Trakt'tan Bağımsızlık)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Tam tasarım gerekçesi: docs/FOLLOW_SNAPSHOT_PLAN.md
--
-- NEDEN: Akışın "kimin aktivitesini görebilirim" kümesi bugün TAMAMEN Trakt'ın
-- `/users/me/following` ucundan geliyor. Trakt kapanırsa bu grafik GERİ
-- GETİRİLEMEZ — ve F8'de Google girişi açıldığında o kullanıcının sosyal
-- grafiği sıfırdan başlar. Bu tek yönlü bir kapı: bugün yakalamazsak, sonra
-- yakalayamayız.
--
-- ⚠️ BU BİR YAZMA SİSTEMİ DEĞİL. `004_drop_user_follows.sql` ile kaldırılan
-- `user_follows` tablosu GERİ GELMİYOR. Takip/çıkış işlemleri Trakt'ta
-- yapılmaya devam edecek; bu tablo tek yönlü bir SENKRON KOPYASI.
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Idempotent.
--
-- ✅ SIRA BAĞIMLILIĞI YOK (020/021'in aksine — bilinçli bir avantaj):
-- migration çalıştırılmadan Worker deploy edilirse snapshot yazımı 404/42P01
-- alır, fail-soft yakalanır ve senkron 200 dönmeye devam eder. Akış etkilenmez.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Tablo — TEK SATIR + dizi (kenar tablosu DEĞİL)
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN kenar tablosu (follower_id, followed_slug) DEĞİL:
--   • Kullanıcı başına N satır → her senkronda oku-karşılaştır-yaz diff döngüsü
--     gerekirdi (`feed_activities`'teki gibi), yani yeni bir hata yüzeyi.
--   • BOŞ LİSTE TEMSİL EDİLEMEZDİ: satır yoksa "hiç senkron olmadı" mı
--     "gerçekten kimseyi takip etmiyor" mu ayırt edilemezdi. Bu ayrım F6'nın
--     merkezinde (bkz. aşağıdaki `synced_at`).
--
-- Tek satır + dizi ile: tek upsert, diff kodu YOK, boş liste `'{}'` ile
-- temsil edilir, `synced_at` bedava gelir.
--
-- NEDEN `users`'a kolon değil: `users_select_all USING(true)` yüzünden oraya
-- eklenen HER kolon anon key ile herkese açık olur (MASTER_PLAN S11). Takip
-- grafiği için bu kabul edilemez.
--
-- NEDEN slug, `users.id` FK'si değil: `getVisibleUserIds` zaten slug→id
-- çeviriyor. FK kullanmak, henüz KaymakTV'ye katılmamış kişileri SESSİZCE
-- düşürürdü — oysa Trakt sonrası dünyada onlar katıldığında grafiği
-- kurabilmek bu fazın asıl amacı.
CREATE TABLE IF NOT EXISTS user_following_snapshot (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  following_slugs TEXT[] NOT NULL DEFAULT '{}',
  -- Son BAŞARILI yakalama. Worker'ın 12 saatlik tazelik kapısı bunu okur;
  -- başarısız bir Trakt yanıtı bu değeri DEĞİŞTİRMEZ (bkz. captureFollowingSnapshot).
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Kötüye kullanım/bozuk yanıt tavanı. Aşan liste Worker'da KIRPILIR ve
  -- console.warn düşer — yazma reddedilmez (gerçekten 5000+ takip meşru olabilir
  -- ama o noktada zaten başka bir sorunumuz var demektir).
  CONSTRAINT following_slugs_bounded
    CHECK (COALESCE(array_length(following_slugs, 1), 0) <= 5000)
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) RLS — AÇIK ama POLİTİKA YOK (bilinçli)
-- ─────────────────────────────────────────────────────────────────────────
-- Postgres'te RLS açık + politika yok = anon key HİÇBİR ŞEY okuyamaz/yazamaz.
-- `service_role` (Worker) RLS'i bypass eder, dolayısıyla yakalama çalışır.
--
-- ⚠️ NEDEN OKUMA POLİTİKASI VERİLMİYOR — F6'nın en önemli kararı:
-- İstemcinin snapshot'ı okuması için politika `USING(true)` olmak zorundaydı
-- (Supabase Auth yok → RLS `auth.uid()` veremez). O da anon key'le — ki
-- bundle'da, yani fiilen public — HERKESİN takip grafiğinin dökülebilmesi
-- demekti. Üstelik Trakt'ta GİZLİ hesapların following listesi dışarıdan
-- görünmezken, `/users/me/following` kendi token'ıyla çağrıldığı için onu da
-- getirir → Trakt'ta OLMAYAN bir sızıntı yaratırdı.
--
-- Okuma yolu ZATEN GEREKMİYOR: istemci dayanıklılığı yerel kopyayla çözülüyor
-- (`followStore` listeyi AsyncStorage'a kalıcılaştırıyor). Sunucu snapshot'ı
-- F6'da yalnızca YAZILIR.
--
-- Okuma politikası, kimlik doğrulaması Trakt'tan koptuğunda (F7/F8) açılacak.
-- Kapalı RLS sonradan açılabilir; açık RLS geri KAPATILAMAZ (veri çoktan
-- kopyalanmış olur). Tek yönlü kapı doğru yöne bakıyor.
ALTER TABLE user_following_snapshot ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Gizli (private) Trakt hesapları — KAYIT ALTINA ALINAN KARAR
-- ─────────────────────────────────────────────────────────────────────────
-- Gizli hesapların following listesi de yakalanıyor. Gerekçe: mevcut gizlilik
-- kuralı (`handleFeedSync` isPrivate dalı) "SENİN aktiviten başkasına
-- görünmesin" der; "sen KİMİ görebilirsin" ayrı bir sorudur ve akışın
-- çalışması için gereklidir.
--
-- ⚠️ G2'DE YENİDEN DEĞERLENDİRİLECEK: okuma politikası bir gün açılırsa
-- gizli hesaplar için AYRI bir karar gerekir — bu tablo o gün otomatik olarak
-- açılmamalıdır.

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması
-- ─────────────────────────────────────────────────────────────────────────
--   Tablo ve kısıtlar geldi mi?
--     select conname, contype from pg_constraint
--     where conrelid = 'user_following_snapshot'::regclass;
--     -- beklenen: PK (p) + following_slugs_bounded (c) + FK (f)
--
--   RLS açık mı?
--     select relrowsecurity from pg_class
--     where oid = 'user_following_snapshot'::regclass;   -- true olmalı
--
--   Politika gerçekten YOK mu? (boş dönmeli)
--     select policyname from pg_policies
--     where tablename = 'user_following_snapshot';
--
--   ✅ ANON KEY TESTİ (PostgREST üzerinden, T8):
--     GET  /rest/v1/user_following_snapshot?select=*   → 200 + []  (0 satır görünür)
--     POST /rest/v1/user_following_snapshot            → 401 + 42501
--     ⚠️ Sadece HTTP koduna BAKMA — GET'in [] dönmesi "politika yok" demektir,
--        "tablo boş" demek DEĞİL (bkz. MASTER_PLAN §4.2'deki aynı tuzak).
--        Worker yazdıktan SONRA da [] dönmeye devam etmeli.
--
--   Worker yazdı mı (service_role ile, Supabase SQL Editor'den):
--     select user_id, array_length(following_slugs,1) as adet, synced_at
--     from user_following_snapshot;

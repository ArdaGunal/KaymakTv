-- ═══════════════════════════════════════════════════════════════════════════
-- 018 — İçerik Bildirme (Report) — Google Play UGC politikası gereksinimi
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam: google_play_eksikler.md Aşama 2 — "İçeriği Bildir" hiçbir yüzeyde
-- yoktu (CardMenu, FeedCommentItem, Trakt yorumları). Bu tablo o bildirimleri
-- saklar.
--
-- ⚠️ MİMARİ SAPMA (bilinçli): Projedeki TÜM diğer yazma işlemleri (blok,
-- yorum, beğeni) Worker'ın service_role anahtarıyla yapılıyor (bkz. 001, 015,
-- 016) — bu tablonun Worker'ı YOK, Worker'ın kaynak kodu bu repoda değil
-- (ayrı bir Cloudflare Workers projesi). Bildirme fonksiyonunun GERÇEKTEN
-- çalışması için (yeni bir Worker endpoint'i deploy etmeyi beklemeden) anon
-- key ile DOĞRUDAN INSERT'e izin veriliyor — ama diğer tablolardaki "herkese
-- açık OKU" modelinden DAHA KISITLI: bu tabloya hiçbir SELECT/UPDATE/DELETE
-- politikası YOK, yani anon key ile yazılabilir ama okunamaz. Satırları
-- yalnızca service_role (Supabase Dashboard → Table Editor, moderasyon için)
-- görebilir. İleride ayrı bir Worker endpoint'i eklenirse bu INSERT
-- politikası kaldırılıp yazma da Worker'a taşınabilir — bkz. aşağıdaki not.
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Idempotent.

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Bildiren kullanıcı — misafir veya henüz KaymakTV'de hiç senkron
  -- tetiklememiş biri olabilir, bu yüzden NULL'a izin var (kim olduğu
  -- bilinmese bile bildirim yine de değerlidir).
  reporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- 'activity' → feed_activities.id (UUID) · 'comment' → comments.id (UUID)
  -- 'trakt_comment' → Trakt'ın kendi sayısal yorum id'si (bizim DB'mizde
  -- karşılığı yok, FK kurulamaz — bu yüzden target_id TEXT).
  target_type TEXT NOT NULL CHECK (target_type IN ('activity', 'comment', 'trakt_comment')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'spoiler', 'illegal', 'other')),
  detail TEXT CHECK (detail IS NULL OR char_length(detail) <= 500),
  -- Moderasyon durumu — şimdilik yalnızca Dashboard'dan elle güncellenir,
  -- istemci hiçbir zaman bu kolona yazmaz/okumaz (INSERT WITH CHECK zaten
  -- yalnızca 'open' değerine izin verir, bkz. aşağı).
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_reports_target ON content_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Yalnızca INSERT — 'open' dışında bir status veya spam metin (>500) ile
-- yazmaya çalışmak zaten yukarıdaki CHECK kısıtlarına takılır. reporter_user_id
-- sahte bir UUID ile de gönderilebilir teoride (anon key, kimlik doğrulaması
-- yok) — ama bu tablo yalnızca moderasyon SİNYALİ, yetki/erişim kontrolü
-- vermiyor, spoof riski `user_blocks`teki okuma modeliyle aynı kabul
-- edilebilir sınıfta.
DROP POLICY IF EXISTS "content_reports_insert_anon" ON content_reports;
CREATE POLICY "content_reports_insert_anon" ON content_reports
  FOR INSERT
  WITH CHECK (status = 'open');

-- SELECT/UPDATE/DELETE politikası YOK — istemci bildirilen satırları hiçbir
-- şekilde okuyamaz/değiştiremez, yalnızca ekleyebilir. Moderasyon Supabase
-- Dashboard → Table Editor'den elle yapılır.

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması (isteğe bağlı)
-- ─────────────────────────────────────────────────────────────────────────
--   select conname from pg_constraint where conrelid = 'content_reports'::regclass;
--   select policyname, cmd from pg_policies where tablename = 'content_reports';
--
--   Anon key ile test insert (SQL Editor'de "anon" rolüyle çalıştırmayı
--   simüle etmek gerekir; en pratik test istemciden gerçek bir bildirim
--   göndermek):
--     insert into content_reports (target_type, target_id, reason)
--     values ('activity', '00000000-0000-0000-0000-000000000000', 'spam');
--     -- beklenen: başarılı (target_id gerçek bir FK değil, bilinçli olarak
--     -- kontrol edilmiyor — silinmiş bir aktivite de bildirilebilmeli).

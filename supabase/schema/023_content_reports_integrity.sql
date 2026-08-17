-- ═══════════════════════════════════════════════════════════════════════════
-- 023 — Moderasyon Altyapısı Düzeltmesi (F9, S15)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam: docs/MASTER_PLAN.md → F9. **F10'DAN ÖNCE ÇALIŞTIRILMASI ŞART.**
--
-- 🔴 NEDEN: `018_content_reports.sql` ile gelen tabloda
-- `UNIQUE(reporter_user_id, target_type, target_id)` YOK ve `reporter_user_id`
-- NULL olabiliyor. Bugün zararsız çünkü otomatik gizleme kapalı — ama F10
-- (N rapor alan içerik akıştan düşer) bu düzeltme olmadan açılırsa
-- **tek kişi aynı içeriği N kez raporlayıp istediği yorumu sansürleyebilir.**
-- Otomatik gizlemeyi bu kısıt olmadan açmak, doğrudan bir kötüye kullanım
-- aracı yaratmaktır.
--
-- ⚠️ UNIQUE TEK BAŞINA YETMEZ: Postgres'te `NULL != NULL` olduğu için
-- `reporter_user_id` nullable kaldığı sürece aynı kişi NULL kimlikle sınırsız
-- satır ekleyebilir ve kısıt hiç devreye girmez. Bu yüzden üç değişiklik
-- BİRLİKTE yapılmak zorunda: NOT NULL + UNIQUE + yazmanın Worker'a taşınması
-- (kimlik ancak orada doğrulanabilir).
--
-- Supabase SQL Editor'de çalıştırılır. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- BÖLÜM A — kısıtlar (Worker deploy'undan ÖNCE veya SONRA, fark etmez)
-- ─────────────────────────────────────────────────────────────────────────

-- A1) ÖN KONTROL: NOT NULL yapılamayacak satır var mı?
-- Bilinçli olarak SİLMİYORUZ — moderasyon sinyali veri kaybına uğramasın.
-- Satır varsa migration DURUR ve kararı insana bırakır.
DO $$
DECLARE null_count INT;
BEGIN
  SELECT count(*) INTO null_count FROM content_reports WHERE reporter_user_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION
      '023 DURDURULDU: content_reports içinde reporter_user_id NULL olan % satır var. '
      'Bunlar misafir/kimliksiz bildirimler. Karar senin: (a) incele ve sil, '
      '(b) bir kullanıcıya bağla. Silmek için: '
      'DELETE FROM content_reports WHERE reporter_user_id IS NULL;', null_count;
  END IF;
END $$;

-- A2) ÖN KONTROL: UNIQUE'i ihlal edecek tekrar var mı?
DO $$
DECLARE dup_count INT;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT 1 FROM content_reports
    WHERE reporter_user_id IS NOT NULL
    GROUP BY reporter_user_id, target_type, target_id
    HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      '023 DURDURULDU: aynı kullanıcının aynı hedefi birden çok kez bildirdiği % grup var. '
      'En eskisini tutup diğerlerini silmek için: '
      'DELETE FROM content_reports a USING content_reports b '
      'WHERE a.reporter_user_id = b.reporter_user_id AND a.target_type = b.target_type '
      'AND a.target_id = b.target_id AND a.created_at > b.created_at;', dup_count;
  END IF;
END $$;

-- A3) FK davranışı: SET NULL → CASCADE
-- ⚠️ ŞART: `ON DELETE SET NULL` ile `NOT NULL` BİRBİRİYLE ÇELİŞİR — kullanıcı
-- silindiğinde Postgres kolonu NULL yapmaya çalışır ve NOT NULL kısıtına
-- takılır; yani hesap silme İŞLEMİ BAŞARISIZ OLURDU.
--
-- CASCADE kararı: hesabını silen kullanıcının bildirimleri de gider. Tutarlı —
-- `handleAccountDelete` zaten `users` satırını silip feed_activities/comments'i
-- CASCADE ile kaldırıyor (hesap silme = tüm verinin silinmesi).
ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_reporter_user_id_fkey;
ALTER TABLE content_reports
  ADD CONSTRAINT content_reports_reporter_user_id_fkey
  FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- A4) Kimlik zorunlu
ALTER TABLE content_reports ALTER COLUMN reporter_user_id SET NOT NULL;

-- A5) Kişi başına hedef başına TEK bildirim
ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_unique_reporter_target;
ALTER TABLE content_reports
  ADD CONSTRAINT content_reports_unique_reporter_target
  UNIQUE (reporter_user_id, target_type, target_id);

-- ─────────────────────────────────────────────────────────────────────────
-- BÖLÜM B — anon yazma kapatılır
-- ─────────────────────────────────────────────────────────────────────────
-- 🔴 SIRA BAĞIMLILIĞI: bu bölüm, Worker `/feed/report` ucu DEPLOY EDİLDİKTEN
-- ve istemci ona yazmaya BAŞLADIKTAN sonra çalıştırılmalı. Erken çalıştırılırsa
-- güncellenmemiş istemcilerdeki bildirme özelliği kırılır (RLS reddeder).
--
-- Bölüm A'dan ayrı tutulmasının sebebi bu: A güvenle hemen çalıştırılabilir,
-- B bir dağıtım penceresi ister.
--
-- 018'in "MİMARİ SAPMA" notu bu adımla kapanıyor: o gün Worker'ın kaynak kodu
-- erişilebilir olmadığı için anon INSERT'e izin verilmişti ve not açıkça
-- "ileride ayrı bir Worker endpoint'i eklenirse bu INSERT politikası
-- kaldırılıp yazma da Worker'a taşınabilir" diyordu. O gün geldi.
--
-- ⬇️ AŞAĞIDAKİ SATIRIN YORUMUNU BÖLÜM B ZAMANI GELİNCE KALDIR:
--
-- DROP POLICY IF EXISTS "content_reports_insert_anon" ON content_reports;
--
-- Sonrasında tabloda HİÇBİR politika kalmaz (SELECT/UPDATE/DELETE zaten yoktu)
-- → anon key ne okuyabilir ne yazabilir; yalnızca service_role (Worker +
-- Dashboard) erişir. `user_following_snapshot` (022) ile aynı model.

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması
-- ─────────────────────────────────────────────────────────────────────────
--   Kısıtlar geldi mi? (unique + not null + fk CASCADE görünmeli)
--     select conname, contype, pg_get_constraintdef(oid)
--     from pg_constraint where conrelid = 'content_reports'::regclass;
--
--   Kolon NOT NULL mu?
--     select column_name, is_nullable from information_schema.columns
--     where table_name = 'content_reports' and column_name = 'reporter_user_id';
--
--   UNIQUE gerçekten çalışıyor mu? (İKİNCİSİ HATA VERMELİ — 23505)
--     insert into content_reports (reporter_user_id, target_type, target_id, reason)
--     values ('<gerçek users.id>', 'activity', 'test-target', 'spam');
--     insert into content_reports (reporter_user_id, target_type, target_id, reason)
--     values ('<aynı users.id>', 'activity', 'test-target', 'spam');
--     -- temizlik: delete from content_reports where target_id = 'test-target';
--
--   Bölüm B sonrası politika kalmadı mı? (boş dönmeli)
--     select policyname, cmd from pg_policies where tablename = 'content_reports';

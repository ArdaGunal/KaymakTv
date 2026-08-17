-- ═══════════════════════════════════════════════════════════════════════════
-- 021 — Elle Yazılan İçerik İçin Akış Görünürlüğü (`publish_manual`)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam ve tüm gerekçeler: docs/FEED_VISIBILITY_PLAN.md
-- Tetikleyici: F4 cihaz testi — kullanıcı, `reviewed`/`posted` için hiçbir
-- gizlilik anahtarı olmadığını fark etti. "Aktivitemi Akışta Gizle" açıkken
-- bile incelemeleri ve gönderileri akışta kalıyordu.
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Idempotent.
--
-- ⚠️ SIRA: bu migration çalıştırıldıktan SONRA Worker deploy edilmeli ve
-- istemci güncellenmeli. Ters sırada `publish_manual` kolonu bulunamaz ve
-- gizlilik ayarları ekranı hata verir (`020`'deki aynı sert bağımlılık).

-- ─────────────────────────────────────────────────────────────────────────
-- 1) `users.publish_manual` — TEK GERÇEK KAYNAK
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ "008'de kaldırılan bayrak geri mi geliyor?" — HAYIR, farklı bir şey.
--
-- 008 `users.feed_hidden`'ı kaldırdı çünkü o gün `feed_hidden=true` ile
-- `publish_watches=false AND publish_ratings=false` BİREBİR AYNI şeydi —
-- iki gerçeği tutan üç sütun, çelişkiye açık kapı.
--
-- O denklik ARTIK GEÇERLİ DEĞİL: 017 (`posted`) ve 019 (`reviewed`) ile iki
-- yeni aktivite tipi geldi ve hiçbir ayarın kapsamında değiller. Yani
-- "izleme kapalı + puan kapalı" bugün "her şey gizli" ANLAMINA GELMİYOR;
-- temsil edilmeyen üçüncü bir durum var.
--
-- 008'in İLKESİ korunuyor: üç ayar AYRIK kümeler (hiçbiri diğerinin gerçeğini
-- tutmuyor) ve "Her Şeyi Gizle" hâlâ DB'de DEĞİL, üçünden TÜRETİLİYOR.
--
--   publish_watches → watched_episode, watched_movie   (kapatılınca SİLİNİR)
--   publish_ratings → rated                            (kapatılınca SİLİNİR)
--   publish_manual  → reviewed, posted                 (kapatılınca GİZLENİR)
--
-- ⚠️ NEDEN SİLİNMİYOR: Madde 165 kararı — "bir kullanıcının emek verip
-- yazdığı içeriği silmek kabul edilemez". İzleme/puan Trakt'ın aynasıdır,
-- silinse bir sonraki senkron geri getirir; inceleme geri getirilemez.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS publish_manual BOOLEAN NOT NULL DEFAULT true;

-- ⚠️ MAHREMİYET NOTU (bkz. MASTER_PLAN S11): `users_select_all USING(true)`
-- yüzünden bu kolon da anon key ile herkese okunabilir olacak — mevcut
-- `publish_watches`/`publish_ratings` ile aynı durumda. Yeni bir açık
-- yaratmıyor ama S11'in kapsamına bir alan daha ekliyor. F11'de `user_settings`
-- tablosuna taşınacak alanlar listesine BU DA dahildir.

-- ─────────────────────────────────────────────────────────────────────────
-- 2) `feed_activities.author_hides_manual` — TÜRETİLMİŞ KOPYA
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN GEREKLİ: `in_feed` bir GENERATED kolon ve Postgres'te GENERATED
-- ifadesi YALNIZCA aynı satırdaki kolonlara bakabilir — `users` tablosuna
-- JOIN yapamaz. Bu yüzden yazarın ayarı satıra yansıtılıyor.
--
-- ⚠️ BU ELLE YÖNETİLEN BİR BAYRAK DEĞİL — aşağıdaki İKİ TRIGGER yönetiyor.
-- 008'in tuzağı bayrağın elle yazılması ve ikinci bir gerçek kaynağa
-- dönüşmesiydi. Burada tek gerçek kaynak `users.publish_manual`; bu kolon
-- Postgres tarafından türetiliyor, senkron dışı kalması imkânsız.
-- (Aynı ilke: 020'de `in_feed`'in elle bayrak yerine GENERATED yapılması.)
ALTER TABLE feed_activities
  ADD COLUMN IF NOT EXISTS author_hides_manual BOOLEAN NOT NULL DEFAULT false;

-- Mevcut satırlar için geri doldurma. 4. adımdan ÖNCE olmalı: `in_feed`
-- yeniden oluşturulurken bu değerin doğru olması gerekiyor.
UPDATE feed_activities fa
SET author_hides_manual = NOT u.publish_manual
FROM users u
WHERE u.id = fa.user_id
  AND fa.author_hides_manual IS DISTINCT FROM (NOT u.publish_manual);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) `in_feed` ifadesi genişliyor
-- ─────────────────────────────────────────────────────────────────────────
-- Postgres'te bir GENERATED kolonun ifadesi ALTER ile DEĞİŞTİRİLEMEZ —
-- DROP + ADD şart. Güvenli: 020'de bilinçli olarak bu kolona AYRI BİR İNDEKS
-- EKLENMEMİŞTİ ("seçiciliği düşük, indeks faydasız olurdu"), dolayısıyla
-- düşürülecek bağımlı bir nesne yok.
--
-- ⚠️ KISA KESİNTİ: DROP ile ADD arasında akış sorgusunun `.eq('in_feed', true)`
-- filtresi "kolon yok" hatası verir. İki ifade tek transaction'da çalıştığı
-- için pencere milisaniyelerdir; yine de migration yoğun saatte
-- çalıştırılmamalı.
--
-- Yeni kural iki parçalı:
--   (a) 020'den gelen: bölüm incelemeleri ana akışa düşmez
--   (b) YENİ: yazarı elle yazdığı içeriği gizliyorsa reviewed/posted düşmez
ALTER TABLE feed_activities DROP COLUMN IF EXISTS in_feed;
ALTER TABLE feed_activities
  ADD COLUMN in_feed BOOLEAN
  GENERATED ALWAYS AS (
    NOT (activity_type = 'reviewed' AND episode_number IS NOT NULL)
    AND NOT (activity_type IN ('reviewed', 'posted') AND author_hides_manual)
  ) STORED;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) TRIGGER #1 — yeni satır yazarın ayarını devralır
-- ─────────────────────────────────────────────────────────────────────────
-- Worker'ın bu kolonu bilmesine GEREK YOK; bilmesi gerekseydi zaten elle
-- yönetilen bir bayrak olurdu (008'in tuzağı).
CREATE OR REPLACE FUNCTION feed_activities_set_author_hides_manual()
RETURNS TRIGGER AS $$
BEGIN
  SELECT NOT COALESCE(u.publish_manual, TRUE)
    INTO NEW.author_hides_manual
  FROM users u
  WHERE u.id = NEW.user_id;

  -- Kullanıcı satırı yoksa (FK yüzünden olmamalı) görünür varsay — bir
  -- içeriği yanlışlıkla gizlemektense göstermek, "gizle" ayarını hiç
  -- vermemiş bir kullanıcı için doğru olandır.
  IF NEW.author_hides_manual IS NULL THEN
    NEW.author_hides_manual := FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feed_activities_author_hides_manual ON feed_activities;
CREATE TRIGGER trg_feed_activities_author_hides_manual
  BEFORE INSERT ON feed_activities
  FOR EACH ROW
  EXECUTE FUNCTION feed_activities_set_author_hides_manual();

-- ─────────────────────────────────────────────────────────────────────────
-- 5) TRIGGER #2 — ayar değişince satırlara yayılır
-- ─────────────────────────────────────────────────────────────────────────
-- Zincir: users.publish_manual → author_hides_manual → in_feed (GENERATED,
-- kendiliğinden) → akış sorgusu. Akış sorgusu HİÇ DEĞİŞMİYOR.
--
-- TÜM satırlar güncelleniyor (yalnızca reviewed/posted değil) ki kolon her
-- satırda dürüst kalsın; `in_feed` zaten tipe göre karar veriyor. Maliyet
-- düşük: retention kullanıcı başına ~200 satırla sınırlı (bkz. 014).
CREATE OR REPLACE FUNCTION users_propagate_publish_manual()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE feed_activities
  SET author_hides_manual = NOT NEW.publish_manual
  WHERE user_id = NEW.id
    AND author_hides_manual IS DISTINCT FROM (NOT NEW.publish_manual);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_propagate_publish_manual ON users;
CREATE TRIGGER trg_users_propagate_publish_manual
  AFTER UPDATE OF publish_manual ON users
  FOR EACH ROW
  WHEN (OLD.publish_manual IS DISTINCT FROM NEW.publish_manual)
  EXECUTE FUNCTION users_propagate_publish_manual();

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması
-- ─────────────────────────────────────────────────────────────────────────
--   Kolonlar geldi mi?
--     select column_name, data_type, column_default, is_generated
--     from information_schema.columns
--     where (table_name='users' and column_name='publish_manual')
--        or (table_name='feed_activities'
--            and column_name in ('author_hides_manual','in_feed'));
--
--   in_feed yeni ifadeyi taşıyor mu? (author_hides_manual görünmeli)
--     select generation_expression from information_schema.columns
--     where table_name='feed_activities' and column_name='in_feed';
--
--   Trigger'lar kurulu mu? (2 satır dönmeli)
--     select tgname, tgrelid::regclass from pg_trigger
--     where tgname in ('trg_feed_activities_author_hides_manual',
--                      'trg_users_propagate_publish_manual');
--
--   ✅ CANLI ZİNCİR TESTİ — bunu mutlaka çalıştır:
--     -- kapat
--     update users set publish_manual = false where trakt_slug = '<slug>';
--     select activity_type, author_hides_manual, in_feed
--     from feed_activities
--     where user_id = (select id from users where trakt_slug='<slug>')
--     order by activity_type;
--     -- reviewed/posted satırlarında in_feed = false GÖRÜLMELİ
--
--     -- geri aç
--     update users set publish_manual = true where trakt_slug = '<slug>';
--     -- aynı select: in_feed yeniden true OLMALI (satırlar hiç silinmedi)

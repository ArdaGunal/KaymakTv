-- ═══════════════════════════════════════════════════════════════════════════
-- 017 — Bağımsız Gönderiler ("Fikir Paylaş") — opsiyonel yapım + 1000 karakter
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam: docs/FEED_SOCIAL_PLAN.md'nin devamı. Kullanıcı, izleme/puanlama
-- olayına bağlı olmayan, tamamen bağımsız bir "gönderi" tipi istedi:
-- "Bilimkurgu dizi önerisi olan var mı?" gibi genel sorular da sorulabilsin
-- diye yapım seçimi OPSİYONEL. Yeni tablo AÇILMADI — mevcut `feed_activities`
-- zaten bunun için tasarlanmıştı (bkz. FeedCard.tsx'teki ACTIVITY_META
-- yorumu: "yeni bir tip eklemek bu map'e bir satır eklemek kadar basit
-- olacak şekilde tasarlandı") — sayfalama, Realtime, beğeni, yorum, retention
-- HEPSİ bedavaya çalışıyor.
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) activity_type: 'posted' eklendi
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE feed_activities DROP CONSTRAINT IF EXISTS feed_activities_activity_type_check;
ALTER TABLE feed_activities
  ADD CONSTRAINT feed_activities_activity_type_check CHECK (
    activity_type IN ('watched_episode', 'watched_movie', 'started_show', 'completed_show', 'rated', 'posted')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Yapım alanları artık OPSİYONEL — yalnızca 'posted' tipi NULL bırakabilir
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN: Kullanıcı "yapım seçimi zorunlu olmasın, genel bir soru da
-- sorulabilsin" dedi. show_id/show_title şu ana kadar HER ZAMAN doluydu
-- (diğer 5 tip için Worker hâlâ zorunlu tutuyor, bkz. index.js) — yalnızca
-- DB seviyesinde artık NULL'a izin veriliyor.
ALTER TABLE feed_activities ALTER COLUMN show_id DROP NOT NULL;
ALTER TABLE feed_activities ALTER COLUMN show_title DROP NOT NULL;
ALTER TABLE feed_activities ALTER COLUMN media_type DROP NOT NULL;
-- `media_type`nin CHECK (IN ('show','movie')) kısıtı DOKUNULMADI — Postgres'te
-- bir CHECK, NULL değerlere karşı otomatik olarak "geçti" sayılır (UNKNOWN,
-- FALSE değil), yani NOT NULL kaldırıldığı an NULL değerler zaten sorunsuz
-- kabul edilir, ekstra bir değişiklik gerekmez.

-- Savunma katmanı (defense-in-depth, DB gerçek kaynak): yalnızca 'posted'
-- tipi show_id'siz olabilir — diğer 5 tip için hâlâ zorunlu. Worker zaten
-- bunu ayrıca doğruluyor (bkz. handleFeedPost/handleFeedPublish/
-- handleFeedSync), bu CHECK yalnızca son savunma hattı.
ALTER TABLE feed_activities DROP CONSTRAINT IF EXISTS feed_activities_show_required_unless_posted;
ALTER TABLE feed_activities
  ADD CONSTRAINT feed_activities_show_required_unless_posted CHECK (
    activity_type = 'posted' OR show_id IS NOT NULL
  );

-- 'posted' tipinin `note`u HER ZAMAN dolu olmalı — bir gönderinin içeriği
-- budur, boş bir gönderi anlamsız. Bu kural aynı zamanda mevcut yorum
-- kısıtlamasını (`note IS NOT NULL OR rating IS NOT NULL` → yorum yapılabilir)
-- 'posted' tipi için OTOMATİK sağlıyor, ek kod gerekmeden.
ALTER TABLE feed_activities DROP CONSTRAINT IF EXISTS feed_activities_posted_requires_note;
ALTER TABLE feed_activities
  ADD CONSTRAINT feed_activities_posted_requires_note CHECK (
    activity_type != 'posted' OR note IS NOT NULL
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3) note karakter sınırı: 500 → 1000
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN TEK, BİRLEŞİK SINIR (tipe göre ayrı ayrı DEĞİL): `note` kolonu hem
-- "izlediğim bir şeye eklediğim kısa alıntı" hem "bağımsız gönderi" için
-- kullanılıyor. Kullanıcının isteği: gönderiler 1000, YORUMLAR (`comments`
-- tablosu, AYRI) 500 kalsın. Bu ikisi zaten AYRI kolonlar/tablolar olduğu
-- için `comments.body`'ye HİÇ dokunulmadı (hâlâ 500, bkz. 015). `note`
-- kolonunu tipe göre koşullu sınırlamak (ör. "posted ise 1000, değilse 500")
-- gereksiz bir karmaşıklıktı — bir alıntıya da isterse 1000 karaktere kadar
-- yazabilmesi zararsız, tek ve basit bir CHECK yeterli.
ALTER TABLE feed_activities DROP CONSTRAINT IF EXISTS feed_activities_note_length;
ALTER TABLE feed_activities
  ADD CONSTRAINT feed_activities_note_length CHECK (note IS NULL OR char_length(note) <= 1000);

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması (isteğe bağlı)
-- ─────────────────────────────────────────────────────────────────────────
--   select conname from pg_constraint where conrelid = 'feed_activities'::regclass;
--   select is_nullable from information_schema.columns where table_name='feed_activities' and column_name in ('show_id','show_title','media_type');

-- ═══════════════════════════════════════════════════════════════════════════
-- 013 — Akış'ı gerçek zamanlı bir sosyal akışa dönüştüren şema değişiklikleri
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam: Akış'a bir aktivite YALNIZCA uygulama açılışındaki `/feed/sync` ile
-- düşüyordu — kullanıcı bir bölüm izleyip işaretlediğinde, akışta görünmesi
-- için uygulamadan çıkıp geri girmesi gerekiyordu. Bu migration, "anında
-- yayın" (`/feed/publish`) ve "canlı akış" (Supabase Realtime) için gereken
-- alanları/indeksleri ekler.
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Tamamen idempotent (IF NOT
-- EXISTS / DO blokları) — yanlışlıkla iki kez çalıştırmak zararsızdır.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) media_type — 'show' | 'movie'
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN: `show_id` kolonu bugüne kadar HEM dizi HEM film trakt id'sini
-- tutuyordu (bkz. worker: "NOT: film ID'si de aynı `show_id` kolonunda
-- tutulur") ve satırın hangisi olduğunu ayırt etmenin HİÇBİR yolu yoktu.
-- Sonuç: akış kartından bir FİLM puanına tıklandığında uygulama `/show/{id}`
-- rotasına gidiyordu — yanlış sayfa, çoğu zaman "bulunamadı".
--
-- Geriye dönük doldurma: mevcut satırlar için tip bilinmiyor. 'show'
-- varsayılıyor çünkü `watched_episode` (satırların büyük çoğunluğu) tanım
-- gereği dizidir; eski `rated` satırlarındaki filmler bir sonraki tam
-- senkronda kendiliğinden doğru değere güncellenir.
ALTER TABLE feed_activities
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'show'
  CHECK (media_type IN ('show', 'movie'));

-- ─────────────────────────────────────────────────────────────────────────
-- 1b) Yeni aktivite tipi: watched_movie
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN: Akış bugüne kadar YALNIZCA bölüm izlemelerini ve puanlamaları
-- taşıyordu — bir film izlediğinizi işaretlemek akışta HİÇ görünmüyordu
-- (senkron `/sync/history/episodes` çekiyor, filmlere hiç bakmıyordu).
-- Kullanıcı isteği: "işaretlenen diziler/filmler ve verilen puanlar".
ALTER TABLE feed_activities DROP CONSTRAINT IF EXISTS feed_activities_activity_type_check;
ALTER TABLE feed_activities
  ADD CONSTRAINT feed_activities_activity_type_check CHECK (
    activity_type IN ('watched_episode', 'watched_movie', 'started_show', 'completed_show', 'rated')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 1c) Tombstone tablosu da aynı iki alanı öğrenmeli
-- ─────────────────────────────────────────────────────────────────────────
-- `deleted_feed_activities`, senkronun "kullanıcı bunu kalıcı sildi, geri
-- ekleme" kaydıdır ve dedup anahtarı `feed_activities` ile BİREBİR aynı
-- hesaplanır. `media_type` eklenmezse silinen bir FİLM aktivitesinin
-- tombstone'u 'show' anahtarı üretir, gelen film satırı 'movie' üretir,
-- eşleşme tutmaz ve silinen aktivite bir sonraki senkronda SESSİZCE GERİ
-- GELİRDİ. Yeni `watched_movie` tipi de CHECK'e eklenmeli.
ALTER TABLE deleted_feed_activities
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'show'
  CHECK (media_type IN ('show', 'movie'));

ALTER TABLE deleted_feed_activities DROP CONSTRAINT IF EXISTS deleted_feed_activities_activity_type_check;
ALTER TABLE deleted_feed_activities
  ADD CONSTRAINT deleted_feed_activities_activity_type_check CHECK (
    activity_type IN ('watched_episode', 'watched_movie', 'started_show', 'completed_show', 'rated')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2) tmdb_id — poster gösterebilmek için
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN: `show_poster_url` her zaman NULL yazılıyordu ve akış kartları poster
-- yerine gri bir film ikonu gösteriyordu. Uygulama posterleri zaten TMDB'den
-- (bkz. components/MediaPoster.tsx) tmdb id ile çekiyor — URL'i DB'de
-- saklamak yerine (bayatlar, TMDB yolu değişebilir) yalnızca id'yi saklıyoruz.
ALTER TABLE feed_activities
  ADD COLUMN IF NOT EXISTS tmdb_id BIGINT;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Anında yayın için IDEMPOTENT yazma anahtarı
-- ─────────────────────────────────────────────────────────────────────────
-- `/feed/publish` ağ hatasında yeniden denenebilir olmalı; ayrıca kullanıcı
-- bir bölümü işaretledikten kısa süre sonra tam senkron çalışırsa AYNI olay
-- iki kez yazılmamalı.
--
-- Anahtar seçimi, worker'ın kendi dedup mantığıyla BİREBİR AYNI:
--   watched_episode → (user_id, show_id, episode_number, activity_at)
--   rated           → (user_id, show_id, media_type)  [tek güncel puan]
-- Bu iki index KISMİ (partial) — `activity_type` şartı taşıyor.
--
-- ⚠️ ÖNEMLİ: Bu index'ler PostgREST'in `on_conflict` parametresiyle
-- KULLANILAMAZ (bkz. docs/HISTORY.md Madde 89 — kısmi index'ler on_conflict
-- ile eşleşmiyor, 42P10 hatası veriyor). Worker yine kendi "önce oku,
-- karşılaştır, sade INSERT/PATCH yap" yolunu kullanır; bu index'ler
-- veritabanı düzeyinde SON savunma hattı (yarış durumunda çift satırı
-- Postgres'in kendisi reddeder) ve aynı zamanda okuma performansı sağlar.
-- ÖNCE TEMİZLİK: Bu tablo bir dönem hatalı bir senkronla dolduruldu (bkz.
-- docs/HISTORY.md Madde 89) — mevcut veride çift satırlar olabilir. Unique
-- index oluşturmadan önce temizlenmezse `CREATE UNIQUE INDEX` hata verir ve
-- migration'ın TAMAMI geri alınır. Her grupta EN ESKİ (`ctid` en küçük değil,
-- `created_at` en eski) satır korunur, fazlalıklar silinir.
DELETE FROM feed_activities a
USING feed_activities b
WHERE a.activity_type = 'watched_episode'
  AND b.activity_type = 'watched_episode'
  AND a.user_id = b.user_id
  AND a.show_id = b.show_id
  AND a.episode_number IS NOT DISTINCT FROM b.episode_number
  AND a.activity_at = b.activity_at
  AND (a.created_at, a.id) > (b.created_at, b.id);

DELETE FROM feed_activities a
USING feed_activities b
WHERE a.activity_type = 'rated'
  AND b.activity_type = 'rated'
  AND a.user_id = b.user_id
  AND a.show_id = b.show_id
  AND a.media_type = b.media_type
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_feed_watched_episode
  ON feed_activities (user_id, show_id, episode_number, activity_at)
  WHERE activity_type = 'watched_episode';

-- Film izleme: bölüm numarası yok, anahtar (yapım + an) ikilisi.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_feed_watched_movie
  ON feed_activities (user_id, show_id, activity_at)
  WHERE activity_type = 'watched_movie';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_feed_rated
  ON feed_activities (user_id, show_id, media_type)
  WHERE activity_type = 'rated';

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Supabase Realtime — canlı akış
-- ─────────────────────────────────────────────────────────────────────────
-- Client, `feed_activities` INSERT olaylarına abone olur ve takip ettiği
-- kişilerin yeni aktivitesini SAYFAYI YENİLEMEDEN görür.
--
-- GÜVENLİK: Realtime, `postgres_changes` için RLS'e uyar. Bu tablonun SELECT
-- politikası zaten `USING (true)` (bkz. 001_feed_schema.sql) — akış verisi
-- tasarım gereği herkese açık okunabilir, dolayısıyla Realtime ek bir veri
-- sızıntısı yüzeyi açmaz. Kim ne görecek filtresi client tarafında
-- (takip ettiklerimin user_id kümesi) uygulanır.
--
-- REPLICA IDENTITY: silme/güncelleme olaylarının eski satırı taşıyabilmesi
-- için FULL gerekir. Akış yalnızca INSERT dinliyor ama ileride "aktivite
-- silindi" olayını da dinlemek istersek şart olacak; maliyeti bu küçük
-- tabloda ihmal edilebilir.
ALTER TABLE feed_activities REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- Yayın (publication) Supabase'de hazır gelir; tablo zaten eklenmişse
  -- ikinci kez eklemek hata verir — bu yüzden koşullu.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'feed_activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE feed_activities;
  END IF;
END $$;

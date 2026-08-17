-- ═══════════════════════════════════════════════════════════════════════════
-- 019 — İnceleme (Review) Entegrasyonu · 7. aktivite tipi: 'reviewed'
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ NUMARA DÜZELTMESİ: Bu dosya ilk yazıldığında yanlışlıkla `018_feed_reviews.sql`
-- adı verilmişti ve mevcut `018_content_reports.sql` ile ÇAKIŞIYORDU (aynı numara,
-- belirsiz çalıştırma sırası). ADI 019'a ÇEVRİLDİ.
--
-- ⚠️ BU DOSYA ZATEN ÇALIŞTIRILDI (canlı Supabase'de doğrulandı: `trakt_comment_id`
-- kolonu mevcut). Yeniden çalıştırmak zararsızdır (idempotent) ama GEREKMİYOR.
-- Sıradaki çalıştırılacak dosya: `020_reviews_local_only.sql`.
--
-- NOT: Bu migration Trakt'a çift-yazma (dual-write) döneminde yazıldı. O mimari
-- 020 ile terk edildi — `trakt_comment_id` artık YAZILMIYOR (ama kolon duruyor,
-- gerekçesi 020'de). Aşağıdaki `trakt_comment_id` açıklamaları TARİHSEL bağlam
-- olarak bırakıldı.
--
-- Bağlam ve TÜM tasarım gerekçeleri: docs/REVIEWS_PLAN.md (onaylandı 2026-08-16).
-- Bu dosya YALNIZCA DB katmanı. Worker uç noktaları (Faz 2), client servisleri
-- (Faz 3) ve UI (Faz 4) AYRI turlarda — `docs/FEED_SOCIAL_PLAN.md` §1'deki
-- çalışma biçiminin aynısı ("her katman ayrı onaydan geçecek").
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Idempotent (IF NOT EXISTS /
-- DROP ... IF EXISTS / CREATE OR REPLACE) — yanlışlıkla iki kez çalıştırmak
-- zararsızdır.
--
-- ⚠️ Bu dosya, incelemelerle DOĞRUDAN ilgisi olmayan ama aynı sınıf veri
-- kaybına yol açan İKİ MEVCUT AÇIĞI da kapatıyor (bölüm 6 ve 7) — kullanıcı
-- kararı: "bu hatalar çok kritik, bekletmeden bu fazın içinde düzelt"
-- (bkz. REVIEWS_PLAN.md §11, karar 6). İkisi de 'posted' tipini BUGÜN
-- etkiliyor, 'reviewed' eklendiğinde aynısını miras alacaktı.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) activity_type: 'reviewed' eklendi
-- ─────────────────────────────────────────────────────────────────────────
-- 017'deki 6 tipin üzerine 7.'si. Yeni tablo AÇILMADI — `feed_activities`
-- zaten bunun için tasarlanmıştı (bkz. 017'deki aynı gerekçe): sayfalama,
-- Realtime, beğeni, yorum, engelleme, retention, /activity/{id} paylaşım
-- sayfası HEPSİ bedavaya çalışıyor.
ALTER TABLE feed_activities DROP CONSTRAINT IF EXISTS feed_activities_activity_type_check;
ALTER TABLE feed_activities
  ADD CONSTRAINT feed_activities_activity_type_check CHECK (
    activity_type IN (
      'watched_episode', 'watched_movie', 'started_show', 'completed_show',
      'rated', 'posted', 'reviewed'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2) trakt_comment_id — dedup'ın GERÇEK anahtarı
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN ZAMAN DAMGASI DEĞİL: İzleme/puanlama için proje bugün "zaman damgası
-- hizalaması" kullanıyor (bkz. features/feed/services/feedPublish.ts —
-- "tüm mimarinin temel taşıdır"): client damgayı üretir, Trakt'a watched_at
-- olarak gönderir, aynısını akışa yayınlar, sonraki senkron aynı dedup
-- anahtarını üretir. Zarif ama KIRILGAN — damga bir milisaniye kayarsa çift
-- kayıt oluşur.
--
-- İncelemede buna hiç gerek yok: Trakt yorumun KENDİSİNE kalıcı, sayısal bir
-- id veriyor ve bunu POST /comments yanıtında döndürüyor. Sunucu tarafından
-- üretilen gerçek bir kimlik, damga tahminlemesinden kat kat güçlü bir dedup
-- anahtarıdır.
--
-- BUGÜN KULLANILMIYOR ama ŞİMDİ ekleniyor: `/feed/sync` şu an
-- /users/me/comments'i HİÇ çekmiyor (doğrulandı: handleFeedSync yalnızca
-- /sync/history/episodes + /sync/ratings/*), yani bugün çakışma YOK. Ama
-- "Trakt web'den yazdığım inceleme de akışımda görünsün" istendiği gün o
-- senkron eklenecek ve elle yazılmış satırlarla karşılaşacak. Anahtarı o gün
-- eklemek, o güne kadar birikmiş tüm satırları anahtarsız bırakırdı.
ALTER TABLE feed_activities
  ADD COLUMN IF NOT EXISTS trakt_comment_id BIGINT;

-- Aynı Trakt yorumu İKİ satır üretemez. Kısmi (partial): diğer 6 tipin
-- hepsinde bu kolon NULL'dır ve NULL'lar unique kısıtına takılmamalı.
CREATE UNIQUE INDEX IF NOT EXISTS uq_feed_trakt_comment_id
  ON feed_activities (trakt_comment_id)
  WHERE trakt_comment_id IS NOT NULL;

-- ⚠️ POSTGREST TUZAĞI — bkz. docs/HISTORY.md Madde 89.
-- Bu index KISMİ olduğu için PostgREST'in `?on_conflict=trakt_comment_id`
-- parametresiyle ÇALIŞMAZ (kısmi unique index'ler on_conflict tarafından
-- tanınmıyor). Worker `feed_activities`'e zaten hiçbir yerde upsert yapmıyor;
-- `fetchExistingActivities` ile önce mevcut satırları okuyup BELLEKTE
-- karşılaştırıyor, sonra düz INSERT/PATCH atıyor. İnceleme senkronu da AYNI
-- deseni izlemeli — `on_conflict` yazan biri sessizce çalışmayan bir dedup
-- elde eder.

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Bir kullanıcı bir yapıma TEK inceleme yazar
-- ─────────────────────────────────────────────────────────────────────────
-- Trakt da böyle davranıyor (ikinci yorum denemesi 409 döner). Bizde bu kısıt
-- olmasaydı: kullanıcı incelemesini düzenler → yeni satır INSERT edilir →
-- akışta aynı incelemenin İKİ kartı belirirdi. Düzenleme artık yeni satır
-- eklemez, var olanı PATCH eder.
--
-- 003_feed_activity_upsert_constraints.sql'deki `uq_feed_rated`'in ("bir
-- kullanıcı bir yapıma tek güncel puan verir") birebir aynı mantığı.
--
-- NEDEN episode_number ANAHTARDA: Trakt dizi/sezon/bölüm seviyelerinde AYRI
-- yorumlara izin veriyor. v1'de yalnızca dizi/film seviyesi inceleme akışa
-- düşüyor (kullanıcı kararı: spam engelleme — bir sezonu maratonlayan
-- kullanıcı akışı 20 inceleme kartıyla doldurmamalı), yani bu alan v1'de HER
-- ZAMAN NULL olacak. Anahtarda yine de tutuluyor ki bölüm incelemeleri
-- ileride açılmak istendiğinde YENİ MIGRATION GEREKMESİN.
--
-- COALESCE ŞART: Postgres'te NULL != NULL olduğu için, `episode_number`
-- doğrudan anahtara konsaydı NULL'lu satırlar birbirini hiç çakışmış saymaz
-- ve kısıt v1'de (yani her zaman NULL olduğu durumda) HİÇ ÇALIŞMAZDI.
CREATE UNIQUE INDEX IF NOT EXISTS uq_feed_reviewed_per_media
  ON feed_activities (user_id, show_id, media_type, COALESCE(episode_number, ''))
  WHERE activity_type = 'reviewed';

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Dizi/film detay sayfası sorgusu için indeks
-- ─────────────────────────────────────────────────────────────────────────
-- Bu, akışın bugüne kadar HİÇ yapmadığı bir okuma deseni: `feed_activities`'i
-- kullanıcıya göre değil, YAPIMA göre filtrelemek —
--   WHERE activity_type='reviewed' AND show_id=? AND media_type=?
--   ORDER BY activity_at DESC
-- Mevcut iki indeks (idx_feed_activities_user_time, idx_feed_activities_time)
-- bu sorguya hizmet ETMİYOR; indekssiz tablo taraması olurdu.
--
-- 014_feed_retention.sql "yeni indeks eklenmiyor" derken haklıydı ama o
-- gerekçe MEVCUT okuma desenleri içindi. Bu yeni bir desen ve gerçekten yeni
-- bir kısmi indeks hak ediyor. Kısmi olduğu için de küçük kalıyor: tablodaki
-- satırların ezici çoğunluğu (izleme logları) indekse hiç girmiyor.
CREATE INDEX IF NOT EXISTS idx_feed_reviews_by_media
  ON feed_activities (show_id, media_type, activity_at DESC)
  WHERE activity_type = 'reviewed';

-- ─────────────────────────────────────────────────────────────────────────
-- 5) 'reviewed' için zorunlu alanlar
-- ─────────────────────────────────────────────────────────────────────────
-- note: İnceleme metni `note` kolonunda yaşar (yeni kolon açılmadı — 015'ten
-- beri bu kolon zaten "alıntı VEYA gönderi gövdesi" taşıyor, ≤1000 karakter
-- sınırı 017'de konmuştu ve incelemeler için de aynen geçerli).
-- İçeriksiz bir inceleme anlamsız — 017'deki
-- `feed_activities_posted_requires_note` kısıtının birebir aynısı.
--
-- YAN FAYDA: Worker'ın yorum kapısı (index.js:1520 — "note boş VE rating
-- yoksa bu aktiviteye yorum yapılamaz") bu sayede 'reviewed' için
-- KENDİLİĞİNDEN açılıyor. Yanıt özelliği için Worker'da ek kod gerekmiyor.
ALTER TABLE feed_activities DROP CONSTRAINT IF EXISTS feed_activities_reviewed_requires_note;
ALTER TABLE feed_activities
  ADD CONSTRAINT feed_activities_reviewed_requires_note CHECK (
    activity_type != 'reviewed' OR note IS NOT NULL
  );

-- tmdb_id: BAĞIMSIZLIK GARANTİSİ.
-- "İleride Trakt'tan kopabilmek" hedefinin TEK dayanağı bu kolon. tmdb_id'si
-- NULL olan bir inceleme satırı, Trakt kapandığı gün hangi yapıma ait olduğu
-- BİLİNEMEYEN bir metin yığınıdır — üstelik posteri de çizilemez (013'ten
-- beri poster tmdb_id'den geliyor, show_poster_url tarihsel olarak hep NULL).
--
-- Bu, diğer 6 tipten DAHA KATI bir duruş (onlarda tmdb_id nullable kalıyor,
-- dokunulmuyor) ve bilinçli: incelemeler kullanıcının elle ürettiği, kalıcı
-- içerik; otomatik loglar gibi yeniden üretilebilir değiller.
--
-- ÜÇ KATMANLI DOĞRULAMA (FEED_SOCIAL_PLAN §3.5 deseni): burası SON savunma
-- hattı. Worker tmdbId eksikse isteği baştan reddetmeli, client da butonu
-- erken pasif tutmalı — kullanıcı butona bastıktan SONRA 400 almasın
-- (docs/AI_RULES.md §2 "sessiz başarısızlık yasaktır").
ALTER TABLE feed_activities DROP CONSTRAINT IF EXISTS feed_activities_reviewed_requires_tmdb;
ALTER TABLE feed_activities
  ADD CONSTRAINT feed_activities_reviewed_requires_tmdb CHECK (
    activity_type != 'reviewed' OR tmdb_id IS NOT NULL
  );

-- NOT: show_id için ayrı bir kısıt GEREKMİYOR — 017'deki
-- `feed_activities_show_required_unless_posted` zaten "activity_type='posted'
-- DEĞİLSE show_id zorunlu" diyor, 'reviewed' bu kuralın kapsamına
-- kendiliğinden giriyor.

-- ─────────────────────────────────────────────────────────────────────────
-- 6) Tombstone: 'reviewed' kabul edilmeli
-- ─────────────────────────────────────────────────────────────────────────
-- `deleted_feed_activities.activity_type` CHECK'i en son 013'te güncellenmiş
-- ve 4 tip tanıyor. 'posted' oraya hiç eklenmedi — gerekmediği için:
-- handleFeedDelete (index.js:1301) 'posted' tipini BİLİNÇLİ OLARAK
-- tombstone'lamıyor, çünkü Trakt'la hiçbir bağı yok, senkronun geri
-- ekleyebileceği bir olay yok.
--
-- 'reviewed' için durum TAM TERSİ: Trakt'ta karşılığı VAR. Tombstone olmadan,
-- inceleme senkronu eklendiği gün kullanıcının sildiği inceleme SESSİZCE geri
-- gelir. Bu yüzden tombstone'lanacak — ve bu CHECK güncellemesi olmadan silme
-- işlemi DB kısıtına takılıp patlardı.
--
-- (deleted_feed_activities.show_id NOT NULL — sorun değil: 'reviewed' her
-- zaman show_id taşıyor, bkz. 5. bölümdeki not.)
ALTER TABLE deleted_feed_activities DROP CONSTRAINT IF EXISTS deleted_feed_activities_activity_type_check;
ALTER TABLE deleted_feed_activities
  ADD CONSTRAINT deleted_feed_activities_activity_type_check CHECK (
    activity_type IN (
      'watched_episode', 'watched_movie', 'started_show', 'completed_show',
      'rated', 'reviewed'
    )
  );

-- Tombstone'un dedup anahtarı damga DEĞİL, Trakt yorum id'si olmalı — aynı
-- gerekçe (bölüm 2). Nullable: diğer tipler bu alanı hiç doldurmaz.
ALTER TABLE deleted_feed_activities
  ADD COLUMN IF NOT EXISTS trakt_comment_id BIGINT;

-- ─────────────────────────────────────────────────────────────────────────
-- 7) 🔴 RETENTION DÜZELTMESİ — elle yazılmış içerik ASLA otomatik silinmez
-- ─────────────────────────────────────────────────────────────────────────
-- MEVCUT AÇIK (REVIEWS_PLAN.md R1): 014'teki prune_feed_activities() her gece
-- kullanıcı başına en yeni 200 satırı tutup gerisini `activity_type` ayrımı
-- YAPMADAN siliyor. Aktif bir kullanıcı ayda kolayca 200+ watched_episode
-- üretir. Sonuç: elle yazılmış bir inceleme/gönderi, altındaki TÜM yanıtlarla
-- birlikte (comments tablosu ON DELETE CASCADE) bir gece SESSİZCE yok olur.
--
-- Bu, docs/FEED_SOCIAL_PLAN.md §5'teki açık kararla doğrudan çelişiyordu:
-- "Yorumlar zaman bazlı SİLİNMEZ — kullanıcının bilerek yazdığı içerik,
-- otomatik log değil." Açık bugün 'posted' tipini ETKİLİYOR; 'reviewed'
-- eklendiğinde aynısını miras alacaktı.
--
-- 200 EŞİĞİNİN GEREKÇESİ BU İKİ TİP İÇİN ZATEN GEÇERSİZ: 014'te eşiğin
-- varlık sebebi "sync ↔ silme sonsuz döngüsü"nü imkânsız kılmaktı (senkronun
-- eriştiği 50'lik pencere, korunan 200'lük pencerenin içinde kalsın diye).
-- 'posted' ve 'reviewed' senkronun geri ekleyebileceği Trakt olayları değil —
-- muaf tutmak o gerekçeyi hiç zayıflatmıyor.
--
-- ÖLÇEK NOTU: Muafiyet tabloyu sınırsız büyütmez. Elle içerik üretimi
-- otomatik loglarla kıyaslanamayacak kadar seyrektir (kullanıcı başına ayda
-- onlarca değil, birkaç tane) ve 'reviewed' zaten yapım başına bir taneyle
-- sınırlı (bölüm 3'teki unique index).
create or replace function public.prune_feed_activities()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with ranked as (
    select
      id,
      row_number() over (
        -- `id` ikincil sıralama anahtarı: toplu sezon işaretlemesinde TÜM
        -- bölümler AYNI `activity_at` damgasını alır (client Trakt'a tek bir
        -- watched_at gönderiyor). Tek anahtarla sıralama bu durumda
        -- deterministik olmaz ve her çalıştırmada farklı satırlar silinebilirdi.
        partition by user_id
        order by activity_at desc, id desc
      ) as rn
    from feed_activities
    -- YENİ (018): elle yazılmış içerik sıralamaya HİÇ girmiyor — ne silinir
    -- ne de 200'lük kotadan yer kaplar. İkincisi de önemli: kotayı
    -- tüketselerdi, çok inceleme yazan bir kullanıcının izleme logları
    -- olması gerekenden erken silinirdi.
    where activity_type not in ('posted', 'reviewed')
  )
  delete from feed_activities fa
  using ranked r
  where fa.id = r.id
    and r.rn > 200;

  get diagnostics deleted_count = row_count;
  raise notice 'prune_feed_activities: % satir silindi', deleted_count;
end;
$$;

-- prune_deleted_feed_activities() DEĞİŞMEDİ — tombstone'lar zaten 1000'lik
-- cömert eşikle korunuyor ve satır başına maliyeti ihmal edilebilir.

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması (isteğe bağlı — SQL Editor'de tek tek çalıştırılabilir)
-- ─────────────────────────────────────────────────────────────────────────
--   Yeni kolonlar geldi mi?
--     select table_name, column_name from information_schema.columns
--     where column_name = 'trakt_comment_id';
--     -- beklenen: feed_activities + deleted_feed_activities
--
--   'reviewed' tipi kabul ediliyor mu?
--     select pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'feed_activities_activity_type_check';
--
--   Yeni index'ler kuruldu mu? (3 satır beklenir)
--     select indexname from pg_indexes
--     where tablename = 'feed_activities'
--       and indexname in ('uq_feed_trakt_comment_id','uq_feed_reviewed_per_media','idx_feed_reviews_by_media');
--
--   Retention muafiyeti gerçekten uygulandı mı?
--     select prosrc like '%not in (''posted'', ''reviewed'')%'
--     from pg_proc where proname = 'prune_feed_activities';
--     -- beklenen: t
--
--   Kısıtların canlı testi (hepsi HATA vermeli — kısıt çalışıyor demektir):
--     -- note'suz inceleme:
--     insert into feed_activities (user_id, activity_type, show_id, media_type, tmdb_id, show_title)
--     select id, 'reviewed', 1, 'show', 1, 'Test' from users limit 1;
--     -- tmdb_id'siz inceleme:
--     insert into feed_activities (user_id, activity_type, show_id, media_type, show_title, note)
--     select id, 'reviewed', 1, 'show', 'Test', 'test notu' from users limit 1;

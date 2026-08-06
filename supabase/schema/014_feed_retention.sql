-- ═══════════════════════════════════════════════════════════════════════════
-- 014 — Akış ölçeklenmesi: veri saklama (retention) politikası
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam: `feed_activities` sınırsız büyüyordu. Kullanıcı sayısı arttıkça
-- tablo şişecek, okumalar yavaşlayacaktı. Bu migration otomatik bir gece
-- temizliği kurar.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ NEDEN YENİ İNDEKS EKLENMİYOR
-- ─────────────────────────────────────────────────────────────────────────
-- Akış `activity_at DESC`e göre okunuyor (`created_at`e göre DEĞİL) ve
-- 001_feed_schema.sql bu iki indeksi zaten kuruyor:
--     idx_feed_activities_time       (activity_at DESC)
--     idx_feed_activities_user_time  (user_id, activity_at DESC)
-- Sayfalama sorgusu `user_id IN (...) ORDER BY activity_at DESC` biçiminde
-- olduğundan ikincisi tam olarak bu iş için uygun. `created_at` üzerine bir
-- indeks HİÇBİR okumayı hızlandırmaz, yalnızca her INSERT'e maliyet ekler —
-- bu yüzden bilinçli olarak eklenmiyor.
--
-- Aşağıdaki temizlik fonksiyonu da `(user_id, activity_at DESC)` üzerinden
-- çalışır, yani ek indekse ihtiyaç duymaz.

create extension if not exists pg_cron;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) feed_activities — kullanıcı BAŞINA en yeni N kayıt
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN ZAMAN BAZLI ("30 günden eskiyi sil") DEĞİL — iki somut gerekçe:
--
--   (a) PROFİL GEÇMİŞİNİ BOŞALTIRDI. Profil › Aktiviteler sekmesi bilinçli
--       olarak TARİH PENCERESİZ çalışıyor (bkz. feedApi.ts
--       `fetchUserFeedActivities`: "profilde 'son 30 gün' kısıtı anlamlı
--       değil"). Zaman bazlı silme, herkesin profil geçmişini kalıcı olarak
--       yok ederdi.
--
--   (b) SENKRONLA SONSUZ DÖNGÜYE GİRERDİ. Worker senkronu Trakt'tan son 50
--       kaydı çekiyor (`/sync/history/episodes?limit=50`). Az aktif bir
--       kullanıcının tüm geçmişi 30 günden eskiyse: gece silinir → sabah
--       senkron aynı kayıtları "yeni" sanıp geri ekler → ertesi gece tekrar
--       silinir. Kalıcı, anlamsız yazma trafiği.
--
-- 200 eşiği bu döngüyü YAPISAL OLARAK imkânsız kılar: senkronun eriştiği
-- pencere (50) her zaman korunan pencerenin (200) İÇİNDE kalır, dolayısıyla
-- senkronun geri ekleyebileceği hiçbir kayıt silinmiş olmaz.
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
  )
  delete from feed_activities fa
  using ranked r
  where fa.id = r.id
    and r.rn > 200;

  get diagnostics deleted_count = row_count;
  raise notice 'prune_feed_activities: % satir silindi', deleted_count;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) deleted_feed_activities (tombstone'lar) — çok daha CÖMERT eşik
-- ─────────────────────────────────────────────────────────────────────────
-- Bir tombstone, kullanıcının "bu aktiviteyi kalıcı sildim, geri ekleme"
-- kaydıdır (bkz. Worker `fetchDeletedActivities`). ERKEN silinirse: Trakt'ta
-- hâlâ duran o aktivite bir sonraki senkronda "yeni" sanılıp SESSİZCE GERİ
-- GELİR — kullanıcının açıkça istemediği davranış. Bu yüzden eşik akış
-- kayıtlarınınkinden çok daha yüksek. Satırlar başlık/poster taşımadığı için
-- (yalnızca id + tip + damga) depolama maliyeti zaten ihmal edilebilir.
create or replace function public.prune_deleted_feed_activities()
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
      row_number() over (partition by user_id order by deleted_at desc, id desc) as rn
    from deleted_feed_activities
  )
  delete from deleted_feed_activities d
  using ranked r
  where d.id = r.id
    and r.rn > 1000;

  get diagnostics deleted_count = row_count;
  raise notice 'prune_deleted_feed_activities: % satir silindi', deleted_count;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Gece temizliği — her gün 00:00 UTC = 03:00 Türkiye saati
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ pg_cron UTC ile çalışır; '0 3 * * *' yazmak TR saatiyle 06:00 demek
-- olurdu. TR 03:00 için doğru ifade '0 0 * * *'.
--
-- Idempotent: bu dosya iki kez çalıştırılırsa "job already exists" hatası
-- vermek yerine önceki zamanlama kaldırılıp yeniden kurulur.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'prune-feed') then
    perform cron.unschedule('prune-feed');
  end if;
end $$;

select cron.schedule(
  'prune-feed',
  '0 0 * * *',
  $$
    select public.prune_feed_activities();
    select public.prune_deleted_feed_activities();
  $$
);

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması (isteğe bağlı — SQL Editor'de tek tek çalıştırılabilir)
-- ─────────────────────────────────────────────────────────────────────────
--   Zamanlama kuruldu mu?
--     select jobname, schedule, active from cron.job where jobname = 'prune-feed';
--
--   Beklemeden elle bir kez çalıştır (NOTICE çıktısı kaç satır silindiğini yazar):
--     select public.prune_feed_activities();
--
--   Son çalıştırmaların sonucu:
--     select status, return_message, start_time
--     from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'prune-feed')
--     order by start_time desc limit 5;

-- ═══════════════════════════════════════════════════════════════════════════
-- 020 — İnceleme Sistemi v2: Trakt'tan Kopuş
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bağlam ve tüm gerekçeler: docs/REVIEWS_PLAN.md (v2, onaylandı 2026-08-16).
-- Tetikleyici: Trakt API'nin ücretlendirmeye geçmesi.
--
-- 019 (eski adıyla 018_feed_reviews) ile kurulan `reviewed` tipi KALIYOR. Değişen: artık Trakt'a HİÇ
-- yazmıyoruz, dolayısıyla Trakt'ın kuralları (5 kelime minimumu) bizi
-- bağlamıyor ve sınırlar tamamen bizim kararımız.
--
-- Supabase SQL Editor'de BİR KEZ çalıştırılır. Idempotent.
--
-- ⚠️ SIRA: bu migration çalıştırıldıktan SONRA Worker deploy edilmeli.
-- Worker `in_feed` kolonuna hiç yazmıyor (türetilmiş) ama `note` için yeni
-- sınırı uyguluyor — migration önce giderse eski Worker yalnızca daha katı
-- davranır (zararsız); ters sırada 5000 karakterlik bir inceleme DB CHECK'ine
-- takılır ve kullanıcı hata alır.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) `note` sınırı: 1000 → 5000
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN (docs/REVIEWS_PLAN.md §10 Karar 1, S1+S8): 1000 karakter ≈ 150 kelime.
-- Trakt 200 KELİMEDEN uzun yorumları "review" sayıyor — yani eski sınır,
-- "inceleme" diye adlandırdığımız şeyin Trakt'ın kendi inceleme eşiğine bile
-- ulaşamaması demekti. Trakt'a yazmayı bıraktığımız için o eşik artık
-- bağlayıcı değil, ama sınırın DAR olduğu gerçeği değişmedi.
--
-- Tek ve BİRLEŞİK sınır (tipe göre koşullu DEĞİL) — 017'deki aynı gerekçe:
-- `note` kolonu hem alıntıyı, hem gönderiyi, hem incelemeyi taşıyor; koşullu
-- bir CHECK gereksiz karmaşıklık olurdu. Bir alıntının da 5000 karaktere kadar
-- yazılabilmesi zararsız.
--
-- ⚠️ Bu sayı ÜÇ yerde birden geçerli olmalı, üçü de aynı turda güncellendi:
--   1. Burası (DB CHECK — GERÇEK KAYNAK, son savunma hattı)
--   2. Worker `MAX_NOTE_LENGTH`
--   3. İstemci `utils/commentValidation.ts` → `MAX_REVIEW_CHARS`
ALTER TABLE feed_activities DROP CONSTRAINT IF EXISTS feed_activities_note_length;
ALTER TABLE feed_activities
  ADD CONSTRAINT feed_activities_note_length CHECK (note IS NULL OR char_length(note) <= 5000);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) `in_feed` — bölüm incelemeleri ANA AKIŞA düşmesin
-- ─────────────────────────────────────────────────────────────────────────
-- Kullanıcı kararı: bölüm (episode) incelemeleri de artık bizim DB'mize
-- yazılacak (Trakt'a değil), AMA ana akışta görünmeyecek — yalnızca o bölümün
-- kendi sayfasında. Gerekçe: bir sezonu maratonlayan kullanıcı akışı 20
-- inceleme kartıyla doldurmasın.
--
-- ⚠️ NEDEN ELLE BAYRAK DEĞİL, TÜRETİLMİŞ (GENERATED) KOLON:
-- `008_drop_feed_hidden.sql`'in dersi. Orada `feed_hidden` adında elle
-- yönetilen bir bayrak vardı; senkron dışı kalıp çelişkili duruma düşebildiği
-- için kaldırılıp TÜRETİLMİŞ bir değere çevrilmişti. Aynı hata iki kez
-- yapılmasın: `in_feed` satırın kendisinden HESAPLANIR, yanlış olması
-- fiziksel olarak imkânsızdır. Worker'ın bu kolona yazması gerekmez (zaten
-- yazamaz — Postgres GENERATED kolona INSERT/UPDATE'i reddeder).
--
-- ⚠️ NEDEN SORGUYA KOŞUL YAZMIYORUZ:
-- Akış sorgusu (feedApi.ts fetchFeedActivities) sayfalama için hassas bir
-- bileşik keyset ifadesi taşıyor:
--     .or(`activity_at.lt."${ts}",and(activity_at.eq."${ts}",id.lt."${id}")`)
-- Oraya ikinci bir bileşik `NOT (activity_type=... AND episode_number IS NOT
-- NULL)` koşulu eklemek, o ifadeyi kırma riski taşır (bkz. feedApi.ts'teki
-- "bu filtre sıralamayla BİREBİR uyumlu olmak zorunda" uyarısı). Tek bir
-- `.eq('in_feed', true)` hem güvenli hem okunur.
--
-- STORED (VIRTUAL değil): Postgres yalnızca STORED destekliyor ve indeksleme
-- için de zaten gerekli.
ALTER TABLE feed_activities
  ADD COLUMN IF NOT EXISTS in_feed BOOLEAN
  GENERATED ALWAYS AS (
    NOT (activity_type = 'reviewed' AND episode_number IS NOT NULL)
  ) STORED;

-- Akış sorgusu `user_id IN (...) AND in_feed AND activity_at >= cutoff`
-- biçimine dönüşüyor. Mevcut `idx_feed_activities_user_time` hâlâ ana indeks;
-- `in_feed` yalnızca ucuz bir eleme. AYRI BİR İNDEKS EKLENMİYOR — satırların
-- ezici çoğunluğu `true` olduğu için seçiciliği düşük, indeks faydasız olurdu
-- (014'teki "hiçbir okumayı hızlandırmayan indeks eklenmez" ilkesi).

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Bölüm incelemeleri için ek şema DEĞİŞİKLİĞİ GEREKMİYOR
-- ─────────────────────────────────────────────────────────────────────────
-- 019'daki unique index ZATEN `COALESCE(episode_number, '')` içeriyordu:
--   uq_feed_reviewed_per_media (user_id, show_id, media_type, COALESCE(episode_number,''))
-- O gün "v1'de hep NULL olacak ama ileride bölüm incelemeleri açılmak
-- istendiğinde YENİ MIGRATION GEREKMESİN" diye bilinçli olarak konmuştu.
-- Bugün o gün geldi ve gerçekten yeni bir şey gerekmedi: aynı kullanıcı aynı
-- yapıma hem dizi geneli (`episode_number IS NULL`) hem bölüm bazlı
-- (`episode_number = 'S01E02'`) inceleme yazabilir — kullanıcı kararı
-- (REVIEWS_PLAN §10 Karar 2).

-- ─────────────────────────────────────────────────────────────────────────
-- 4) `trakt_comment_id` — SİLİNMİYOR (bilinçli)
-- ─────────────────────────────────────────────────────────────────────────
-- Artık hiçbir şey yazmıyor. Yine de duruyor çünkü: Trakt API bir gün tamamen
-- kapanırsa, dizi sayfasındaki "Trakt Topluluğu" içeriğini yaşatmanın tek yolu
-- onu ÖNBELLEĞE ALMAK olur — ve o önbelleğin dedup anahtarı tam olarak bu
-- kolondur. Nullable + kısmi index = maliyeti pratikte sıfır.
-- `003_feed_activity_upsert_constraints.sql`'deki "artık kullanılmıyor ama
-- zararsız/dursun" emsaliyle aynı karar.

-- ─────────────────────────────────────────────────────────────────────────
-- Kurulum doğrulaması
-- ─────────────────────────────────────────────────────────────────────────
--   Yeni sınır uygulandı mı? (5000 görünmeli)
--     select pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'feed_activities_note_length';
--
--   in_feed geldi mi ve TÜRETİLMİŞ mi? (is_generated = ALWAYS)
--     select column_name, is_generated, generation_expression
--     from information_schema.columns
--     where table_name='feed_activities' and column_name='in_feed';
--
--   Kural doğru çalışıyor mu? (bölüm incelemesi false, diğerleri true)
--     select activity_type, episode_number, in_feed
--     from feed_activities limit 20;
--
--   GENERATED kolona yazılamadığını doğrula (HATA vermeli — beklenen):
--     update feed_activities set in_feed = false where id = (select id from feed_activities limit 1);

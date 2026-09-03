-- ==========================================================================
-- KAYMAK KATALOG ARŞİVİ — Şema v1 (A1)
-- ==========================================================================
-- 🔴 BU BİR ÖNBELLEK DEĞİLDİR. LazyFetch (`server/lazyfetch/`) ile aynı SSD'yi
-- paylaşır ama KURALLARI TABAN TABANA ZITTIR (docs/Lazy Down Plan/01_MIMARI.md):
--
--   cache/    → TTL'i VAR, süpürücü siler, yedeklenmez, yeniden üretilebilir
--   archive/  → TTL'i YOK, HİÇBİR ŞEY SİLMEZ, yedeklenir, yeniden üretilemez
--
-- İki sistemin ayrı klasörde durması, L7'deki "iki köprü, iki zıt sözleşme"
-- kararının aynısıdır (server/traktCatalog.js başlığı): ayrı dosya = ayrı
-- sözleşme. Birinin kuralı diğerine sessizce sızmasın.
--
-- ⛔ SÜPÜRÜCÜ BURAYA ASLA DOKUNMAZ. `sweeper.js` kökten değil
-- `getLazyFetchDir('cache')`'ten başlar — koruma yapısaldır, disipline
-- bırakılmamıştır. (A2 turunda buna bir regresyon testi eklenmeli.)
--
-- Konum: ${LAZYFETCH_ROOT}/archive/katalog.db
-- 🔴 YEDEK: çalışan bir SQLite `cp` ile KOPYALANAMAZ (WAL yüzünden bozuk
-- dosya üretir). Yedek yalnızca `VACUUM INTO '/yol/yedek.db'` ile alınır.
--
-- ==========================================================================
-- KİMLİK FELSEFESİ — "Kıyamet Günü" kuralı
-- ==========================================================================
-- Hiçbir dış kimlik (trakt_id, tmdb_id, imdb_id, tvdb_id) PRIMARY KEY DEĞİLDİR.
-- Sistemin merkezinde KENDİ ürettiğimiz `kaymak_id` durur; dış kimlikler
-- yalnızca ARAMA/EŞLEŞTİRME için `external_ids` tablosunda yaşar.
--
-- Sebep: Trakt yarın kapanırsa, ID şemasını değiştirirse veya bir yapımı
-- birleştirirse/bölerse, arşivin OMURGASI etkilenmemeli. Dış kimliği PK
-- yapmak, bağımsızlık iddiasını en temelinden çürütürdü.
--
-- ==========================================================================
-- VERİ FELSEFESİ — ham yük gerçeğin kaynağı
-- ==========================================================================
-- Sağlayıcı yanıtı KOLONLARA PARÇALANMAZ, olduğu gibi (gzip'li) saklanır.
-- İki sebep:
--   1. A4'ün işi istemcinin beklediği yanıtı ÜRETMEK. Normalize edersek A4
--      Trakt'ın JSON şeklini yeniden dikmek zorunda kalır — kayıplı ve
--      kırılgan. Ham yükle A4 neredeyse bedava: bul, döndür.
--   2. Bugün modellemediğimiz alanlar KAYBOLMAZ. Normalizasyon her zaman
--      SONRADAN türetilebilir (payload elimizde); tersi mümkün değildir.
--
-- Bu yüzden `people`/`credits` tabloları A1'de BİLİNÇLİ OLARAK AÇILMADI —
-- veri zaten `show_people`/`movie_people` payload'ında duruyor. Açma kriteri:
-- "hangi oyuncu hangi yapımlarda" gibi ÇAPRAZ bir sorgu ürün gereksinimi
-- haline geldiğinde. O gün payload'lardan türetilir, hiçbir şey kaybolmaz.

PRAGMA foreign_keys = ON;

-- ==========================================================================
-- meta — şema sürümü ve operasyonel durum
-- ==========================================================================
-- Şema değiştiğinde `schema_version` artar ve göç (migration) kodu buna
-- bakar. LazyFetch zarfındaki `v` alanının (envelope.js) arşiv karşılığı —
-- ama davranışı ZIT: orada sürüm artınca eski kayıtlar ÇÖPE gider, burada
-- eski kayıtlar TAŞINIR. Arşiv hiçbir şeyi atmaz.
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO meta (key, value) VALUES ('created_at', CAST(strftime('%s','now') AS TEXT));

-- ==========================================================================
-- entities — arşivin OMURGASI
-- ==========================================================================
-- Her dizi, film, sezon, bölüm ve (ileride) kişi burada TEK bir satırdır.
-- `kaymak_id` biçimi: `<tip>_<32 hex>` — ör. `show_9f2c...`. Tip öneki
-- teknik olarak gereksiz (`type` kolonu var) ama teşhis için değerli:
-- bir log satırında ID görünce ne olduğu anlaşılır. Denetçi sağasında
-- öğrendiğimiz ders (Madde 260): teşhis edilebilirlik sonradan eklenmez.
--
-- 🔴 `title`/`year`/`status` TÜRETİLMİŞ ALANLARDIR — gerçeğin kaynağı
-- payload'dur. Bunlar yalnızca insan okunur sorgu ve kapsam ölçümü
-- (A3/A4: "kullanıcılarımızın takip ettiği yapımların %X'i arşivde")
-- içindir. Bozulurlarsa payload'lardan yeniden üretilir.
CREATE TABLE IF NOT EXISTS entities (
  kaymak_id      TEXT PRIMARY KEY,
  type           TEXT NOT NULL CHECK (type IN ('show','movie','season','episode','person')),

  -- Hiyerarşi: season -> show, episode -> season. Dizi/film için NULL.
  -- ON DELETE RESTRICT: arşivde silme YOKTUR; yanlışlıkla bir silme kodu
  -- yazılırsa veritabanı reddetsin (savunma derinliği).
  parent_id      TEXT REFERENCES entities(kaymak_id) ON DELETE RESTRICT,
  season_number  INTEGER,
  episode_number INTEGER,

  -- Türetilmiş indeks alanları (bkz. yukarıdaki kırmızı not)
  title          TEXT,
  year           INTEGER,
  status         TEXT,

  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,

  -- Sezon/bölüm numarası yalnızca ilgili tiplerde anlamlı olsun...
  CHECK (type IN ('season','episode') OR season_number IS NULL),
  CHECK (type = 'episode' OR episode_number IS NULL),
  -- ...ve o tiplerde ZORUNLU olsun. Tek yönlü kısıt yetmez: numarasız bir
  -- sezon satırı, aşağıdaki tekillik indeksini de anlamsızlaştırırdı.
  CHECK (type NOT IN ('season','episode') OR season_number IS NOT NULL),
  CHECK (type <> 'episode' OR episode_number IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_entities_type    ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_parent  ON entities(parent_id);
CREATE INDEX IF NOT EXISTS idx_entities_title   ON entities(title);

-- Aynı dizinin aynı sezonu / aynı sezonun aynı bölümü İKİ KEZ oluşmasın.
--
-- 🔴 `COALESCE(episode_number, -1)` ŞART — çıplak kolon yazmak bu indeksi
-- SESSİZCE ETKİSİZ kılar. SQLite'ta UNIQUE indeks içindeki NULL'lar
-- birbirine EŞİT SAYILMAZ: `episode_number` NULL olan iki sezon satırı
-- çakışmaz ve aynı sezon sonsuz kez eklenebilirdi. (Bu tam olarak
-- `payloads.lang`'de '-' sentinel'iyle kapattığımız tuzağın aynısı —
-- ilk taslakta buraya da düşülmüştü, A1 şema testi yakaladı.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_hiyerarsi
  ON entities(parent_id, type, season_number, COALESCE(episode_number, -1))
  WHERE parent_id IS NOT NULL;

-- ==========================================================================
-- external_ids — ÇAPRAZ EŞLEME (dış dünya ile tek temas noktası)
-- ==========================================================================
-- 🎁 BU TABLO BEDAVA DOLUYOR: Trakt'ın HER katalog yanıtı bir `ids` bloğu
-- taşıyor — {trakt, slug, tvdb, imdb, tmdb}. Yani eşlemeyi zaten çektiğimiz
-- veriden kuruyoruz, ayrı bir iş değil.
--
-- ⚠️ TERSİ DOĞRU DEĞİL: TMDB yanıtları trakt ID taşımıyor. Bir TMDB kaydı
-- ancak karşılık gelen Trakt kaydını görmüşsek bağlanabilir — bu, A3
-- backfill'in Trakt tarafından başlaması gerektiğini söylüyor.
--
-- 🔴 `source` NEDEN TİPLE BİRLİKTE: TMDB'de dizi 1396 ile film 1396 FARKLI
-- yapımlardır. Kaynak adına tipi gömmezsek iki ayrı yapım aynı satıra
-- çakışır ve arşiv sessizce yalan söyler. Geçerli değerler:
--   'trakt:show' · 'trakt:movie' · 'trakt:episode' · 'trakt:slug'
--   'tmdb:show'  · 'tmdb:movie'  · 'tvdb:show'     · 'imdb'
-- ('imdb' tipsizdir — IMDB kimlikleri global olarak benzersiz: tt0903747.)
--
-- 🔴 ÇAKIŞMA SESSİZCE ÇÖZÜLMEZ: (source, source_id) zaten başka bir
-- `kaymak_id`'ye bağlıysa eşleme DEĞİŞTİRİLMEZ; olay `sync_log`'a
-- 'conflict' olarak yazılır ve insan bakar. Sağlayıcı bir düzeltme yapmış
-- (iki yapımı birleştirmiş) olabilir — bunu otomatik uygulamak, arşivin
-- geçmişini sessizce yeniden yazmak olurdu.
CREATE TABLE IF NOT EXISTS external_ids (
  source        TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  kaymak_id     TEXT NOT NULL REFERENCES entities(kaymak_id) ON DELETE RESTRICT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  PRIMARY KEY (source, source_id)
);

-- Ters yön: "bu yapımın tüm dış kimlikleri neler?" (A4'ün ihtiyacı)
CREATE INDEX IF NOT EXISTS idx_external_kaymak ON external_ids(kaymak_id);

-- ==========================================================================
-- payloads — GERÇEĞİN KAYNAĞI
-- ==========================================================================
-- 🔴 `endpoint` = LAZYFETCH AİLE ADI ('show_seasons', 'show_detail',
-- 'tv_detail'...). Uydurulmuş yeni bir sözlük DEĞİL — `routeRegistry.js`'in
-- zaten kullandığı adlar. Böylece A2 yazarken, denetçi okurken ve cache
-- anahtarlarken herkes AYNI kelimeyi kullanıyor; çeviri katmanı yok.
--
-- 🔴 `lang` NULL OLAMAZ, dilsiz uçlarda '-' yazılır. Sebep bir SQLite
-- tuzağı: SQLite, standart SQL'in aksine PRIMARY KEY içinde NULL'a İZİN
-- VERİR ve NULL'lar birbirine eşit sayılmaz — yani `lang IS NULL` olan
-- aynı kayıt SONSUZ KEZ eklenebilirdi. '-' sentinel'i bunu kapatıyor.
--
-- Dil neden anahtarın parçası: istemci `translations=tr|en` gönderiyor ve
-- LazyFetch cache anahtarı da dile göre ayrışıyor (key.js). Arşiv ayırmazsa
-- A4 yanlış dilde servis eder.
--
-- 🔴 SÜRÜM TUTULMUYOR (latest-wins upsert). Ölçüm: SSD'deki gerçek
-- `show_seasons` kayıtları ortalama 33 KB (gzip'li), en büyüğü 294,5 KB.
-- Her sürümü saklamak arşivi kullanışsız hale getirirdi. Ne zaman
-- güncellendiği `updated_at` + `sync_log`'da duruyor.
CREATE TABLE IF NOT EXISTS payloads (
  kaymak_id   TEXT NOT NULL REFERENCES entities(kaymak_id) ON DELETE RESTRICT,
  provider    TEXT NOT NULL CHECK (provider IN ('trakt','tmdb')),
  endpoint    TEXT NOT NULL,
  lang        TEXT NOT NULL DEFAULT '-',

  body        BLOB NOT NULL,      -- gzip'li JSON (diskStore.js ile aynı yöntem)
  bytes_raw   INTEGER NOT NULL,   -- açılmış boyut — teşhis/kapsam ölçümü
  bytes_gz    INTEGER NOT NULL,   -- diskteki boyut

  fetched_at  INTEGER NOT NULL,   -- sağlayıcıdan ÇEKİLDİĞİ an
  updated_at  INTEGER NOT NULL,   -- arşive YAZILDIĞI an

  PRIMARY KEY (kaymak_id, provider, endpoint, lang)
);

CREATE INDEX IF NOT EXISTS idx_payloads_aile    ON payloads(provider, endpoint);
-- A3 backfill: "en eski dokunulan kayıtlar hangileri?"
CREATE INDEX IF NOT EXISTS idx_payloads_guncel  ON payloads(updated_at);

-- ==========================================================================
-- sync_log — arşiv sessizce yalan söylemez
-- ==========================================================================
-- A2'nin sözleşmesi: "arşiv yazımı başarısız olursa istek BAŞARISIZ OLMAZ,
-- sadece loglanır" (03_FAZLAR.md). O log BURASIDIR — yoksa sessizce eksik
-- bir arşiv birikir ve A4'te "kapsamımız %90" derken aslında %60 oluruz.
--
-- ⚠️ TEK İSTİSNA: bu tablo BUDANABİLİR. "Arşiv hiçbir şeyi silmez" kuralı
-- KATALOG VERİSİ içindir; `sync_log` operasyonel bir kayıttır. Budama
-- politikası A2'de kararlaştırılacak (ölçmeden sayı konmaz — 04_KARARLAR.md B).
CREATE TABLE IF NOT EXISTS sync_log (
  id        INTEGER PRIMARY KEY,
  at        INTEGER NOT NULL,
  event     TEXT NOT NULL CHECK (event IN ('upsert','conflict','error','backfill','vacuum')),
  provider  TEXT,
  endpoint  TEXT,
  kaymak_id TEXT,
  detail    TEXT
);

CREATE INDEX IF NOT EXISTS idx_synclog_at    ON sync_log(at);
CREATE INDEX IF NOT EXISTS idx_synclog_event ON sync_log(event);

-- ==========================================================================
-- kapsam — A3/A4'ün karar verisi (görünüm, tablo değil)
-- ==========================================================================
-- "Kullanıcılarımızın takip ettiği yapımların %X'i arşivde" sorusunun
-- payda tarafı Supabase'de (A3'ün işi). Bu görünüm PAY tarafını verir:
-- arşivde hangi tipten kaç yapım ve hangi aileler dolu.
--
-- 🔴 A4 (bağımsızlık anahtarı) bu sayıya bakarak ilan edilecek — ölçülmeden
-- "bağımsızız" denmeyecek (Madde 233 kuralının arşiv karşılığı).
CREATE VIEW IF NOT EXISTS v_kapsam AS
SELECT
  e.type,
  p.provider,
  p.endpoint,
  p.lang,
  COUNT(*)              AS kayit,
  SUM(p.bytes_gz)       AS disk_bayt,
  MIN(p.updated_at)     AS en_eski,
  MAX(p.updated_at)     AS en_yeni
FROM payloads p
JOIN entities e ON e.kaymak_id = p.kaymak_id
GROUP BY e.type, p.provider, p.endpoint, p.lang;

-- ==========================================================================
-- backfill_state — A3/2'nin defteri: "hangi ucu ne zaman tekrar deneyelim?"
-- ==========================================================================
-- NEDEN VAR: `general-hospital` gibi dev diziler Trakt'ta 504 veriyor
-- (03_FAZLAR.md A3 notu). Defter olmasaydı backfill her gece aynı ölü ucu
-- yeniden dener, 5 ardışık hatada `circuitBreaker` trakt devresini AÇAR ve
-- o an sitede gezinen GERÇEK kullanıcılar da katalog verisi alamaz.
-- Yani bu tablo bir hız optimizasyonu değil, CANLI TRAFİĞİN KORUMASI.
--
-- ⚠️ BU TABLO KATALOG VERİSİ DEĞİL, OPERASYONEL KAYITTIR — `sync_log` ile
-- aynı istisna kapsamında: silinebilir/sıfırlanabilir. Silinmesi yalnızca
-- "tüm uçları yeniden dene" demektir, veri kaybı değildir. "Arşiv hiçbir
-- şeyi silmez" kuralı `entities`/`external_ids`/`payloads` içindir.
--
-- 🔴 ŞEMA SÜRÜMÜ BİLEREK ARTIRILMADI (`db.js` HEDEF_SEMA_SURUMU = 1).
-- Gerekçe ölçüldü, tercih değil: `db.js semayiGocEt()` bu dosyayı HER
-- açılışta `db.exec(sema)` ile çalıştırıyor, yani `IF NOT EXISTS` tablo
-- var olan bir v1 veritabanında kendiliğinden oluşuyor. Sürümü artırsaydık
-- ve göç adımı yazmasaydık `semayiGocEt` "1 -> 2 gocu tanimli degil" diye
-- FIRLATIR, arşiv canlıda SESSİZCE KAPANIRDI. Değişiklik saf EKLEMELİ:
-- eski kod bu tabloyu hiç okumaz, okumadığı için de bozulmaz. Sürüm,
-- MEVCUT bir tablonun şekli değiştiğinde artırılacak.
CREATE TABLE IF NOT EXISTS backfill_state (
  -- "trakt/show_seasons/1388/-" — hedefin tam kimliği (dil dahil, çünkü
  -- `payloads` PK'sinde de dil var: `tr` ve `-` AYRI hedeflerdir).
  hedef             TEXT PRIMARY KEY,
  provider          TEXT NOT NULL,
  endpoint          TEXT NOT NULL,   -- LazyFetch aile adı (payloads.endpoint ile aynı sözlük)
  source_id         TEXT NOT NULL,   -- sağlayıcıdaki kimlik (Trakt ID)
  lang              TEXT NOT NULL,
  deneme            INTEGER NOT NULL DEFAULT 0,
  son_hata          TEXT,
  son_deneme_at     INTEGER,
  -- Bu andan ÖNCE tekrar denenmez. Üstel geri çekilme (`backfill.js`).
  sonraki_deneme_at INTEGER,
  -- Dolu ise iş bitti; satır TEŞHİS için duruyor (ne zaman tamamlandı).
  basarili_at       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_backfill_sonraki ON backfill_state(sonraki_deneme_at);

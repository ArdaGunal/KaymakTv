// ==========================================================================
// KATALOG ARŞİVİ — Yük Deposu (A1, dosya 3/3)
// ==========================================================================
// TEK İŞİ: sağlayıcı yanıtını (ham JSON) arşive yazmak ve geri okumak.
//
// 🔴 GERÇEĞİN KAYNAĞI BURASI. Yanıt kolonlara PARÇALANMAZ, olduğu gibi
// (gzip'li) saklanır. İki sebep (schema.sql başlığında da yazılı):
//   1. A4'ün işi istemcinin beklediği yanıtı ÜRETMEK. Normalize edersek
//      A4 Trakt'ın JSON şeklini yeniden dikmek zorunda kalır — kayıplı ve
//      kırılgan. Ham yükle A4 neredeyse bedava: bul, gunzip, döndür.
//   2. Bugün modellemediğimiz alanlar KAYBOLMAZ. Normalizasyon sonradan
//      türetilebilir; tersi mümkün değildir.
//
// 🔴 `endpoint` = LAZYFETCH AİLE ADI. Uydurulmuş yeni bir sözlük DEĞİL —
// `server/lazyfetch/routeRegistry.js`'in zaten kullandığı adlar
// ('show_seasons', 'show_detail', 'tv_detail'...). Böylece cache, arşiv,
// denetçi ve telemetri AYNI kelimeyi kullanıyor; çeviri katmanı yok.
//
// 🔴 GZIP: `diskStore.js` ile aynı yöntem (zlib, harici paket yok). Ölçüm:
// gerçek `show_seasons` kayıtları ortalama 33 KB gzip'li, en büyüğü
// 294,5 KB. Sıkıştırmasız saklamak arşivi birkaç kat büyütürdü.

const zlib = require('zlib');
const { promisify } = require('util');
const { getDb, islemDisiYaz, islemIcindeMi, islemAcikMi } = require('./db');

// 🔴 ASENKRON SIKIŞTIRMA — ÖLÇÜMDEN DOĞDU (2026-08-29).
// `zlib.gzipSync` olay döngüsünü BLOKLAR. Ölçüm (`general-hospital`
// payload'ı, 6,2 MB): `JSON.stringify` 16 ms + `gzipSync` **41 ms** =
// 57 ms kesintisiz blok — Pi'de (≈8× yavaş) ~450 ms. Yazıcının `nefesAl`
// düzeltmesinden SONRA kalan en büyük tek blok buydu.
//
// `zlib.gzip`/`gunzip` (asenkron) işi Node'un iş parçacığı havuzunda yapar;
// olay döngüsü boşta kalır ve sunucu isteklere cevap vermeye devam eder.
// Aynısı okuma tarafı için de geçerli: A4'ün sıcak yolu `readPayload`.
const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

/**
 * Dil sentinel'i. `lang` PRIMARY KEY'in parçası ve NULL OLAMAZ.
 *
 * 🔴 SQLITE TUZAĞI: SQLite, standart SQL'in aksine PRIMARY KEY içinde
 * NULL'a İZİN VERİR ve NULL'ları birbirine eşit SAYMAZ — yani `lang IS
 * NULL` olan aynı kayıt SONSUZ KEZ eklenebilirdi. Dilsiz uçlarda ('-')
 * bu sentinel yazılır.
 */
const DILSIZ = '-';

/**
 * Bir sağlayıcı yanıtını arşive yazar (latest-wins upsert).
 *
 * 🔴 SÜRÜM GEÇMİŞİ TUTULMAZ. Her sürümü saklamak, ölçülen boyutlarla
 * (ort. 33 KB/kayıt) arşivi kullanışsız hale getirirdi. Ne zaman
 * güncellendiği `updated_at` + `sync_log`'da duruyor.
 *
 * 🔴 THROW ETMEZ. A2'nin sözleşmesi: "arşiv yazımı başarısız olursa istek
 * BAŞARISIZ OLMAZ, sadece loglanır" (03_FAZLAR.md). Bu fonksiyon o
 * sözleşmenin uygulandığı yer — hata `sync_log`'a yazılır ve
 * `{ok: false}` döner.
 *
 * @returns {{ok: boolean, bytesRaw?: number, bytesGz?: number, reason?: string}}
 */
async function upsertPayload({ kaymakId, provider, endpoint, lang = DILSIZ, data, fetchedAt = Date.now() }) {
  const db = getDb();
  if (!db) return { ok: false, reason: 'arsiv kapali' };

  try {
    const ham = Buffer.from(JSON.stringify(data));
    const gz = await gzipAsync(ham);

    // 🆕 Paket D (M558 · O-1a / R7): işlemin İÇİNDEN çağrıldıysa (Trakt yazıcısı) işlemin parçasıdır,
    // hemen yazılır. İşlem DIŞINDAN çağrıldıysa tek yazım kapısından geçer — başkasının açık işlemine
    // katılıp onunla birlikte geri alınmasın (yeniden üretildi: TMDB künyesi KAYBOLUYORDU).
    const yaz = (h) => h.prepare(
      `INSERT INTO payloads (kaymak_id, provider, endpoint, lang, body, bytes_raw, bytes_gz, fetched_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(kaymak_id, provider, endpoint, lang) DO UPDATE SET
         body       = excluded.body,
         bytes_raw  = excluded.bytes_raw,
         bytes_gz   = excluded.bytes_gz,
         fetched_at = excluded.fetched_at,
         updated_at = excluded.updated_at
       -- 🆕 Paket C (M550) · O-8: DAHA ESKİ veri daha yeniyi EZMEZ. Eskiden koşulsuzdu: önbellekteki
       -- 150 günlük bir zarfla çalışan aktarım betiği, dün sağlayıcıdan zorla tazelenmiş yükü geri
       -- götürebiliyordu (yeniden üretildi, R6). Eşit damga yazar (aynı yanıtın tekrarı zararsız).
       WHERE excluded.fetched_at >= payloads.fetched_at`
    ).run(kaymakId, provider, endpoint, lang || DILSIZ, gz, ham.length, gz.length, fetchedAt, Date.now());
    const sonuc = islemIcindeMi() ? yaz(db) : await islemDisiYaz(yaz);

    // `changes === 0` → satır vardı ve DAHA YENİSİYDİ; yazılmadı. Hata değil, sonuç.
    if (sonuc.changes === 0) return { ok: true, atlandi: 'daha_yeni_var', bytesRaw: ham.length, bytesGz: gz.length };
    return { ok: true, bytesRaw: ham.length, bytesGz: gz.length };
  } catch (error) {
    // Kendi hatamızı kendi loguzmuza yazmayı da deneriz — o da patlarsa
    // sessizce vazgeçeriz, çünkü bu yol İSTEĞİ ASLA DÜŞÜREMEZ.
    logSync({ event: 'error', provider, endpoint, kaymakId, detail: error.message });
    return { ok: false, reason: error.message };
  }
}

/**
 * Arşivden bir yanıtı geri okur.
 *
 * A4'ün (bağımsızlık anahtarı) sıcak yolu burası olacak: sağlayıcı
 * sırası `Trakt → arşiv` yerine `arşiv → Trakt` olduğunda ilk bakılan yer.
 *
 * @returns {{ok: boolean, data?: any, fetchedAt?: number, updatedAt?: number, reason?: string}}
 */
async function readPayload({ kaymakId, provider, endpoint, lang = DILSIZ }) {
  const db = getDb();
  if (!db) return { ok: false, reason: 'arsiv kapali' };

  const satir = db
    .prepare(
      `SELECT body, bytes_raw, fetched_at, updated_at FROM payloads
       WHERE kaymak_id = ? AND provider = ? AND endpoint = ? AND lang = ?`
    )
    .get(kaymakId, provider, endpoint, lang || DILSIZ);

  if (!satir) return { ok: false, reason: 'not_found' };

  try {
    const json = await gunzipAsync(Buffer.from(satir.body));
    return {
      ok: true,
      data: JSON.parse(json),
      fetchedAt: satir.fetched_at,
      updatedAt: satir.updated_at,
    };
  } catch (error) {
    // 🔴 KARANTİNA YOK, SİLME DE YOK — `diskStore.js`'ten AYRILDIĞIMIZ yer.
    // Orası bir önbellek: bozuk dosya taşınır, kayıt yeniden çekilir.
    // Burası arşiv: silmek geri dönülemez veri kaybıdır. Bozuk satır
    // YERİNDE BIRAKILIR, olay loglanır, insan bakar. Çağıran taraf
    // `ok: false` görüp sağlayıcıya gider.
    logSync({ event: 'error', provider, endpoint, kaymakId, detail: `Bozuk payload (gunzip/JSON): ${error.message}` });
    return { ok: false, reason: 'corrupt' };
  }
}

/**
 * Operasyonel olay kaydı. A2'nin "başarısız olursa loglanır" sözleşmesinin
 * defteri; A3 backfill ilerlemesi ve A4 kapsam kararı da buradan okunacak.
 *
 * Bu fonksiyon da THROW ETMEZ — log yazamamak, işi durdurmaz.
 */
// Defterin TANIDIĞI olaylar. 🔴 Bu liste bir KAPI DEĞİL, bir SÖZLÜKTÜR:
// listede olmayan bir değer yine de YAZILIR, yalnızca bir kez uyarılır.
// Eskiden bu liste `sync_log.event` üzerinde bir CHECK'ti ve `mirror.js`'in
// sekiz günlük çıktısını sessizce yok etti (§C16). Ayrıntı: `schema.sql`.
const BILINEN_OLAYLAR = new Set([
  'upsert', 'conflict', 'error', 'backfill', 'vacuum',
  'mirror', // §C16 — CHECK bunu sekiz gun boyunca yutmustu
  'sayac',  // §C22 — gecelik satir sayimi (sayac.js)
]);

// Aynı arızayı her yazımda bağırmamak için — journald'ı boğmadan bir kez
// duyurmak yeterli. Ayrım MESAJA göre: yeni bir arıza biçimi yine görünür.
const uyarilanOlaylar = new Set();
const uyarilanHatalar = new Set();

function logSync({ event, provider = null, endpoint = null, kaymakId = null, detail = null }) {
  const db = getDb();
  if (!db) return false;

  if (!BILINEN_OLAYLAR.has(event) && !uyarilanOlaylar.has(event)) {
    uyarilanOlaylar.add(event);
    console.warn(
      `[Arsiv] sync_log: TANINMAYAN olay '${event}' — satir yazildi, ama `
      + 'store.js BILINEN_OLAYLAR listesine eklenmeli.'
    );
  }

  // 🆕 Paket D (M558 · R7): log TEK YAZIM KAPISINDAN — açık bir işlem varsa o kapanınca yazılır. Eskiden
  // işlemin içine sızıyor, işlem geri alınınca TAM DA o hatayı anlatan satır kayboluyordu. Damga ŞİMDİ
  // alınır (olayın anı), yazım ertelense de.
  const at = Date.now();
  const uyar = (error) => {
    const imza = `${event}|${error.message}`;
    if (!uyarilanHatalar.has(imza)) {
      uyarilanHatalar.add(imza);
      console.error(`[Arsiv] 🔴 sync_log YAZILAMADI (event=${event}): ${error.message}`);
    }
  };
  const yaz = (h) => h.prepare(
    'INSERT INTO sync_log (at, event, provider, endpoint, kaymak_id, detail) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(at, event, provider, endpoint, kaymakId, detail);
  try {
    // Açık işlem yoksa ŞİMDİ ve senkron (sonuç doğru döner); varsa işlem kapanınca (hata o zaman uyarılır).
    if (!islemAcikMi()) { yaz(db); return true; }
    islemDisiYaz(yaz).catch(uyar);
    return true;
  } catch (error) {
    // 🔴 HÂLÂ THROW ETMİYOR — log yazamamak işi durdurmaz (A2 sözleşmesi).
    // AMA ARTIK SESSİZ DEĞİL. §C16'nın asıl dersi CHECK değil BURASIYDI:
    // `catch (_) { return false; }` üç kat savunmacı sarmalayıcının en
    // alttakiydi ve aynanın sekiz günlük sessizliğini o üretti.
    uyar(error);
    return false;
  }
}

/**
 * Arşiv kapsamı — "elimizde ne var?" sorusunun cevabı.
 *
 * 🔴 A4 (bağımsızlık anahtarı) BU SAYIYA BAKARAK ilan edilecek. Madde
 * 233'ün arşiv karşılığı: ölçmeden "bağımsızız" denmez. Paydanın öbür
 * yarısı (kullanıcılarımızın takip ettiği yapımlar) Supabase'de — A3'ün işi.
 */
function coverage() {
  const db = getDb();
  if (!db) return [];
  return db.prepare('SELECT * FROM v_kapsam ORDER BY type, provider, endpoint, lang').all();
}

/** Tek satırlık özet — telemetri ve denetçi için. */
function summary() {
  const db = getDb();
  if (!db) return { enabled: false };
  const e = db.prepare('SELECT count(*) c FROM entities').get().c;
  const p = db.prepare('SELECT count(*) c, COALESCE(SUM(bytes_gz),0) b FROM payloads').get();
  const x = db.prepare('SELECT count(*) c FROM external_ids WHERE retired_at IS NULL').get().c;
  const emekli = db.prepare('SELECT count(*) c FROM external_ids WHERE retired_at IS NOT NULL').get().c;

  // ══════════════════════════════════════════════════════════════════════
  // 🔔 ALARM ile RUTİN AYRILDI (kullanıcı kararı, 2026-09-14)
  // ══════════════════════════════════════════════════════════════════════
  // `conflicts` sayacı scriptlerde "⚠️ N YENİ kimlik çakışması" diye
  // basılıyor (`arsiv-aktar.js`, `arsiv-tamamla.js`, `lazyfetch-inspect.js`)
  // ve bir İNSAN BAKSIN çağrısı. Sağlayıcının bölüm kimliğini değiştirmesi
  // ise RUTİN bir olay; aynı sayaca girerse alarm gürültüye dönüşür ve
  // "iki farklı yapım birleşti" gibi ciddi bir vaka içinde kaybolur.
  //
  // Ayrım olay tipinde değil, `detail` önekinde yapılıyor. Tarihçe: o dönem
  // `sync_log.event` CHECK'i yeni değer kabul etmiyordu (§C16); M381 şema v3'te
  // CHECK kalktı (canlıda `mirror`/`sayac` olayları duruyor, 2026-10-18) ama
  // önek düzeni korundu — eski satırlar ve sayaçlar ona dayanıyor.
  const cakisma = db.prepare(
    "SELECT count(*) c FROM sync_log WHERE event = 'conflict'" +
      " AND COALESCE(detail, '') NOT LIKE 'KIMLIK_DEGISIMI:%'" +
      " AND COALESCE(detail, '') NOT LIKE 'KAYDIRMA_SUPHESI:%'" +
      // M549: engellenen birleşme (TVDB çift bölümü meşru olarak paylaşır) ve geri gelen emekli
      // kimlik RUTİN — alarm sayılmaz. `TUR_UYUSMAZ`/`KIMLIKSIZ_KAYIT_ENGELLENDI` ise alarm kalır.
      " AND COALESCE(detail, '') NOT LIKE 'IKINCIL_ANAHTAR_REDDI:%'" +
      " AND COALESCE(detail, '') NOT LIKE 'KIMLIK_GERI_DONDU:%'"
  ).get().c;
  const kimlikDegisimi = db.prepare(
    "SELECT count(*) c FROM sync_log WHERE event = 'conflict'" +
      " AND (COALESCE(detail, '') LIKE 'KIMLIK_DEGISIMI:%'" +
      "   OR COALESCE(detail, '') LIKE 'KAYDIRMA_SUPHESI:%'" +
      "   OR COALESCE(detail, '') LIKE 'IKINCIL_ANAHTAR_REDDI:%'" +
      "   OR COALESCE(detail, '') LIKE 'KIMLIK_GERI_DONDU:%')"
  ).get().c;
  const hata = db.prepare("SELECT count(*) c FROM sync_log WHERE event = 'error'").get().c;
  return { enabled: true, entities: e, payloads: p.c, bytes: p.b, externalIds: x, externalIdsEmekli: emekli, conflicts: cakisma, kimlikDegisimi, errors: hata };
}

module.exports = {
  upsertPayload,
  readPayload,
  logSync,
  coverage,
  summary,
  DILSIZ,
};

// ==========================================================================
// KATALOG ARŞİVİ — Operasyonel Sayaçlar (A4, dosya 2/2)
// ==========================================================================
// TEK İŞİ: "arşiv geri düşüşü kaç kez devreye girdi?" sorusunu, sunucu
// süreci ölse bile hayatta kalacak biçimde saymak.
//
// ==========================================================================
// 🔴 NEDEN VAR — A4'ÜN KENDİ DOĞURDUĞU KÖR NOKTA
// ==========================================================================
// A4 ÖNCESİ: sağlayıcı çöküp cache de boşsa kullanıcı HATA görürdü. Hata
// gürültülüdür; birileri fark eder.
// A4 SONRASI: aynı durumda kullanıcı SESSİZCE eski arşiv verisi görüyor.
// Yani sistem "her şey yolunda" gibi davranırken aslında bayat veri servis
// ediyor olabilir — Madde 284/286'nın tam olarak uyardığı şey:
// **fail-soft sessizdir.**
//
// Bu dosya o sessizliği bozar. Madde 260'ın kuralı da bunu emrediyor:
// "yeni bir faz davranış değiştiriyorsa, ÖLÇÜM ARACI aynı turda güncellenir."
//
// ==========================================================================
// 🔴 NEDEN `meta` TABLOSU — `sync_log` DEĞİL
// ==========================================================================
// İlk düşünce `sync_log`'a bir satır yazmaktı; orası zaten arşivin
// operasyonel defteri. AMA: `sync_log.event` bir CHECK kısıtıyla beş değere
// kilitli (`upsert|conflict|error|backfill|vacuum`) ve SQLite'ta bir CHECK'e
// değer eklemek TABLO YENİDEN KURULUMU gerektirir. Canlı, sunucunun açık
// tuttuğu bir veritabanında bunu yapmak — üstelik yalnızca bir sayaç için —
// alınacak bir risk değil.
//
// `meta` ise serbest anahtar/değer ve HİÇBİR kısıtı yok. Şema değişmiyor,
// sürüm artmıyor, göç gerekmiyor.
//
// ⚠️ SAYAÇLAR KATALOG VERİSİ DEĞİLDİR: silinebilir/sıfırlanabilir.
// "Arşiv hiçbir şeyi silmez" kuralı `entities`/`external_ids`/`payloads`
// içindir (`backfill_state` ile aynı istisna).
//
// ⚠️ Bir yazım, o an açık olan bir transaction'a katılabilir (aynı bağlantı)
// ve o transaction geri alınırsa sayaç artışı kaybolur. Kabul edilebilir:
// burası bir SAYAÇ, gerçeğin kaynağı değil. Sayının bir eksik olması
// kimseyi yanıltmaz; ama SIFIR olması yanıltırdı — o yüzden yazım yolu
// mümkün olduğunca basit tutuldu (tek `INSERT ... ON CONFLICT`).

const { getDb } = require('./db');

const ANAHTAR_TOPLAM = 'fallback_toplam';
const ANAHTAR_SON = 'fallback_son_at';
const ANAHTAR_ILK = 'fallback_ilk_at';
const AILE_ONEKI = 'fallback_aile_';

/**
 * Bir arşiv geri düşüşünü kaydeder.
 *
 * 🔴 ASLA THROW ETMEZ. Bu fonksiyon TAM DA sağlayıcı çöktüğünde çağrılıyor,
 * yani sistemin en kırılgan anında. Sayaç yazamamak, kullanıcıya veri
 * dönmesini engelleyemez (`queue.js`/`store.js` ile aynı sözleşme).
 *
 * @param {string} family  LazyFetch aile adı (`show_detail`, ...)
 * @returns {boolean} yazıldı mı (yalnızca teşhis/test için)
 */
function bumpFallback(family) {
  const db = getDb();
  if (!db) return false;
  try {
    const simdi = String(Date.now());
    const artir = db.prepare(
      `INSERT INTO meta (key, value) VALUES (?, '1')
       ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)`
    );
    artir.run(ANAHTAR_TOPLAM);
    if (family) artir.run(AILE_ONEKI + String(family).slice(0, 40));

    // İlk olay: yalnızca YOKSA yazılır — "ne zaman başladı" bilgisi
    // ezilirse kesintinin süresini bir daha hesaplayamayız.
    db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING").run(ANAHTAR_ILK, simdi);
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(ANAHTAR_SON, simdi);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Sayaçları okur. Denetçi (`scripts/lazyfetch-inspect.js`) buradan besleniyor.
 *
 * @param {object} [baglanti]  Salt-okunur bağlantı (denetçi `openReadOnly`
 *   kullanıyor; sunucunun bağlantısını açmasına gerek yok).
 * @returns {{toplam:number, ilkAt:number|null, sonAt:number|null, aileler:Array<{aile:string,adet:number}>}}
 */
function readFallbackStats(baglanti = null) {
  const db = baglanti || getDb();
  const bos = { toplam: 0, ilkAt: null, sonAt: null, aileler: [] };
  if (!db) return bos;
  try {
    const oku = (k) => {
      const r = db.prepare('SELECT value FROM meta WHERE key = ?').get(k);
      return r ? r.value : null;
    };
    const toplam = parseInt(oku(ANAHTAR_TOPLAM) || '0', 10) || 0;
    const aileler = db
      .prepare("SELECT key, value FROM meta WHERE key LIKE ? ORDER BY CAST(value AS INTEGER) DESC")
      .all(AILE_ONEKI + '%')
      .map((r) => ({ aile: r.key.slice(AILE_ONEKI.length), adet: parseInt(r.value, 10) || 0 }));

    const sayi = (v) => (v ? parseInt(v, 10) || null : null);
    return { toplam, ilkAt: sayi(oku(ANAHTAR_ILK)), sonAt: sayi(oku(ANAHTAR_SON)), aileler };
  } catch (_) {
    return bos;
  }
}

/** Yalnızca test/bakım için: sayaçları sıfırlar (katalog verisine dokunmaz). */
function resetFallbackStats() {
  const db = getDb();
  if (!db) return false;
  try {
    db.prepare('DELETE FROM meta WHERE key = ? OR key = ? OR key = ? OR key LIKE ?')
      .run(ANAHTAR_TOPLAM, ANAHTAR_SON, ANAHTAR_ILK, AILE_ONEKI + '%');
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  bumpFallback,
  readFallbackStats,
  resetFallbackStats,
  ANAHTAR_TOPLAM,
  ANAHTAR_SON,
  ANAHTAR_ILK,
  AILE_ONEKI,
};

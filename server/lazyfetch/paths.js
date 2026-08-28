// ==========================================================================
// LAZYFETCH — Yol Çözümleyici (L1, dosya 1/5)
// ==========================================================================
// TEK İŞİ: SSD kök dizinini config'ten okumak, alt klasörleri hazırlamak ve
// "cache şu an kullanılabilir mi" sorusunun TEK gerçek kaynağı olmak.
//
// 🔴 KÖK KURAL (docs/Lazy Down Plan/03_FAZLAR.md "Operasyonel kurallar"):
// yol koda SABİT GÖMÜLMEZ — yalnızca `LAZYFETCH_ROOT` env değişkeninden
// okunur. Env tanımlı değilse veya dizin oluşturulamazsa (SSD takılı değil,
// izin yok, disk dolu) cache SESSİZCE devre dışı kalır — server.js'in geri
// kalanı bundan HİÇ haberdar olmaz, TMDB proxy'si eskisi gibi çalışmaya
// devam eder. Bu modülün var oluş sebebi tam olarak bu: "SSD yoksa sistem
// çökmemeli" kararını TEK bir yerde uygulamak (bkz. 01_MIMARI.md kural 7).
//
// Bu dosya HİÇBİR API'ye, HİÇBİR route'a bağlı değil — bağımsız test
// edilebilir (L1'in kendi doğrulama adımı, plan §Adım 2).

const fs = require('fs');
const path = require('path');

// Üç alt klasörün rolü (bkz. 01_MIMARI.md):
//   cache/       → TTL'li, süpürücü buraya dokunur, silinmesi zararsız
//   tmp/         → atomik yazımın geçici alanı — AYNI dosya sistemi
//                  olması ZORUNLU (rename() yalnızca aynı volume'de atomik)
//   quarantine/  → bozuk JSON buraya taşınır, SİLİNMEZ (teşhis için)
const SUBDIRS = ['cache', 'tmp', 'quarantine'];

let state = null; // { enabled, root, dirs } | { enabled: false, reason }

/**
 * Kökü ve alt klasörleri hazırlamayı DENER. Başarısız olursa hatayı
 * YUTAR ve devre dışı duruma düşer — bu fonksiyon asla throw etmez,
 * çünkü çağrıldığı yer (server.js başlangıcı) LazyFetch olmadan da
 * ayakta kalabilmeli.
 */
function initLazyFetchPaths() {
  const root = process.env.LAZYFETCH_ROOT;

  if (!root || typeof root !== 'string' || root.trim() === '') {
    state = { enabled: false, reason: 'LAZYFETCH_ROOT tanımlı değil' };
    console.log('[LazyFetch] Devre dışı — LAZYFETCH_ROOT env değişkeni tanımlı değil.');
    return state;
  }

  try {
    // `recursive: true` iki şeyi birden yapar: kök zaten varsa hata vermez,
    // yoksa ara klasörleri de (`KaymakTv/LazyFetch`) kendisi açar.
    fs.mkdirSync(root, { recursive: true });

    // Yazılabilirlik kontrolü — dizin VAR ama salt-okunur bir mount ise
    // (ör. SSD arızalı, salt-okunur bağlanmış) `mkdirSync` sessizce
    // başarılı dönebilir; gerçek yazma denemesi asıl kanıttır.
    fs.accessSync(root, fs.constants.W_OK);

    const dirs = {};
    for (const name of SUBDIRS) {
      const full = path.join(root, name);
      fs.mkdirSync(full, { recursive: true });
      fs.accessSync(full, fs.constants.W_OK);
      dirs[name] = full;
    }

    state = { enabled: true, root, dirs };
    console.log(`[LazyFetch] Etkin — kök: ${root}`);
    return state;
  } catch (error) {
    // Hata sınıfı önemli değil (ENOENT/EACCES/EROFS/ENOSPC hepsi aynı
    // sonuca varır): cache kapalı, uygulama çökmez.
    state = { enabled: false, reason: error.message };
    console.error(`[LazyFetch] Devre dışı — dizin hazırlanamadı: ${error.message}`);
    return state;
  }
}

/** Henüz `initLazyFetchPaths()` çağrılmadıysa lazy olarak çağırır — çift init zararsız (mkdirSync idempotent). */
function ensureState() {
  if (state === null) initLazyFetchPaths();
  return state;
}

function isLazyFetchEnabled() {
  return ensureState().enabled === true;
}

/**
 * Alt klasör yolunu döner. Cache KAPALIYSA null döner — çağıran taraf
 * (diskStore.js) bunu "önbelleğe hiç dokunma, doğrudan sağlayıcıya git"
 * sinyali olarak okumalı. `dirName` yazım hatasına karşı `SUBDIRS`'e
 * karşı doğrulanır — sessizce `undefined` dönüp NPE üretmez.
 */
function getLazyFetchDir(dirName) {
  const current = ensureState();
  if (!current.enabled) return null;
  if (!SUBDIRS.includes(dirName)) {
    throw new Error(`[LazyFetch] Bilinmeyen alt klasör: "${dirName}" (beklenen: ${SUBDIRS.join(', ')})`);
  }
  return current.dirs[dirName];
}

/** Teşhis/log amaçlı — neden kapalı olduğunu insan okunur döner. */
function getLazyFetchStatus() {
  return { ...ensureState() };
}

module.exports = {
  initLazyFetchPaths,
  isLazyFetchEnabled,
  getLazyFetchDir,
  getLazyFetchStatus,
};

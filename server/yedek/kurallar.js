// ==========================================================================
// YEDEK KURALLARI — dosya desenleri ve saklama süreleri tek yerde (029 · 2026-11-12)
// ==========================================================================
// Kullanıcı onayı (2026-11-12, kaymakchat 029 §6, "Tamamdır"):
//   1. arşiv  günlük 7 + haftalık 4 + aylık 4, en çok 120 gün
//   2. LazyFetch haftalık; son 4 hafta + son 4 ay, 120 gün
//   3. elle/  120 günden eskiler silinir, en yeni 2 her zaman kalır
//   4. aylık otomatik geri yükleme sınaması
//
// Arşiv kuralı env ile değiştirilebilir (`ARCHIVE_BACKUP_GUNLUK/_HAFTALIK/_AYLIK/_MAX_GUN`);
// diğerleri bilerek sabit — ayar yüzeyi büyüdükçe yanlış ayar olasılığı büyür.

const { DAMGA_DESENI, kuralOku } = require('./saklama');

const DESEN = Object.freeze({
  arsiv: new RegExp(`^katalog-${DAMGA_DESENI}\\.db$`),
  lazyfetch: new RegExp(`^lazyfetch-${DAMGA_DESENI}\\.tar$`),
  // kimlik-onarim.js: `elle-a3-<etiket>-<iso>.db`; elle alınanlar da `elle-<ne>-<damga>.db`.
  elle: new RegExp(`^elle-.*?${DAMGA_DESENI}\\.db$`),
  sinama: new RegExp(`^sinama-${DAMGA_DESENI}\\.json$`),
});

const VARSAYILAN = Object.freeze({
  arsiv: Object.freeze({ sonN: 7, haftalik: 4, aylik: 4, maxGun: 120 }),
  // sonN 1: en yeni tar her koşulda kalır (haftalık yedek uzun süre alınamazsa bile).
  lazyfetch: Object.freeze({ sonN: 1, haftalik: 4, aylik: 4, maxGun: 120 }),
  elle: Object.freeze({ sonN: 2, maxGun: 120, maxGunIcindeHepsi: true }),
  // Raporlar birkaç KB; bir yıllık geçmiş.
  sinama: Object.freeze({ sonN: 12, maxGun: 400 }),
});

/** Arşiv kuralı: env > `keep` (eski `runBackup({keep})` çağrısı) > varsayılan. */
function arsivKurali(ortam = process.env, keep = null) {
  const temel = Number.isFinite(keep) && keep >= 1 ? { ...VARSAYILAN.arsiv, sonN: Math.floor(keep) } : VARSAYILAN.arsiv;
  return kuralOku(ortam, 'ARCHIVE_BACKUP', temel);
}

/** LazyFetch tar'ı silinince yanındaki iki dosya da gider. */
function lazyfetchEslikci(ad) {
  const kok = ad.replace(/\.tar$/, '');
  return [`${kok}.sha256`, `${kok}.json`];
}

module.exports = { DESEN, VARSAYILAN, arsivKurali, lazyfetchEslikci };

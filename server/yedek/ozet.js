// ==========================================================================
// YEDEK ÖZETİ — `/api/health` için (029 §4 · 2026-11-12)
// ==========================================================================
// Sağlık ucunun sözleşmesi: yol, dosya adı, hata metni DÖNMEZ — yalnız zaman ve sayı.
// Üç küçük klasörün `readdir`'i (en çok ~30 dosya); uç zaten dakikada 30 istekle sınırlı.

const { yedekKlasorleri } = require('./klasorler');
const { kopyalariListele } = require('./saklama');
const { DESEN } = require('./kurallar');
const { sonRapor } = require('./sinama');

/**
 * @returns {{sonArsiv: string|null, sonLazyfetch: string|null, sonSinama: {at: string, ok: boolean}|null,
 *   kopya: {arsiv: number, lazyfetch: number, elle: number}}|null}
 */
function yedekOzeti(ortam = process.env) {
  try {
    const k = yedekKlasorleri(ortam);
    if (!k) return null;
    const arsiv = kopyalariListele(k.arsiv, DESEN.arsiv);
    const lazyfetch = kopyalariListele(k.lazyfetch, DESEN.lazyfetch);
    const elle = kopyalariListele(k.elle, DESEN.elle);
    const rapor = sonRapor(k.sinama);
    return {
      sonArsiv: arsiv[0] ? arsiv[0].t.toISOString() : null,
      sonLazyfetch: lazyfetch[0] ? lazyfetch[0].t.toISOString() : null,
      sonSinama: rapor ? { at: String(rapor.at), ok: rapor.ok === true } : null,
      kopya: { arsiv: arsiv.length, lazyfetch: lazyfetch.length, elle: elle.length },
    };
  } catch (_) {
    return null;
  }
}

module.exports = { yedekOzeti };

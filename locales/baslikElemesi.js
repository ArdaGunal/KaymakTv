// ==========================================================================
// BAŞLIK ELEMESİ — çeviri adı gösterilebilir mi? (BASLIK · 2.6.8)
// ==========================================================================
// Karar kaydı: `docs/testler/2.6.8.md` §0 madde 6. TEK kaynak: Pi (CommonJS, aynaya giden `titles`)
// ve istemci (detaydaki ikincil satır) aynı kuralı kullanır; iki kopya er ya da geç ıraksardı.
//
// Düz JS + `.d.ts`: Pi TypeScript okuyamaz. `\p{Script=…}` bilerek yok: Hermes'te her betik adı
// çalışmıyor, aralık tablosu her motorda aynı sonucu verir. Dil kaydına yeni alfabe eklenirse
// (`diller.json` → `alfabe`) buraya aralığı da eklenir; tablodaki olmayan alfabe reddedilir.
// SAF — bağımlılık yok.

// Görünmez yön ve biçim işaretleri (ölçüldü: The Office → «‎Ofis‎»).
const GORUNMEZ = /[​-‏‪-‮⁠﻿]/g;

// Harf aralığı + ortak noktalama/simge blokları: başlıkta «·», «–», «№» alfabeyi değiştirmez.
const ORTAK = '\\u0000-\\u00BF\\u2000-\\u206F\\u20A0-\\u20CF\\u2100-\\u214F';
const ALFABELER = {
  Latn: new RegExp(`^[${ORTAK}\\u00C0-\\u024F\\u1E00-\\u1EFF]*$`),
};

// Karşılaştırmada yok sayılan: boşluk ve noktalama.
const KARSILASTIRMA_DISI = /[\s!-/:-@[-`{-~ -¿ -⁯]/g;

/** Baş/son boşluk ve görünmez işaretler gider; metin değilse ya da boş kalırsa `null`. */
function adTemizle(ad) {
  if (typeof ad !== 'string') return null;
  const temiz = ad.replace(GORUNMEZ, '').trim();
  return temiz || null;
}

/** Büyük/küçük harf, noktalama ve boşluk dışında aynı mı? «…and The Rose» ≈ «…and the Rose». */
function baslikEsit(a, b) {
  const kok = (s) => String(s ?? '').replace(KARSILASTIRMA_DISI, '').toLowerCase();
  const ka = kok(a);
  return ka.length > 0 && ka === kok(b);
}

/** Metin bu alfabeyle yazılmış mı (ISO 15924)? Tabloda olmayan alfabe `false`. */
function ayniAlfabe(metin, alfabe) {
  const kalip = ALFABELER[alfabe];
  return Boolean(kalip && typeof metin === 'string' && kalip.test(metin));
}

/**
 * TMDB'nin `hedefDil` adı gösterilebilir mi? Geçerse temiz ad, geçmezse `null`.
 * - Özgün dil hedef dil değilken özgün adın aynısıysa çeviri değildir (La casa de papel).
 * - Hedef dilin alfabesinde değilse reddedilir (進撃の巨人).
 * Yapımın kendi dilindeki adı (özgün dil = hedef dil) özgün adla aynı olabilir, kural ona uygulanmaz.
 */
function ceviriAdi({ ad, ozgunAd, ozgunDil, hedefDil, hedefAlfabe }) {
  const temiz = adTemizle(ad);
  if (!temiz || !ayniAlfabe(temiz, hedefAlfabe)) return null;
  if (ozgunDil !== hedefDil && baslikEsit(temiz, ozgunAd)) return null;
  return temiz;
}

module.exports = { adTemizle, baslikEsit, ayniAlfabe, ceviriAdi };

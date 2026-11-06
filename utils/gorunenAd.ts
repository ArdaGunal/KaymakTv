// ==========================================================================
// GÖRÜNEN AD — istemci temizliği (SAF; 2.6.8 AD-01)
// ==========================================================================
// Asıl kural SUNUCUDA: `kaymaktv-feedback-worker/src/lib/profileDisplayName.js`
// (`displayNameNormalize`) + DB CHECK `053`. Bu dosya o temizliği AYNALAR ve
// sunucuda henüz olmayan üç adımı ekler (kullanıcı kararı 2026-11-06):
//   1. Sunucunun `GORUNMEZ` listesine ek görünmez karakterler
//      (U+00AD yumuşak tire, U+034F, U+061C, U+180E) silinir.
//   2. Boşluk benzeri karakterler (NBSP, U+2000–200A, U+3000, satır/paragraf
//      ayırıcı U+2028/2029 …) normal boşluğa döner → ardışık boşluk teke iner.
//   3. Yalnız dolgu karakterinden (Hangul U+3164/U+115F/U+1160/U+FFA0, boş
//      Braille U+2800) oluşan ad «boş» sayılır → kayıt adı KALDIRIR.
// Kayıtta bu temiz değer gider; sayaç ve «değişmedi» kontrolü de onu ölçer.
// ⚠️ Eski APK ya da doğrudan istek bu katmanı atlar — sunucu karşılığı BACKLOG'da.
// Türkçe harf, emoji ve sembol serbest (izin listesi YOK); ZWJ korunur
// (birleşik emoji bölünmesin), sunucu da korur.
// 🔴 Desenlerde yalnız `\u` kaçışı: kaynakta çıplak görünmez karakter olmaz.

/** Worker `AD_EN_COK` ile aynı sınır (kod noktası). */
export const AD_EN_COK = 50;

// Sunucunun `GORUNMEZ` deseni (profileBio.js) + ek dört karakter (00AD, 034F, 061C, 180E).
const GORUNMEZ = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u00AD\u034F\u061C\u180E\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const BOSLUK_BENZERI = /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g;
const DOLGU = /[\u115F\u1160\u3164\uFFA0\u2800]/g;

/** Yazılacak görünen ad ve kod noktası uzunluğu. Boş dize = adı kaldır. */
export function adOnizle(ham: string): { deger: string; uzunluk: number } {
  const temiz = ham
    .replace(/[\r\n\t]+/g, ' ')
    .replace(GORUNMEZ, '')
    .replace(BOSLUK_BENZERI, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
  const deger = temiz.replace(DOLGU, '').trim() === '' ? '' : temiz;
  return { deger, uzunluk: Array.from(deger).length };
}

// ==========================================================================
// YEDEK SAKLAMA — hangi kopya kalır, hangisi silinir (029 · 2026-11-12)
// ==========================================================================
// TEK İŞİ: bir yedek klasöründe hangi kopyaların kalacağına karar vermek ve gerisini silmek.
//
// Kullanıcı (2026-11-12): "yedekler birikip birikip bir çok yedek olmasın … her yedek 3 4 ay sonra
// silinebilir … eski verileri sonsuza kadar tutmaya gerek yok."
//
// KURAL (restic `--keep-*` anlamıyla; bir kopya birden çok kurala aynı anda uyabilir):
//   sonN      en yeni N kopya — YAŞINA BAKILMAZ. Yedek bir hafta alınamazsa elde kalan son
//             kopyalar silinmez (sayıya göre, güne göre değil).
//   haftalik  en yeni kopyadan geriye, birbirinden farklı ilk H ISO haftasının her birinin en yenisi
//   aylik     aynı şey takvim aylarıyla
//   maxGun    bundan eski her kopya silinir — `sonN` bunun bile önündedir
//   maxGunIcindeHepsi  true ise maxGun içindeki her kopya kalır (elle/ klasörü)
//
// 🔴 YAŞ DOSYA ADINDAKİ DAMGADAN okunur (UTC), `mtime`'dan değil: kopyalama/taşıma mtime'ı
// değiştirebilir, ad değişmez. Adı çözülemeyen dosyaya HİÇ dokunulmaz.
// 🔴 YALNIZ VERİLEN DESEN silinir: klasörde başka bir dosya varsa olduğu gibi kalır.

const fs = require('fs');
const path = require('path');

const GUN_MS = 24 * 60 * 60 * 1000;
const DAMGA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3})Z)?$/;
/** Desenlerde kullanılacak damga parçası (1. yakalama grubu bu olmalı). */
const DAMGA_DESENI = '(\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}(?:-\\d{3}Z)?)';

/**
 * Dosya adından UTC tarihi çıkarır. `desen`in 1. yakalama grubu damgadır.
 * Desen uymazsa ya da tarih geçersizse (13. ay, 31 Şubat) `null`.
 */
function damgaCoz(ad, desen) {
  const m = desen.exec(String(ad));
  if (!m || !m[1]) return null;
  const d = DAMGA.exec(m[1]);
  if (!d) return null;
  const [y, ay, g, s, dk, sn] = d.slice(1, 7).map(Number);
  const ms = d[7] ? Number(d[7]) : 0;
  if (s > 23 || dk > 59 || sn > 59) return null;
  const t = new Date(Date.UTC(y, ay - 1, g, s, dk, sn, ms));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== ay - 1 || t.getUTCDate() !== g) return null;
  return t;
}

/** ISO 8601 hafta anahtarı (UTC), ör. `2026-H46`. Yıl sınırındaki haftalar doğru yıla düşer. */
function isoHafta(t) {
  const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  const gun = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - gun);
  const yil = d.getUTCFullYear();
  const hafta = Math.ceil(((d - Date.UTC(yil, 0, 1)) / GUN_MS + 1) / 7);
  return `${yil}-H${String(hafta).padStart(2, '0')}`;
}

function ayAnahtari(t) {
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
}

function kuralTamamla(kural = {}) {
  const sayi = (v, vars) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : vars);
  return {
    // 🔴 En az 1: hiçbir kural klasördeki SON kopyayı silemez.
    sonN: Math.max(1, sayi(kural.sonN, 7)),
    haftalik: sayi(kural.haftalik, 0),
    aylik: sayi(kural.aylik, 0),
    maxGun: Number.isFinite(kural.maxGun) && kural.maxGun > 0 ? kural.maxGun : null,
    maxGunIcindeHepsi: kural.maxGunIcindeHepsi === true,
  };
}

/**
 * SAF karar. Girdi `[{ad, t: Date}]`, çıktı hangi adın kaldığı ve nedeni.
 * @returns {{tutulan: Array<{ad, t, nedenler: string[]}>, silinecek: Array<{ad, t}>}}
 */
function saklamaKarari(kayitlar, kural, simdi = new Date()) {
  const k = kuralTamamla(kural);
  const sirali = [...kayitlar].sort((a, b) => (b.t - a.t) || (a.ad < b.ad ? 1 : -1));
  const tutulan = [];
  const silinecek = [];
  let sonHafta = null;
  let haftaSay = 0;
  let sonAy = null;
  let aySay = 0;
  sirali.forEach((x, i) => {
    const nedenler = [];
    if (i < k.sonN) nedenler.push('son');
    const sinirIcinde = k.maxGun === null || (simdi - x.t) / GUN_MS <= k.maxGun;
    if (sinirIcinde) {
      if (k.maxGunIcindeHepsi) nedenler.push('sure');
      const h = isoHafta(x.t);
      if (haftaSay < k.haftalik && h !== sonHafta) { nedenler.push('hafta'); haftaSay++; sonHafta = h; }
      const a = ayAnahtari(x.t);
      if (aySay < k.aylik && a !== sonAy) { nedenler.push('ay'); aySay++; sonAy = a; }
    }
    if (nedenler.length) tutulan.push({ ad: x.ad, t: x.t, nedenler });
    else silinecek.push({ ad: x.ad, t: x.t });
  });
  return { tutulan, silinecek };
}

/**
 * Klasördeki desene uyan, adı çözülebilen DÜZ dosyaları listeler (sembolik bağ ve klasör hariç).
 * Klasör yoksa boş liste.
 */
function kopyalariListele(dizin, desen) {
  let adlar;
  try { adlar = fs.readdirSync(dizin); } catch { return []; }
  const sonuc = [];
  for (const ad of adlar) {
    const t = damgaCoz(ad, desen);
    if (!t) continue;
    try {
      if (!fs.lstatSync(path.join(dizin, ad)).isFile()) continue;
    } catch { continue; }
    sonuc.push({ ad, t });
  }
  return sonuc.sort((a, b) => b.t - a.t);
}

/**
 * Klasörü kurala göre budar. Throw ETMEZ.
 * @param {string} dizin
 * @param {{desen: RegExp, kural: object, simdi?: Date, eslikci?: (ad: string) => string[], kuru?: boolean}} secenek
 *   `eslikci`: bir kopya silinirken onunla birlikte silinecek yan dosyalar (ör. `.sha256`).
 * @returns {{toplam: number, tutulan: number, silinen: string[], hatalar: string[]}}
 */
function budaDizin(dizin, { desen, kural, simdi = new Date(), eslikci = () => [], kuru = false }) {
  const kayitlar = kopyalariListele(dizin, desen);
  const { tutulan, silinecek } = saklamaKarari(kayitlar, kural, simdi);
  const silinen = [];
  const hatalar = [];
  if (!kuru) {
    for (const { ad } of silinecek) {
      try {
        fs.unlinkSync(path.join(dizin, ad));
        silinen.push(ad);
      } catch (error) {
        hatalar.push(`${ad}: ${error.code || error.message}`);
        continue;
      }
      for (const yan of eslikci(ad)) {
        if (!yan || yan === ad || path.basename(yan) !== yan) continue; // yalnız aynı klasörde, düz ad
        try { fs.unlinkSync(path.join(dizin, yan)); } catch (_) { /* yan dosya yoksa sorun değil */ }
      }
    }
  }
  return { toplam: kayitlar.length, tutulan: tutulan.length, silinen: kuru ? silinecek.map((x) => x.ad) : silinen, hatalar };
}

/** `PREFIX_GUNLUK` gibi env değerlerini okur; geçersiz/boş → varsayılan. */
function kuralOku(ortam, onEk, varsayilan) {
  const oku = (ad, vars) => {
    const ham = String(ortam[`${onEk}_${ad}`] ?? '').trim();
    if (!/^\d+$/.test(ham)) return vars;
    return Number(ham);
  };
  return {
    ...varsayilan,
    sonN: Math.max(1, oku('GUNLUK', varsayilan.sonN)),
    haftalik: oku('HAFTALIK', varsayilan.haftalik),
    aylik: oku('AYLIK', varsayilan.aylik),
    maxGun: oku('MAX_GUN', varsayilan.maxGun) || null,
  };
}

module.exports = {
  GUN_MS,
  DAMGA_DESENI,
  damgaCoz,
  isoHafta,
  ayAnahtari,
  kuralTamamla,
  saklamaKarari,
  kopyalariListele,
  budaDizin,
  kuralOku,
};

// ==========================================================================
// ADAPTÖR KAPSAM DENETİMİ — "hangi yazma yolu Trakt'a kaçıyor?"
// ==========================================================================
// Çalıştır:  node tests/ilerleme/adaptor-kapsam.test.js
//
// 🔴 NEDEN VAR — GERÇEK BİR HATANIN ÜRÜNÜ (2026-09-09):
// Faz T'de "yazma yollarını adapte ettim" denildi ama `progress.ts` ve
// `collections.ts` adapte edilip **`ratings.ts` GÖZDEN KAÇTI**. Kaymak
// kullanıcısı puan veremedi; hata ancak cihazda görüldü.
//
// Üstelik hata bir DEĞİL ÜÇ yerdeydi: `ratings.ts`'in kendisi + İKİ hook
// (`useEpisodeActions`, `useShowDetailHandlers`) ham `traktApi`'yi DOĞRUDAN
// çağırıyordu — mutasyon katmanını hiç kullanmadan.
//
// Bu denetim aynı sınıf kaçağı yapısal olarak yakalar:
//   1. `services/library/mutations/` altındaki HER dosya adaptöre bağlı mı?
//   2. Hook/bileşen katmanı ham `traktApi` yazma fonksiyonu çağırıyor mu?
const fs = require('node:fs');
const path = require('node:path');

const KOK = path.resolve(__dirname, '..', '..');
let gecti = 0, kaldi = 0;
const bekle = (ad, kosul, ipucu = '') => {
  console.log(`  ${kosul ? '✅' : '⛔'} ${ad}${kosul ? '' : '  → ' + ipucu}`);
  kosul ? gecti++ : kaldi++;
};

// ── 1) Mutasyon dosyalarının tamamı adaptöre bağlı mı? ───────────────────
const MUT = path.join(KOK, 'services', 'library', 'mutations');
const mutDosyalar = fs.readdirSync(MUT).filter((f) => f.endsWith('.ts'));

// Adaptör kararı GEREKTİRMEYEN dosyalar — ağa hiç çıkmıyorlar.
const MUAF = new Set([
  'optimistikIlerleme.ts', // saf hesap, ağ yok
  'invalidation.ts',       // önbellek geçersizleme, ağ yok
]);

console.log('\n═══ Mutasyon dosyaları adaptöre bağlı mı? ═══');
for (const dosya of mutDosyalar) {
  if (MUAF.has(dosya)) continue;
  const src = fs.readFileSync(path.join(MUT, dosya), 'utf8');
  const traktCagiriyor = /from '\.\.\/\.\.\/traktApi'/.test(src);
  if (!traktCagiriyor) continue; // Trakt'a hiç gitmiyorsa adaptör gerekmez

  bekle(
    `${dosya}: token tipine bakıyor`,
    /kaymakKullanicisiMi\(\)/.test(src),
    'Trakt çağırıyor ama Kaymak kullanıcısını AYIRT ETMİYOR → 401',
  );
}

// ── 2) UI katmanı ham `traktApi` YAZMA fonksiyonu çağırıyor mu? ──────────
// Yazma fiilleri: bunlar kullanıcı verisini değiştirir ve adaptörden
// GEÇMEK ZORUNDA. Okuma fonksiyonları (getX) kapsam dışı.
const YASAK = [
  'addRating', 'removeRating',
  'addEpisodeToHistory', 'addSeasonToHistory', 'addMovieToHistory',
  'removeEpisodeFromHistoryTrakt', 'removeSeasonFromHistoryTrakt', 'removeFromHistoryTrakt',
  'addToWatchlistTrakt', 'removeFromWatchlistTrakt',
  'hideItemTrakt', 'unhideItemTrakt', 'toggleLikedMedia',
];

const tara = (dizin, cikti = []) => {
  for (const ad of fs.readdirSync(dizin)) {
    if (ad === 'node_modules' || ad === '.expo') continue;
    const tam = path.join(dizin, ad);
    if (fs.statSync(tam).isDirectory()) tara(tam, cikti);
    else if (/\.tsx?$/.test(ad)) cikti.push(tam);
  }
  return cikti;
};

const uiDosyalar = [
  ...tara(path.join(KOK, 'hooks')),
  ...tara(path.join(KOK, 'components')),
  ...tara(path.join(KOK, 'app')),
  ...tara(path.join(KOK, 'screens')),
];

console.log('\n═══ UI katmanında ham Trakt YAZMA çağrısı var mı? ═══');
const kacaklar = [];
for (const tam of uiDosyalar) {
  const src = fs.readFileSync(tam, 'utf8');
  if (!/from '.*services\/traktApi'/.test(src)) continue;
  for (const fn of YASAK) {
    // Yalnızca GERÇEK çağrı: `await fn(` ya da `fn(` — yorum satırı değil.
    const re = new RegExp('^(?!\\s*(//|\\*)).*\\b' + fn + '\\s*\\(', 'm');
    if (re.test(src)) {
      kacaklar.push(`${path.relative(KOK, tam).replace(/\\/g, '/')} → ${fn}()`);
    }
  }
}
bekle(
  'hiçbir ekran/hook ham Trakt yazma fonksiyonu çağırmıyor',
  kacaklar.length === 0,
  'adaptörü ATLIYOR:\n       ' + kacaklar.join('\n       '),
);

// ── 3) Bilinen adaptör giriş noktaları duruyor mu? ───────────────────────
console.log('\n═══ Adaptör giriş noktaları ═══');
const ratings = fs.readFileSync(path.join(MUT, 'ratings.ts'), 'utf8');
for (const fn of ['rateMedia', 'unrateMedia', 'rateEpisodeMedia', 'unrateEpisodeMedia']) {
  bekle(`ratings.ts: ${fn} var`, new RegExp('export const ' + fn + '\\b').test(ratings));
}

// ── 4) Gölge yazım (dual write) — puanlar, 2026-09-09 ────────────────────
// 🔴 KURAL: Trakt'lı kullanıcının puanı HEM Trakt'a HEM bize gider, ama
// gölge yazma ANA yazmayı ASLA bozamaz. Kullanıcının eylemi Trakt'ta
// başarılıysa başarılıdır; bizim kopyamız `katalogda_yok` (409) yüzünden
// düşebilir ve bu BEKLENEN bir durumdur.
console.log('\n═══ Gölge yazım (puanlar) ═══');
bekle('golgeYaz yardımcısı var', ratings.includes('const golgeYaz = async'));
bekle(
  'gölge hata YUTUYOR ama iz bırakıyor',
  ratings.includes('logError(`mutations.ratings.golge.'),
  'gölge throw ederse kullanıcının Trakt puanı geri alınır — ana yazma bozulur',
);
bekle(
  'dizi/film puanı gölgeleniyor',
  ratings.includes('golgeYaz(`rate.${type}`'),
);
bekle(
  '🔴 SİLME de gölgeleniyor (dizi/film + bölüm)',
  ratings.includes('golgeYaz(`unrate.${type}`') && ratings.includes("golgeYaz('unrate.episode'"),
  'yalnızca yazma gölgelenirse kaldırılan puan bizde KALIR ve T5 içe aktarımında dirilir',
);
bekle(
  'bölüm puanı gölgeleniyor',
  ratings.includes("golgeYaz('rate.episode'"),
);
bekle(
  '⚠️ İZLEME geçmişi gölgelenMİYOR (istisna yalnızca puanlar)',
  !fs.readFileSync(path.join(MUT, 'progress.ts'), 'utf8').includes('golgeYaz'),
  'kullanıcı istisnayı açıkça puanlarla sınırladı — devir §4.7 duruyor',
);

console.log(`\n${kaldi ? '⛔ ' + kaldi + ' KALDI' : '🎉 TÜMÜ GEÇTİ'} — geçen ${gecti}, kalan ${kaldi}`);
process.exit(kaldi ? 1 : 0);

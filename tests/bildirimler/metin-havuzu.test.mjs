// ==========================================================================
// BILDIRIMLER — B2: METIN HAVUZU
// ==========================================================================
// 🔴 BU DOSYANIN EN DEGERLI IDDIASI EN SONDA: havuzdaki HER varyantin HEM
// tr HEM en cevirisi var mi. Kullanicinin acikca soyledigi kullanim sekli
// "ilerde yeni bildirim metinleri ekleyip silecegim" — ve bu isin bir numarali
// hatasi pool.ts'e satir ekleyip ceviriyi unutmaktir. O durumda kullaniciya
// bildirimde HAM i18n ANAHTARI gorunur ("copy.episodeToday.xyz.title").
// Testsiz bu hata ancak gercek bir bildirim dustugunde fark edilir.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import yardimci from '../yardimci.js';
import {
  COPY_POOL,
  variantBodyKey,
  variantTitleKey,
} from '../../features/notifications/copy/pool.ts';
import {
  isVariantActive,
  pickVariant,
  pushRecent,
  RECENT_MEMORY,
} from '../../features/notifications/copy/picker.ts';

const { baslat, PROJE_KOKU } = yardimci;
const T = baslat('METIN HAVUZU (B2)', { kokOneki: 'bildirim-copy-' });

const yerel = (y, ay, gun) => new Date(y, ay, gun, 12, 0, 0, 0);

// ─────────────────────────────────────────────────────────────────────────
T.H('isVariantActive — mevsimsel pencere');

const penceresiz = { id: 'a', category: 'episodeToday', weight: 1, tone: 'playful' };
const yazPenceresi = { ...penceresiz, id: 'yaz', activeFrom: '06-01', activeUntil: '08-31' };
const yilbasi = { ...penceresiz, id: 'yb', activeFrom: '12-20', activeUntil: '01-05' };

T.ok('Penceresiz varyant her zaman aktif', isVariantActive(penceresiz, yerel(2026, 2, 14)));
T.ok('Yaz penceresi icinde aktif', isVariantActive(yazPenceresi, yerel(2026, 6, 15)));
T.ok('Yaz penceresi disinda pasif', !isVariantActive(yazPenceresi, yerel(2026, 1, 15)));

// YIL SINIRINI ASAN PENCERE: en degerli mevsimsel pencere (yilbasi) tam
// olarak yil sinirina oturuyor; basit "from <= x <= until" mantigi burada
// SESSIZCE hep false donerdi.
T.ok('Yil sinirini asan pencere: 25 Aralik AKTIF', isVariantActive(yilbasi, yerel(2026, 11, 25)));
T.ok('Yil sinirini asan pencere: 3 Ocak AKTIF', isVariantActive(yilbasi, yerel(2026, 0, 3)));
T.ok('Yil sinirini asan pencere: 15 Haziran PASIF', !isVariantActive(yilbasi, yerel(2026, 5, 15)));
T.ok(
  'Bozuk pencere varyanti KAYBETMEZ, her zaman aktif sayilir',
  isVariantActive({ ...penceresiz, activeFrom: 'saemai', activeUntil: '01-05' }, yerel(2026, 5, 15)),
);

// ─────────────────────────────────────────────────────────────────────────
T.H('pickVariant — secim kurallari');

const havuz = [
  { id: 'p1', category: 'episodeToday', weight: 1, tone: 'playful' },
  { id: 'p2', category: 'episodeToday', weight: 1, tone: 'playful' },
  { id: 'n1', category: 'episodeToday', weight: 1, tone: 'neutral' },
  { id: 'kapali', category: 'episodeToday', weight: 0, tone: 'playful' },
  { id: 'baska', category: 'baskaKategori', weight: 1, tone: 'playful' },
];

const sec = (ek = {}) =>
  pickVariant(havuz, {
    categoryId: 'episodeToday',
    tone: 'playful',
    now: yerel(2026, 5, 15),
    recentIds: [],
    random: () => 0,
    ...ek,
  });

T.ok('Baska kategorinin varyanti secilmez', sec()?.category === 'episodeToday');
T.ok(
  'weight=0 varyant hic secilmez',
  [0, 0.3, 0.6, 0.99].every((r) => sec({ random: () => r })?.id !== 'kapali'),
);

// TON BIR TAVANDIR: playful kategori notr varyantlari da kullanabilir.
// Birebir eslestirseydik `n1` olu veri olurdu.
T.ok(
  'playful kategori notr varyanti da secebilir (ton = tavan)',
  sec({ random: () => 0.99 })?.id === 'n1',
);
// Ters yon KRITIK: notr bir kategoriye sakaci metin dusmemeli.
T.ok(
  'neutral kategori sakaci varyant SECMEZ',
  [0, 0.3, 0.6, 0.99].every((r) => pickVariant(havuz, {
    categoryId: 'episodeToday',
    tone: 'neutral',
    now: yerel(2026, 5, 15),
    recentIds: [],
    random: () => r,
  })?.tone === 'neutral'),
);

T.ok('Son gosterilen varyant dislanir', sec({ recentIds: ['p1'] })?.id !== 'p1');
T.ok(
  'HEPSI yakin zamanda gosterildiyse yine de bir sey doner (asla null degil)',
  sec({ recentIds: ['p1', 'p2', 'n1'] }) !== null,
);
T.ok('Hic uygun varyant yoksa null doner', pickVariant([], {
  categoryId: 'episodeToday', tone: 'playful', now: yerel(2026, 5, 15), recentIds: [], random: () => 0,
}) === null);

// ─────────────────────────────────────────────────────────────────────────
T.H('pushRecent — halka tampon');

T.ok('Yeni id basa eklenir', pushRecent(['a', 'b'], 'c')[0] === 'c');
T.ok('Halka RECENT_MEMORY ile sinirli', pushRecent(['a', 'b', 'c'], 'd').length === RECENT_MEMORY);
T.ok('Ayni id iki kez birikmez', pushRecent(['a', 'b'], 'a').join(',') === 'a,b');
T.ok('Girdi YERINDE degistirilmez', (() => {
  const girdi = ['a', 'b'];
  pushRecent(girdi, 'c');
  return girdi.join(',') === 'a,b';
})());

// ─────────────────────────────────────────────────────────────────────────
T.H('i18n butunlugu — havuz ile ceviriler eslesiyor mu');

const ceviri = (dil) =>
  JSON.parse(fs.readFileSync(path.join(PROJE_KOKU, 'locales', dil, 'notifications.json'), 'utf8'));
const oku = (nesne, anahtar) => anahtar.split('.').reduce((o, k) => (o == null ? o : o[k]), nesne);

const tr = ceviri('tr');
const en = ceviri('en');
const eksikler = [];

for (const varyant of COPY_POOL) {
  for (const [dil, sozluk] of [['tr', tr], ['en', en]]) {
    for (const anahtar of [variantTitleKey(varyant), variantBodyKey(varyant)]) {
      if (typeof oku(sozluk, anahtar) !== 'string') eksikler.push(`${dil}:${anahtar}`);
    }
  }
}

T.ok(
  'Havuzdaki HER varyantin tr+en basligi ve govdesi var',
  eksikler.length === 0,
  eksikler.length ? 'EKSIK -> ' + eksikler.join(', ') : COPY_POOL.length + ' varyant x 2 dil',
);

// Ters yon: cevirisi olup havuzda karsiligi olmayan varyant = olu ceviri.
// TUM kategoriler taranir; tek kategoriye sabitlemek, yeni kategori
// eklendiginde bu korumayi sessizce devre disi birakirdi.
const oluCeviriler = [];
for (const [kategori, varyantlar] of Object.entries(oku(tr, 'copy') ?? {})) {
  if (kategori === 'fallback') continue; // ortak yedek metin, havuzda yok
  const havuzIdleri = new Set(COPY_POOL.filter((v) => v.category === kategori).map((v) => v.id));
  for (const id of Object.keys(varyantlar)) {
    if (!havuzIdleri.has(id)) oluCeviriler.push(`${kategori}.${id}`);
  }
}
T.ok(
  'Havuzda karsiligi olmayan OLU ceviri yok (tum kategoriler)',
  oluCeviriler.length === 0,
  oluCeviriler.length ? 'OLU -> ' + oluCeviriler.join(', ') : 'temiz',
);

// Havuzdaki her kategorinin ceviri blogu var mi (yeni kategori eklendiginde
// tum blogu unutma hatasini yakalar).
const havuzKategorileri = [...new Set(COPY_POOL.map((v) => v.category))];
const bloksuz = havuzKategorileri.filter((k) => oku(tr, `copy.${k}`) == null || oku(en, `copy.${k}`) == null);
T.ok(
  'Havuzdaki her kategorinin tr+en ceviri blogu var',
  bloksuz.length === 0,
  bloksuz.length ? 'EKSIK -> ' + bloksuz.join(', ') : havuzKategorileri.join(', '),
);

T.ok(
  'Yedek (fallback) metin her iki dilde de var',
  typeof oku(tr, 'copy.fallback.title') === 'string' &&
    typeof oku(tr, 'copy.fallback.body') === 'string' &&
    typeof oku(en, 'copy.fallback.title') === 'string' &&
    typeof oku(en, 'copy.fallback.body') === 'string',
);

T.bitir();

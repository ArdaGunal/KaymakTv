// ==========================================================================
// ARAYUZ — M575: kutuphane yazimlarinin tek kapisi
// ==========================================================================
// Hata (emulator 2026-11-05, test hesabi): herkes bizden okuyor (T6.3), ama film/dizi
// silme, izleme listesi, favori ve Birak Trakt'li kullanicida yalniz Trakt'a yaziyordu.
// Ekran dogru gorunuyor, /library/sync sonrasi islem geri aliniyordu.
//
// Bu test ayni sinif hatayi YAPISAL olarak yakalar: Trakt'a yazan fonksiyon cift yazim
// kapisinin disinda cagrilirsa kalir. Yeni bir Trakt yazma fonksiyonu eklenirse YAZMA_UCU
// taramasi onu da yakalar.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const T = yardimci.baslat('ARAYUZ YAZIM KAPISI (M575)', { kokOneki: 'arayuz-yazim-kapisi-' });
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const oku = (...p) => fs.readFileSync(path.join(KOK, ...p), 'utf8');
const koduAyikla = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const tara = (dizin, cikti = []) => {
  for (const ad of fs.readdirSync(path.join(KOK, dizin))) {
    if (ad === 'node_modules' || ad === '.expo') continue;
    const yol = path.join(dizin, ad);
    if (fs.statSync(path.join(KOK, yol)).isDirectory()) tara(yol, cikti);
    else if (/\.tsx?$/.test(ad)) cikti.push(yol);
  }
  return cikti;
};
const KAYNAK = ['app', 'components', 'features', 'hooks', 'screens', 'services', 'store', 'utils']
  .flatMap((d) => tara(d));

// ──────────────────────────────────────────────────────────────────────────
T.H('Trakt yazma fonksiyonlari listesi eksik degil');

// Trakt kutuphane yazimi yapan disa aktarimlar. Ozel listeler kapsam disi: onlar Trakt'tan
// okunur, yazim da Trakt'a gider (BACKLOG D18). Isaretleme ayri kalici kuyrukta iki yere yazar.
const KAPIDAN_GECMELI = [
  'addToWatchlistTrakt', 'removeFromWatchlistTrakt', 'toggleLikedMedia',
  'removeFromHistoryTrakt', 'removeEpisodeFromHistoryTrakt', 'removeSeasonFromHistoryTrakt',
];
const KUYRUK_UCLARI = ['addEpisodeToHistory', 'addSeasonToHistory', 'addEpisodesBulkToHistory', 'addMovieToHistory'];
const EMNIYET_UCLARI = ['hideItemTrakt', 'unhideItemTrakt'];
const OZEL_LISTE_UCLARI = ['createCustomList', 'deleteCustomList', 'addMediaToCustomList', 'removeMediaFromCustomList',
  'getOrCreateLikedList'];
const bilinen = new Set([...KAPIDAN_GECMELI, ...KUYRUK_UCLARI, ...EMNIYET_UCLARI, ...OZEL_LISTE_UCLARI]);

const yeni = [];
for (const dosya of fs.readdirSync(path.join(KOK, 'services', 'api', 'users'))) {
  const src = koduAyikla(oku('services', 'api', 'users', dosya));
  const re = /export const (\w+) = async[\s\S]*?(?=\nexport |$)/g;
  for (const m of src.matchAll(re)) {
    if (/\.(post|delete|put)\(/.test(m[0]) && !bilinen.has(m[1])) yeni.push(`${dosya}:${m[1]}`);
  }
}
T.ok('Yeni Trakt yazma fonksiyonu yok (eklendiyse once kapiyi dusun)', yeni.length === 0, yeni.join(', '));

// ──────────────────────────────────────────────────────────────────────────
T.H('Trakt yazimi yalniz kapinin icinden');

/** `konum`daki cagri, kapi cagrisinin parantezi ICINDE mi? */
const kapiIcinde = (src, konum) => {
  const kapilar = [...src.slice(0, konum).matchAll(/\b(heryereYaz|ciftYaz)\(/g)];
  const son = kapilar[kapilar.length - 1];
  if (!son) return false;
  let derinlik = 0;
  for (let i = son.index + son[0].length - 1; i < konum; i += 1) {
    if (src[i] === '(') derinlik += 1;
    else if (src[i] === ')') derinlik -= 1;
    if (derinlik === 0) return false;
  }
  return true;
};

const kacak = [];
for (const dosya of KAYNAK) {
  if (dosya.replace(/\\/g, '/').startsWith('services/api/users/')) continue;
  const src = koduAyikla(oku(dosya));
  for (const fn of KAPIDAN_GECMELI) {
    for (const m of src.matchAll(new RegExp(`\\b${fn}\\(`, 'g'))) {
      if (!kapiIcinde(src, m.index)) kacak.push(`${dosya.replace(/\\/g, '/')} -> ${fn}`);
    }
  }
}
T.ok('Kapi disinda Trakt yazimi yok', kacak.length === 0, kacak.join('; '));

const birakma = koduAyikla(oku('services', 'library', 'hiddenOutbox', 'transport.ts'));
T.ok('Birak da kapidan gecer', /await ciftYaz\(/.test(birakma) && birakma.indexOf('workerPost(\'/library/hidden\'') < birakma.indexOf('axios.post(proxy'));

// Denetimin kendisi calisiyor mu? Kapi disi ornek yakalanmali.
const orneKacak = 'async function f(){ await removeFromHistoryTrakt(1, "movie"); }';
const orneIci = 'await heryereYaz(() => a(), () => removeFromHistoryTrakt(1, "movie"));';
const orneSonra = 'await heryereYaz(() => a(), () => b()); await removeFromHistoryTrakt(1, "movie");';
T.ok('Denetim kapi disini yakalar', !kapiIcinde(orneKacak, orneKacak.indexOf('removeFromHistoryTrakt')));
T.ok('Denetim kapi icini kabul eder', kapiIcinde(orneIci, orneIci.indexOf('removeFromHistoryTrakt')));
T.ok('Kapi kapandiktan sonraki cagri kacak sayilir', !kapiIcinde(orneSonra, orneSonra.indexOf('removeFromHistoryTrakt')));

// ──────────────────────────────────────────────────────────────────────────
T.H('Kapinin davranisi (gercek kod)');

const izler = [];
const kapiYukle = (kaymakMi) => tsLoader(KOK, {
  '../../api/library': { kaymakKullanicisiMi: async () => kaymakMi },
  '../../utils/errorLog': { logError: (yer) => izler.push(yer) },
})('services/library/mutations/yazimKapisi.ts');

const sira = [];
const bize = async () => { sira.push('bize'); };
const trakte = async () => { sira.push('trakte'); };
await kapiYukle(false).heryereYaz(bize, trakte);
T.ok('Trakt\'li kullanici: once bize, sonra Trakt', sira.join() === 'bize,trakte', sira.join());

sira.length = 0;
await kapiYukle(true).heryereYaz(bize, trakte);
T.ok('Google-only: yalniz bize', sira.join() === 'bize', sira.join());

sira.length = 0;
let firladi = false;
try {
  await kapiYukle(false).heryereYaz(async () => { throw new Error('supabase'); }, trakte);
} catch { firladi = true; }
T.ok('Bizimki duserse hata cagirana gider, Trakt\'a gidilmez', firladi && sira.length === 0);

izler.length = 0;
await kapiYukle(false).heryereYaz(bize, async () => { throw new Error('trakt kapali'); });
T.ok('Trakt duserse is basarili, iz kalir', izler.includes('kutuphane.ciftYaz.trakt'));

// ──────────────────────────────────────────────────────────────────────────
T.H('Puan yalniz bizde (kullanici karari 2026-11-05)');

const puan = koduAyikla(oku('services', 'library', 'mutations', 'ratings.ts'));
T.ok('ratings.ts Trakt\'a dokunmuyor', !/traktApi|heryereYaz|ciftYaz/.test(puan));
T.ok('Trakt puan uclari kodda yok',
  !KAYNAK.some((d) => /\/sync\/ratings/.test(koduAyikla(oku(d)))), 'sync/ratings bulundu');
T.ok('Emniyet turu puani Trakt\'tan yazmiyor', !/getUserRatings/.test(koduAyikla(oku('services', 'library', 'fetchers.ts'))));

// ──────────────────────────────────────────────────────────────────────────
T.H('Dusen yazim sessiz kalmaz (AI_RULES)');

for (const ekran of [['app', 'show', '[id].tsx'], ['app', 'movie', '[id].tsx']]) {
  const kod = koduAyikla(oku(...ekran));
  const bos = [...kod.matchAll(/=\{\(\) => (toggleWatchlistStatus|toggleFavoriteStatus|deleteMediaFromHistory|toggleHiddenFromProgress)\(/g)];
  T.ok(`${ekran.join('/')}: yazim eylemleri hata gosterir`, bos.length === 0, bos.map((m) => m[1]).join(', '));
}
const filmEkrani = koduAyikla(oku('app', 'movie', '[id].tsx'));
T.ok('Film izledim dugmesi hata gosterir', /handleToggleWatched[\s\S]*?catch \(e\) \{[\s\S]*?notify\(t\('common:error'\)/.test(filmEkrani));

T.bitir();

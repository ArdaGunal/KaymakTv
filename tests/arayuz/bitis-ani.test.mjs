// ==========================================================================
// ARAYUZ — 2.6.8 KUTLAMA-01 + BITIS-01: dizi / film bitis ani
// ==========================================================================
// KUTLAMA-01: Kaymak ilerlemesinde `next_episode` yalniz YAYINLANMIS bolumu
// gosterir; duyurulmus bir sonraki bolum varsa (Yaklasanlar'da) dizi bitmemistir.
// BITIS-01 (kullanici karari 2026-11-06, secenek A): araya pencere girmez. Kart
// listede YERINDE «bitti» gorunumune doner, birkac saniye kalir, sonra kendi
// kategorisine kayar. Renk: yesil «bolum izlendi» anina ait kalir; bitis sakin
// bir mavi (neon / parlak degil). Eski tebrik paneli + konfeti kalkti.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = yardimci.baslat('ARAYUZ BITIS ANI (2.6.8 KUTLAMA-01 + BITIS-01)', { kokOneki: 'arayuz-bitis-' });
const { duyurulmusBolumVarMi } = tsLoader(KOK)('utils/duyurulanBolum.ts');
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');

const GUN = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-06T12:00:00.000Z');
const once = (g) => new Date(now - g * GUN).toISOString();
const sonra = (g) => new Date(now + g * GUN).toISOString();
const var_ = (id, k) => duyurulmusBolumVarMi(id, k, now);

// Haftalik dizi: S1E1-E3 izlendi (yayinlandi), E4 gelecek hafta.
const haftalik = { next_episode: null, seasons: [{ number: 1, episodes: [
  { number: 1, completed: true, first_aired: once(14) },
  { number: 2, completed: true, first_aired: once(7) },
  { number: 3, completed: true, first_aired: once(0.5) },
  { number: 4, completed: false, first_aired: sonra(7) },
] }] };
const bitmis = { next_episode: null, seasons: [{ number: 1, episodes: [
  { number: 1, completed: true, first_aired: once(400) }, { number: 2, completed: true, first_aired: once(393) },
] }] };

T.H('KUTLAMA-01: duyurulmus bolum varken dizi bitmis sayilmaz');
T.ok('haftalik dizi, gelecek hafta bolum var -> DUYURULMUS (bitis yok)', var_(7, { progress: haftalik }) === true);
T.ok('gercekten bitmis dizi -> yok (bitis ani baslar)', var_(7, { progress: bitmis }) === false);
T.ok('yalniz ozel sezonda (0) gelecek bolum -> sayilmaz',
  var_(7, { progress: { seasons: [...bitmis.seasons, { number: 0, episodes: [{ number: 1, completed: false, first_aired: sonra(3) }] }] } }) === false);
T.ok('gelecek bolum izlenmis isaretliyse sayilmaz',
  var_(7, { progress: { seasons: [{ number: 1, episodes: [{ number: 1, completed: true, first_aired: sonra(3) }] }] } }) === false);
T.ok('tarihsiz (TBA) bolum Yaklasanlar\'da yok -> sayilmaz',
  var_(7, { progress: { seasons: [{ number: 2, episodes: [{ number: 1, completed: false, first_aired: null }] }] } }) === false);
T.ok('Trakt sekli: next_episode gelecek tarihli -> duyurulmus',
  var_(7, { progress: { next_episode: { season: 2, number: 1, first_aired: sonra(30) } } }) === true);
T.ok('takvimde (calendarShows) bu dizinin gelecek bolumu -> duyurulmus',
  var_(7, { progress: bitmis, calendarShows: [{ show: { ids: { trakt: 7 } }, first_aired: sonra(40) }] }) === true);
T.ok('takvimde BASKA dizi -> etkilemez',
  var_(7, { progress: bitmis, calendarShows: [{ show: { ids: { trakt: 8 } }, first_aired: sonra(40) }] }) === false);
T.ok('takvimde gecmis kayit -> etkilemez',
  var_(7, { progress: bitmis, calendarShows: [{ show: { ids: { trakt: 7 } }, first_aired: once(1) }] }) === false);
T.ok('emniyet turu sezon haritasi -> duyurulmus',
  var_(7, { progress: bitmis, calendarSeasonsMap: { 7: { data: [{ episodes: [{ first_aired: sonra(9) }] }] } } }) === true);
T.ok('bos/eksik girdi cokertmez -> yok', var_(7, {}) === false && var_(7, { progress: null, calendarShows: null }) === false);

// ── BITIS-01 ──────────────────────────────────────────────────────────────
const { diziBitisOzeti, filmBitisOzeti, sureParcalari, tutulanlariGeriKoy } = tsLoader(KOK)('utils/bitisOzeti.ts');
// Tarihler yerel saatle ogle: takvim gunu hesabi saat dilimine takilmasin.
const ogle = (gunSonra) => new Date(2026, 9, 14 + gunSonra, 12, 0, 0).toISOString();
const izlenmis = (anlar, ozel = []) => ({
  completed: anlar.length, watched_minutes: 555,
  seasons: [
    { number: 1, episodes: anlar.map((a, i) => ({ number: i + 1, completed: true, last_watched_at: a })) },
    ...ozel,
  ],
});

T.H('BITIS-01 ozet: «10 bolum · 9 sa · 6 gunde»');
let o = diziBitisOzeti(izlenmis([ogle(0), ogle(1), ogle(3), ogle(5)]));
T.ok('bolum sayisi completed, sure watched_minutes, 6 takvim gunu', o.bolum === 4 && o.dakika === 555 && o.gun === 6);
o = diziBitisOzeti(izlenmis([ogle(0), ogle(0), ogle(0)]));
T.ok('ayni anda toplu isaretleme -> gun YOK (yalan soylemez)', o.gun === null && o.bolum === 3);
const t0 = Date.parse(ogle(0));
o = diziBitisOzeti(izlenmis([new Date(t0).toISOString(), new Date(t0 + 5 * 60000).toISOString()]));
T.ok('10 dk icinde isaretlenenler toplu sayilir', o.gun === null);
o = diziBitisOzeti(izlenmis([new Date(t0).toISOString(), new Date(t0 + 3 * 3600000).toISOString()]));
T.ok('ayni gun icinde maraton -> «1 gunde»', o.gun === 1);
o = diziBitisOzeti(izlenmis([ogle(0), ogle(2)], [{ number: 0, episodes: [{ number: 1, completed: true, last_watched_at: ogle(-300) }] }]));
T.ok('ozel sezon (0) gun hesabina girmez', o.gun === 3);
o = diziBitisOzeti({ completed: 10, seasons: [] }, 50);
T.ok('watched_minutes yoksa bolum x bolum suresi', o.dakika === 500);
o = diziBitisOzeti({ completed: 10, seasons: [] }, null);
T.ok('sure bilinmiyorsa sure YOK (uydurma yok)', o.dakika === null);
o = diziBitisOzeti(undefined);
T.ok('bos girdi cokertmez', o.bolum === null && o.dakika === null && o.gun === null);
T.ok('film: sure runtime\'dan, bolum/gun yok',
  JSON.stringify(filmBitisOzeti({ runtime: 155 })) === JSON.stringify({ bolum: null, dakika: 155, gun: null }) && filmBitisOzeti(null).dakika === null);
T.ok('sure parcalari: 45 dk / 9 sa 15 dk / 10 sa uzeri dakika atilir',
  JSON.stringify([sureParcalari(45), sureParcalari(555), sureParcalari(650)]) === JSON.stringify([{ sa: 0, dk: 45 }, { sa: 9, dk: 15 }, { sa: 10, dk: 0 }]));

T.H('BITIS-01 film: listeden dusen kayit yerine geri konur');
const kim = (x) => x.id;
const liste = [{ id: 1 }, { id: 3 }];
T.ok('eski sirasina (1) geri konur', JSON.stringify(tutulanlariGeriKoy(liste, [{ id: 2, ham: { id: 2 }, sira: 1 }], kim).map(kim)) === '[1,2,3]');
T.ok('liste zaten iceriyorsa cift eklenmez', tutulanlariGeriKoy([{ id: 2 }], [{ id: 2, ham: { id: 2 }, sira: 0 }], kim).length === 1);
T.ok('tutulan yoksa ayni dizi (gereksiz kopya yok)', tutulanlariGeriKoy(liste, [], kim) === liste);
T.ok('sira tasarsa sona eklenir', JSON.stringify(tutulanlariGeriKoy(liste, [{ id: 9, ham: { id: 9 }, sira: 40 }], kim).map(kim)) === '[1,3,9]');

T.H('BITIS-01 dizi: kart Aktif\'te yerinde kalir');
const { categorizeShows } = tsLoader(KOK)('store/tracking/trackingLogic.ts');
const etiket = { dil: 'tr', unnamedShow: '?', notStarted: 'B', caughtUp: 'G' };
const bitenIlerleme = { aired: 2, completed: 2, next_episode: null, last_episode: { season: 1, number: 2 },
  seasons: [{ number: 1, episodes: [{ number: 1, completed: true, first_aired: once(30) }, { number: 2, completed: true, first_aired: once(23) }] }] };
const kategori = (harita, ekstra = {}) => categorizeShows({ watchedShows: [{ show: { ids: { trakt: 5 }, title: 'D5' }, last_watched_at: once(0.01) }],
  watchlistShows: [], showProgressMap: harita, labels: etiket, now, ...ekstra });
let k = kategori({ 5: bitenIlerleme }, { bitenIds: new Set([5]) });
T.ok('bitis aninda: Aktif\'te, bitti=true, hesaplaniyor degil',
  k.upNext.length === 1 && k.upNext[0].bitti === true && k.upNext[0].isCalculating === false && k.caughtUp.length === 0);
T.ok('yazim teyidi beklenirken de (pending) bitti karti cizilir',
  kategori({ 5: bitenIlerleme }, { bitenIds: new Set([5]), pendingShowIds: [5] }).upNext[0]?.bitti === true);
k = kategori({ 5: bitenIlerleme });
T.ok('sure dolunca: Guncel\'e kayar, Aktif bos', k.upNext.length === 0 && k.caughtUp.length === 1 && !k.caughtUp[0].bitti);
k = kategori({ 5: { ...bitenIlerleme, completed: 1, next_episode: { season: 1, number: 2, first_aired: once(23) } } }, { bitenIds: new Set([5]) });
T.ok('geri alindi (siradaki bolum yine hazir) -> normal kart, bitti yok', k.upNext.length === 1 && !k.upNext[0].bitti && k.upNext[0].readyToWatch);
T.ok('ilerleme kaydi yoksa bitti sayilmaz', !kategori({}, { bitenIds: new Set([5]) }).upNext.some((c) => c.bitti));

T.H('BITIS-01 depo: kendiliginden siler, puanlarken bekler');
const zamanlar = new Map();
let sonZaman = 0;
const sahteSetTimeout = (fn, ms) => { const id = ++sonZaman; zamanlar.set(id, { fn, ms }); return id; };
const sahteClear = (id) => zamanlar.delete(id);
const calistir = () => { const z = [...zamanlar.values()]; zamanlar.clear(); z.forEach((x) => x.fn()); };
let yerlesimAnim = 0;
const kutuphane = { watchlistMovies: [{ movie: { ids: { trakt: 10 } } }, { movie: { ids: { trakt: 11 } } }] };
const sahteZustand = { create: (kur) => {
  let d;
  const set = (p) => { d = { ...d, ...p }; };
  const get = () => d;
  d = kur(set, get);
  const h = (sec) => sec(d);
  h.getState = get;
  return h;
} };
const depo = tsLoader(KOK, {
  zustand: sahteZustand,
  'react-native': { Platform: { OS: 'android' }, UIManager: {}, LayoutAnimation: { Types: {}, Properties: {}, configureNext: () => { yerlesimAnim++; } } },
  './useLibraryStore': { useLibraryStore: { getState: () => kutuphane } },
}, { setTimeout: sahteSetTimeout, clearTimeout: sahteClear })('store/bitisAniStore.ts');
const s = depo.useBitisAniStore.getState;
s().bitir('show', 5);
T.ok('bitir: kayit + tek zamanlayici, sure BITIS_TUTMA_MS',
  !!s().kayitlar['show:5'] && zamanlar.size === 1 && [...zamanlar.values()][0].ms === depo.BITIS_TUTMA_MS);
T.ok('bitenKimlikler turu ayirir', depo.bitenKimlikler(s().kayitlar, 'show').has(5) && depo.bitenKimlikler(s().kayitlar, 'movie').size === 0);
s().duraklat('show', 5);
T.ok('duraklat (puan penceresi): zamanlayici yok, bitis null', zamanlar.size === 0 && s().kayitlar['show:5'].bitis === null);
s().devam('show', 5);
T.ok('devam: kisa sureyle yeniden zamanlanir', zamanlar.size === 1 && [...zamanlar.values()][0].ms === depo.PUAN_SONRASI_MS);
calistir();
T.ok('sure dolunca kayit silinir, cikis animasyonlu', !s().kayitlar['show:5'] && yerlesimAnim === 1);
s().bitir('movie', 11);
T.ok('film: iyimser silmeden ONCE ham kayit + sira saklanir',
  s().kayitlar['movie:11'].sira === 1 && s().kayitlar['movie:11'].ham?.movie?.ids?.trakt === 11
  && JSON.stringify(depo.tutulanFilmler(s().kayitlar).map((x) => [x.id, x.sira])) === '[[11,1]]');
s().birak('movie', 11);
T.ok('birak (yazim hatasi): aninda, animasyonsuz, zamanlayici temiz', !s().kayitlar['movie:11'] && zamanlar.size === 0 && yerlesimAnim === 1);

T.H('BITIS-01 baglanti: pencere yok, tek yol');
const dugme = oku('components/EpisodeCheckButton.tsx');
T.ok('bitis karari duyurulmus bolumu soruyor', /!duyurulmusBolumVarMi\(traktId, \{ progress: newProgress, calendarShows, calendarSeasonsMap \}\)/.test(dugme));
T.ok('kilit ve bitis ani AYNI kararin icinde',
  /duyurulmusBolumVarMi[\s\S]{0,200}setIsFinishedLocal\(true\)[\s\S]{0,80}useBitisAniStore\.getState\(\)\.bitir\('show', traktId\)/.test(dugme));
const filmKanca = oku('hooks/useFilmIzle.ts');
T.ok('film: bitis ani yazimdan ONCE, yazim gecikmesiz, hata -> birak + uyari',
  /bitir\('movie', id\);[\s\S]*await markMovieAsWatched/.test(filmKanca) && !/setTimeout/.test(filmKanca) && /birak\('movie', id\);\s*notify\(/.test(filmKanca));
for (const d of ['components/movies/MovieCardMobile.tsx', 'components/movies/MovieCard.web.tsx']) {
  T.ok(`${d}: ortak kanca, eski gecikmeli yesil akis yok`, /useFilmIzle\(data\)/.test(oku(d)) && !/markMovieAsWatched|SUCCESS_HOLD_MS|setTimeout|successOverlay|checkButtonSuccess/.test(oku(d)));
}
const KARTLAR = { 'components/EpisodeCardMobile.tsx': 'show', 'components/tracking/ShowTrackCardWeb.tsx': 'show',
  'components/movies/MovieCardMobile.tsx': 'movie', 'components/movies/MovieCard.web.tsx': 'movie' };
for (const [d, tur] of Object.entries(KARTLAR)) {
  T.ok(`${d}: data.bitti -> <BitisIcerigi tur="${tur}">`, new RegExp(`<BitisIcerigi tur="${tur}"`).test(oku(d)) && /data\.bitti/.test(oku(d)));
}
const tara = (dizin, cikti = []) => {
  for (const ad of fs.readdirSync(path.join(KOK, dizin))) {
    const yol = `${dizin}/${ad}`;
    if (fs.statSync(path.join(KOK, yol)).isDirectory()) tara(yol, cikti);
    else if (/\.tsx?$/.test(ad)) cikti.push(yol);
  }
  return cikti;
};
const kalanlar = ['app', 'components', 'screens', 'hooks', 'store', 'features'].flatMap((d) => tara(d))
  .filter((d) => /onShowFinished|onMovieFinished|CelebrationOverlay|ConfettiCannon|t\('congrats'\)/.test(oku(d)));
T.ok(`eski panel / konfeti / geri cagri zinciri kodda yok (${kalanlar.length})`, kalanlar.length === 0);
for (const d of kalanlar) T.ok(`kalinti: ${d}`, false);
T.ok('CelebrationOverlay dosyasi silindi', !fs.existsSync(path.join(KOK, 'components/index/CelebrationOverlay.tsx')));
T.ok('konfeti paketi bagimliliklardan cikti', !/react-native-confetti-cannon/.test(oku('package.json')));

// Emu (2026-11-06): izleme listesindeki film kaydi suresiz geliyor; sure izlenen
// film kaydinda (/library/sync, yazimdan ~3 sn sonra). Ozet ikisine de bakar.
T.ok('film suresi izlenen film kaydindan da okunur', /s\.watchedMovies\.find\([\s\S]{0,80}movie\?\.runtime/.test(oku('hooks/useBitisAni.ts'))
  && /filmBitisOzeti\(\{ runtime: filmSuresi \?\? film\?\.runtime \}\)/.test(oku('hooks/useBitisAni.ts')));

T.H('BITIS-01 renk: sakin mavi, yesil degil, neon degil');
const icerik = oku('components/tracking/BitisIcerigi.tsx');
const renkler = [...icerik.matchAll(/(zemin|kenar|vurgu|metin|soluk|dugme): '#([0-9A-Fa-f]{6})'/g)].map((m) => m[2]);
const hsl = (hex) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const doy = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === b ? (r - g) / d + 4 : (b - r) / d + 2;
  return { h: (h * 60 + 360) % 360, s: doy };
};
T.ok('6 renk tanimli', renkler.length === 6);
T.ok('hepsi mavi tonda (195-230 derece)', renkler.every((x) => { const { h } = hsl(x); return h >= 195 && h <= 230; }));
T.ok('neon / parlak degil (doygunluk < %60)', renkler.every((x) => hsl(x).s < 0.6));
T.ok('karttaki yesil «bolum izlendi» rengi bitiste kullanilmiyor', !/#10b981|#064e3b|#6ee7b7/i.test(icerik));

T.H('BITIS-01 metinler TR + EN');
const tr = JSON.parse(oku('locales/tr/media.json'));
const en = JSON.parse(oku('locales/en/media.json'));
T.ok('baslik + sure anahtarlari iki dilde', ['bitisDizi', 'bitisFilm', 'bitisSaat', 'bitisSaatDakika', 'bitisDakika'].every((x) => tr[x] && en[x]));
T.ok('sayili anahtarlar: TR tekil, EN _one/_other, {{count}}',
  ['bitisBolum', 'bitisGun'].every((x) => /\{\{count\}\}/.test(tr[x]) && /\{\{count\}\}/.test(en[`${x}_one`]) && /\{\{count\}\}/.test(en[`${x}_other`])));
T.ok('eski panel anahtarlari iki dilden silindi', ['congrats', 'movieFinished', 'showFinishedLine', 'showFinished'].every((x) => !(x in tr) && !(x in en)));

T.bitir();

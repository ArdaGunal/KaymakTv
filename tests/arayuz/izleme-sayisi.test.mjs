// ==========================================================================
// ARAYUZ — 1.0.1 DAL 4: IZLEME SAYISI, TEKRAR, GERI ALMA, AYLIK GRAFIK
// ==========================================================================
// Plan: docs/design/ISIM_TEKRAR_ANALIZ_PLANI.md §3 Dal 4 · kabul §4 #1–#7.
// Sunucu (081/082) `plays`, `play_minutes`, `rewatch_plays` ve ay ay ozet veriyor; burada
// istemcinin onlari dogru okudugu, iyimser yamalarin IKI KEZ saymadigi ve yuzeylerin baglandigi
// sinanir. Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';
import { bolumIzlemeSayisi, ilerlemedenBolumSayisi, filmIzlemeSayisi, izlemeRozeti, izlendiMetni, izlemeKaldiMi } from '../../utils/izlemeSayisi.ts';
import { bolumleriIsaretle, bolumleriGeriAl, sonIzlemeyiGeriAl, sezonunIsaretlenecekleri } from '../../services/library/mutations/optimistikIlerleme.ts';
import { izlenenFilmeEkle, filmIzlemesiniGeriAl } from '../../services/library/mutations/optimistikFilm.ts';
import { yerelIstatistik, gosterilecekIstatistik } from '../../utils/yerelIstatistik.ts';
import { aylikCubuklar } from '../../utils/aylikCubuklar.ts';

const { baslat } = yardimci;
const T = baslat('ARAYUZ IZLEME SAYISI (1.0.1 DAL 4)', { kokOneki: 'arayuz-izleme-' });
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const oku = (...p) => fs.readFileSync(path.join(KOK, ...p), 'utf8');

const D1 = '2026-01-10T10:00:00.000Z';
const D2 = '2026-11-03T10:00:00.000Z';
const D3 = '2026-11-04T10:00:00.000Z';
const ilerleme = (bolumler, ek = {}) => ({
  aired: 2, completed: bolumler.filter((b) => b.completed).length, rewatch_plays: 0, ...ek,
  seasons: [{ number: 1, episodes: bolumler }],
});
const bol = (number, plays, son = null) => ({
  number, completed: plays > 0, plays, last_watched_at: son, first_aired: '2023-01-01T00:00:00Z',
});

// ─────────────────────────────────────────────────────────────────────────
T.H('Okuma: izleme sayisi ve rozet');
T.ok('izlenmemis bolum 0', bolumIzlemeSayisi({ completed: false, plays: 0 }) === 0);
T.ok('081 oncesi veri (plays yok) izlenmisse 1 — rozet cikmaz', bolumIzlemeSayisi({ completed: true }) === 1);
T.ok('plays 3 → 3', ilerlemedenBolumSayisi(ilerleme([bol(1, 3, D3)]), 1, 1) === 3);
T.ok('rozet: 1 → yok, 2 → 2x, 3 → 3x', izlemeRozeti(1) === null && izlemeRozeti(2) === '2x' && izlemeRozeti(3) === '3x');
T.ok('izlendi metni: 3 → "Izlendi · 3x", 1 → aynen', izlendiMetni('Izlendi', 3) === 'Izlendi · 3x' && izlendiMetni('Izlendi', 1) === 'Izlendi');
T.ok('film: listede yoksa 0, plays yoksa 1, plays 3 → 3',
  filmIzlemeSayisi([], 5) === 0 && filmIzlemeSayisi([{ movie: { ids: { trakt: 5 } } }], 5) === 1
  && filmIzlemeSayisi([{ plays: 3, movie: { ids: { trakt: 5 } } }], 5) === 3);

// ─────────────────────────────────────────────────────────────────────────
T.H('Iyimser isaretleme: tekrar sayisi damgaya bagli (kabul #1, #6, #11)');
const ilk = bolumleriIsaretle(ilerleme([bol(1, 0), bol(2, 0)]), 1, [1], D1);
T.ok('ilk izleme: plays 1, tekrar 0', ilk.seasons[0].episodes[0].plays === 1 && ilk.rewatch_plays === 0);
const ikinci = bolumleriIsaretle(ilk, 1, [1], D2);
const ucuncu = bolumleriIsaretle(ikinci, 1, [1], D3);
T.ok('kabul #1: ayni bolum 3 kez → 3x, 2 ek tekrar, tekil bolum 1',
  ucuncu.seasons[0].episodes[0].plays === 3 && ucuncu.rewatch_plays === 2 && ucuncu.completed === 1,
  JSON.stringify({ p: ucuncu.seasons[0].episodes[0].plays, r: ucuncu.rewatch_plays, c: ucuncu.completed }));
// Outbox projeksiyonu: sunucu D3 izlemesini zaten iceren veriyi dondurdu, ayni is yeniden yansitiliyor.
const sunucu = ilerleme([bol(1, 3, D3), bol(2, 0)], { rewatch_plays: 2 });
const yansitilan = bolumleriIsaretle(sunucu, 1, [1], D3);
T.ok('🔴 kabul #6: ayni is (ayni damga) yeniden yansitilinca sayi ARTMAZ',
  yansitilan.seasons[0].episodes[0].plays === 3 && yansitilan.rewatch_plays === 2);
T.ok('daha ESKI damgali is de sayiyi artirmaz (sunucu daha yenisini iceriyor)',
  bolumleriIsaretle(sunucu, 1, [1], D1).seasons[0].episodes[0].plays === 3);

// ─────────────────────────────────────────────────────────────────────────
T.H('Iyimser geri alma (kabul #4, #5)');
const son = sonIzlemeyiGeriAl(sunucu, 1, 1);
T.ok('kabul #4: son izleme geri alindi → 3x → 2x, tik kalir, tekrar 2 → 1',
  son.seasons[0].episodes[0].plays === 2 && son.seasons[0].episodes[0].completed && son.rewatch_plays === 1);
const tekIzleme = sonIzlemeyiGeriAl(ilerleme([bol(1, 1, D1), bol(2, 0)]), 1, 1);
T.ok('tek izlemede son geri alma = tik kalkar', tekIzleme.seasons[0].episodes[0].completed === false && tekIzleme.completed === 0);
const hepsi = bolumleriGeriAl(sunucu, 1, [1]);
T.ok('kabul #5: tum izlemeler silindi → tik kalkar, plays 0, tekrar katkisi da duser',
  hepsi.seasons[0].episodes[0].completed === false && hepsi.seasons[0].episodes[0].plays === 0 && hepsi.rewatch_plays === 0);
T.ok('izlenmis bolum kalmadiysa dizi listeden duser (izlemeKaldiMi)', !izlemeKaldiMi(hepsi) && izlemeKaldiMi(sunucu));
T.ok('sezon 0 izlemesi de "izleme kaldi" sayilir',
  izlemeKaldiMi({ seasons: [{ number: 0, episodes: [{ completed: true }] }, { number: 1, episodes: [{ completed: false }] }] }));

// ─────────────────────────────────────────────────────────────────────────
T.H('Film: tekrar ve son izlemeyi geri al (kabul #2)');
const FILM = { ids: { trakt: 7 }, title: 'F' };
let liste = izlenenFilmeEkle([], 7, FILM, D1);
liste = izlenenFilmeEkle(liste, 7, FILM, D2);
liste = izlenenFilmeEkle(liste, 7, FILM, D3);
T.ok('kabul #2: film 3 kez → plays 3', liste[0].plays === 3);
T.ok('ayni is yeniden yansitilinca 3 kalir', izlenenFilmeEkle(liste, 7, FILM, D3)[0].plays === 3);
const filmSon = filmIzlemesiniGeriAl(liste, 7);
T.ok('son izleme geri → 2, film listede kalir', filmSon.length === 1 && filmSon[0].plays === 2);
T.ok('tek izlemede geri → film listeden duser', filmIzlemesiniGeriAl([{ plays: 1, movie: FILM }], 7).length === 0);

// ─────────────────────────────────────────────────────────────────────────
T.H('Istatistik: sure her izleme, sayim tekil, tekrar ozeti (kabul #1, #2, #7)');
const dizi = (traktId, runtime) => ({ show: { ids: { trakt: traktId }, runtime } });
const ist = yerelIstatistik([dizi(1, 40)], [{ plays: 3, movie: { runtime: 120 } }], {
  1: { completed: 1, watched_minutes: 40, play_minutes: 120, rewatch_plays: 2 },
});
T.ok('kabul #1: 40 dk × 3 → 120 dk, 1 tekil bolum, 2 tekrar',
  ist.episodes.minutes === 120 && ist.episodes.watched === 1 && ist.episodes.rewatches === 2, JSON.stringify(ist.episodes));
T.ok('kabul #2: 120 dk film × 3 → 360 dk, 1 tekil film, 2 tekrar',
  ist.movies.minutes === 360 && ist.movies.watched === 1 && ist.movies.rewatches === 2, JSON.stringify(ist.movies));
T.ok('081 oncesi sunucu (play_minutes yok) → watched_minutes kullanilir',
  yerelIstatistik([dizi(1, 40)], [], { 1: { completed: 2, watched_minutes: 85 } }).episodes.minutes === 85);
T.ok('play_minutes 0 gelirse 0 (eski alana DUSULMEZ: sunucu "sure bilinmiyor" diyor)',
  yerelIstatistik([dizi(1, 40)], [], { 1: { completed: 1, watched_minutes: 40, play_minutes: 0 } }).episodes.minutes === 0);
T.ok('yalniz ozel bolum (sezon 0) izlenen dizi sureye girer, tekil sayima girmez',
  (() => { const x = yerelIstatistik([dizi(1, 40)], [], { 1: { completed: 0, play_minutes: 15 } }); return x.episodes.minutes === 15 && x.episodes.watched === 0; })());
T.ok('kabul #7: kutuphane bosaldi → null (eski Trakt istatistigi geri gelmez)',
  gosterilecekIstatistik(yerelIstatistik([], [], {})) === null);

// ─────────────────────────────────────────────────────────────────────────
T.H('Aylik grafik: her izleme kendi ayinda (kabul #3)');
const simdi = new Date(2026, 10, 15);
const satirlar = [
  { donem: '2026-01', tur: 'movie', izleme: 1 },
  { donem: '2026-11', tur: 'movie', izleme: 1 },
  { donem: '2026-11', tur: 'episode', izleme: 2 },
  { donem: '2026-09', tur: 'episode', izleme: 4 },
  { donem: '2025-12', tur: 'episode', izleme: 9 },
];
const filmAy = aylikCubuklar(satirlar, 'movie', 12, 'tr-TR', simdi);
T.ok('kabul #3: film ocak ve kasimda ayri cubuklarda',
  filmAy.find((c) => c.key === '2026-01').value === 1 && filmAy.find((c) => c.key === '2026-11').value === 1);
const diziAy = aylikCubuklar(satirlar, 'episode', 6, 'tr-TR', simdi);
T.ok('son 6 ay iskeleti: 6 cubuk, haziran → kasim', diziAy.length === 6 && diziAy[0].key === '2026-06' && diziAy[5].key === '2026-11');
T.ok('tur ayrilir ve pencere disi ay sayilmaz', diziAy.find((c) => c.key === '2026-11').value === 2
  && diziAy.find((c) => c.key === '2026-09').value === 4 && diziAy.reduce((t, c) => t + c.value, 0) === 6);
T.ok('bos/bozuk girdi coker degil', aylikCubuklar(null, 'episode', 6, 'tr-TR', simdi).every((c) => c.value === 0));

// ─────────────────────────────────────────────────────────────────────────
T.H('Sezon isaretleme izlenmis bolume sahte tekrar yazmaz (1.0.1 Dal 5)');
{
  // Yarim izlenmis sezon: E1 izlendi (1x), E2 izlenmedi, E3 henuz yayinlanmadi.
  const W = '2026-11-16T09:00:00.000Z';
  const yarim = ilerleme([bol(1, 1, D2), bol(2, 0), { number: 3, completed: false, plays: 0, first_aired: '2099-01-01T00:00:00Z' }]);
  T.ok('duz isaretleme: yalniz yayinlanmis IZLENMEMIS bolum (E2)', JSON.stringify(sezonunIsaretlenecekleri(yarim, 1, W, false)) === '[2]');
  T.ok('Tekrar Izle: butun yayinlanmis bolumler (E1, E2), gelecek bolum yok', JSON.stringify(sezonunIsaretlenecekleri(yarim, 1, W, true)) === '[1,2]');
  T.ok('sezon yerelde bilinmiyor → null (cagiran sezon duzeyi istek atar)', sezonunIsaretlenecekleri(yarim, 5, W, false) === null);
  const bitti = ilerleme([bol(1, 2, D2), bol(2, 1, D2)]);
  T.ok('sezon zaten bitmis → bos liste (yazilacak bir sey yok)', JSON.stringify(sezonunIsaretlenecekleri(bitti, 1, W, false)) === '[]');
  // Gercek zincir: projeksiyon + mutasyon ayni acik listeyle → izlenmis E1 hic artmaz.
  const once = bolumleriIsaretle(yarim, 1, sezonunIsaretlenecekleri(yarim, 1, W, false), W);
  const sonra = bolumleriIsaretle(once, 1, [2], W);
  const e = (x, n) => x.seasons[0].episodes.find((b) => b.number === n);
  T.ok('E1 1x kalir (eskiden 2x olurdu), E2 1x, ek tekrar 0',
    e(sonra, 1).plays === 1 && e(sonra, 2).plays === 1 && (sonra.rewatch_plays ?? 0) === 0, JSON.stringify(sonra.seasons[0].episodes));
}

// ─────────────────────────────────────────────────────────────────────────
T.H('Kaynak denetimi: yuzeyler baglandi mi');
T.ok('optimistikIlerleme kopyasi utils/izlemeSayisi kuraliyla AYNI',
  (() => {
    const u = oku('utils', 'izlemeSayisi.ts');
    const govde = (src, bas) => { const i = src.indexOf(bas); return src.slice(src.indexOf('{', src.indexOf('=>', i)), src.indexOf('};', i)).replace(/\s+/g, ' '); };
    return govde(u, 'export const bolumIzlemeSayisi') === govde(oku('services', 'library', 'mutations', 'optimistikIlerleme.ts'), 'const bolumIzlemeSayisi');
  })());
const sezon = oku('components', 'SeasonAccordion.tsx');
T.ok('sezon satiri rozeti ve erisilebilirlik metnini ciziyor', /izlemeRozeti\(ep\.playCount/.test(sezon) && /playCountA11y/.test(sezon));
const pencere = oku('components', 'modals', 'EpisodeOptionsModal.tsx');
T.ok('bolum secenekleri: 2+ izlemede "son izlemeyi geri al" + "tumunu kaldir"',
  /cokluIzleme && \(/.test(pencere) && /unwatchLastPlay/.test(pencere) && /unwatchAllPlays/.test(pencere));
const isleyici = oku('hooks', 'useShowDetailHandlers.ts');
T.ok('dizi sayfasi "tumunu kaldir" 2+ izlemede ONAY istiyor', /tumunuKaldirOnayi\(t, selectedEpisode\.playCount/.test(isleyici));
T.ok('bolum detayi ve film detayi secimi ortak yardimcidan soruyor',
  /geriAlmaSor\(t, playCount\)/.test(oku('hooks', 'useEpisodeActions.ts')) && /geriAlmaSor\(t, playCount\)/.test(oku('app', 'movie', '[id].tsx')));
const sonIz = oku('services', 'library', 'mutations', 'sonIzleme.ts');
T.ok('son izleme silmede damgayi SUNUCU buluyor (sonuncu: true)', /sonuncu: true/.test(oku('services', 'api', 'library.ts')) && !/watchedAt/.test(sonIz.split('\n').filter((l) => /libraryApi\./.test(l)).join('')));
T.ok('analiz eski Trakt userStats okumuyor', !/userStats/.test(oku('hooks', 'useProfileStatistics.ts').replace(/\/\/.*$/gm, '')));
T.ok('aylik grafik sunucu ozetinden (useIzlemeDonemleri)', /useIzlemeDonemleri\(MONTHS_BACK\)/.test(oku('hooks', 'useProfileStatistics.ts')));

{
  // 1.0.1 Dal 5 · sezon yazimi: duz isaretleme izlenmemislere, Tekrar Izle hepsine; olu kopya yok.
  const prog = oku('services', 'library', 'mutations', 'progress.ts');
  T.ok('markSeasonAsWatched tekrar=false, rewatchSeason tekrar=true',
    /markSeasonAsWatched = async[^\n]*\n\s*sezonuYaz\(showId, season, false,/.test(prog) && /rewatchSeason = async[^\n]*\n\s*sezonuYaz\(showId, season, true,/.test(prog));
  T.ok('bitmis sezonda yeni satir yazilmaz (erken donus)', /if \(!tekrar && episodes && episodes\.length === 0\) return mevcutIlerleme\(showId\);/.test(prog));
  const handlers = oku('hooks', 'useShowDetailHandlers.ts');
  T.ok('olu handleMarkSeason / seasonLoading kalmadi', !/handleMarkSeason|seasonLoading|markSeasonAsWatched/.test(handlers));
}

T.bitir();

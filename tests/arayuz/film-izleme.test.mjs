// ==========================================================================
// ARAYUZ — M417: film "izledim" ekranda gorunsun
// ==========================================================================
// Kullanici (cihazda): "filmlerde izledim isaretlenmiyor."
// Kok: iyimser girdi YALNIZCA film izleme listesindeyken ekleniyordu; hicbir
// listede olmayan film isaretlenince `watchedMovies` degismiyor, detay
// sayfasindaki «Izlendi» rozeti (watchedMovies.some) hic yesile donmuyordu.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';
import { izlenenFilmeEkle } from '../../services/library/mutations/optimistikFilm.ts';

const { baslat } = yardimci;
const T = baslat('ARAYUZ FILM IZLEME (M417)', { kokOneki: 'arayuz-film-' });
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const FILM = { ids: { trakt: 42, tmdb: 7 }, title: 'Test Filmi' };
const AN = '2026-09-20T03:00:00.000Z';

// ─────────────────────────────────────────────────────────────────────────
T.H('Eklenen girdi');
const bos = izlenenFilmeEkle([], 42, FILM, AN);
T.ok('Bos listeye eklenir', bos.length === 1 && bos[0].movie.ids.trakt === 42);
T.ok('Girdi bicimi: plays + last_watched_at + movie',
  bos[0].plays === 1 && bos[0].last_watched_at === AN && bos[0].movie.title === 'Test Filmi',
  JSON.stringify(bos[0]));
T.ok('En basa eklenir (en son izlenen ustte)',
  izlenenFilmeEkle([{ movie: { ids: { trakt: 9 } } }], 42, FILM, AN)[0].movie.ids.trakt === 42);

// ─────────────────────────────────────────────────────────────────────────
T.H('Tekrar izleme (1.0.1 Dal 4) — sayi damgaya bagli');
const mevcut = [{ plays: 3, last_watched_at: '2026-09-01T00:00:00.000Z', movie: { ids: { trakt: 42 }, title: 'Zaten var' } }];
const tekrar = izlenenFilmeEkle(mevcut, 42, FILM, AN);
T.ok('Zaten izlenmis + YENI damga → plays 3 → 4, son damga guncellenir',
  tekrar !== mevcut && tekrar[0].plays === 4 && tekrar[0].last_watched_at === AN, JSON.stringify(tekrar[0]));
T.ok('🔴 Ayni is yeniden yansitilinca IKI KEZ sayilmaz (sunucu zaten iceriyor: son damga >= is damgasi)',
  izlenenFilmeEkle(tekrar, 42, FILM, AN) === tekrar);

// ─────────────────────────────────────────────────────────────────────────
T.H('Dokunmadigi durumlar (ayni referans doner)');
T.ok('Film verisi yoksa DEGISTIRMEZ (uydurma kart cizilmez)',
  izlenenFilmeEkle([], 42, null, AN).length === 0
  && izlenenFilmeEkle([], 42, undefined, AN).length === 0);
T.ok('Kimlik uyusmuyorsa DEGISTIRMEZ (yanlis film eklenmesin)',
  izlenenFilmeEkle([], 42, { ids: { trakt: 43 }, title: 'Baska' }, AN).length === 0);
T.ok('Kimliksiz film DEGISTIRMEZ', izlenenFilmeEkle([], 42, { title: 'Kimliksiz' }, AN).length === 0);
T.ok('Gecersiz filmId DEGISTIRMEZ', izlenenFilmeEkle([], NaN, FILM, AN).length === 0);
T.ok('prev null/undefined ise bos listeyle calisir',
  Array.isArray(izlenenFilmeEkle(null, 42, FILM, AN)) && izlenenFilmeEkle(undefined, 42, FILM, AN).length === 1);

// ─────────────────────────────────────────────────────────────────────────
T.H('Kaynak denetimi: cagri zinciri baglandi mi');
const prog = fs.readFileSync(path.join(KOK, 'services', 'library', 'mutations', 'progress.ts'), 'utf8');
// 🔴 Damga İŞİN damgası olmalı: kuyruk projeksiyonu izlemeyi W ile zaten saydı; ayrı `new Date()`
// W'den yeni olduğu için tekrar izleme iki kez sayılıyordu (1x → 3x, emülatör 2026-11-16).
T.ok('progress.ts ortak karari ISIN DAMGASIYLA kullaniyor (tekrar izleme iki kez sayilmaz)',
  /izlenenFilmeEkle\(prev, movieId, movieItemToMove\?\.movie \|\| mediaData, watchedAt\)/.test(prog));
{
  // Gerçek sıra: önce projeksiyon (W), sonra mutasyonun kendi yaması — aynı W ile sayı bir kez artar.
  const W = '2026-11-16T10:42:40.000Z';
  const bir = [{ plays: 1, last_watched_at: '2026-10-01T00:00:00.000Z', movie: { ids: { trakt: 7 } } }];
  const yansitilan = izlenenFilmeEkle(bir, 7, null, W);
  T.ok('projeksiyon + mutasyon ayni damgayla → 2x (3x degil)', izlenenFilmeEkle(yansitilan, 7, null, W)[0].plays === 2);
}
T.ok('Eski "yalnizca listede varsa ekle" kosulu KALMADI',
  !/if \(!exists && movieItemToMove\)/.test(prog));
T.ok('markMovieAsWatched ikinci parametreyi aliyor',
  /markMovieAsWatched = async \(movieId: number, mediaData\?: any\)/.test(prog));
const detay = fs.readFileSync(path.join(KOK, 'app', 'movie', '[id].tsx'), 'utf8');
const cagri = (detay.match(/markMovieAsWatched\(traktIdNum, movieData\)/g) || []).length;
T.ok('Film detayinin IKI cagrisi da filmi geciyor (isaretle + tekrar izle)', cagri === 2, `${cagri} cagri`);
// 1.0.1 Dal 4: rozet izleme SAYISINDAN türer (`filmIzlemeSayisi`), kaynak yine `watchedMovies`.
T.ok('Rozet watchedMovies okuyor (kusurun gorundugu yer)',
  /filmIzlemeSayisi\(watchedMovies, traktIdNum\)/.test(detay) && /const isWatched = playCount > 0;/.test(detay));

T.bitir();

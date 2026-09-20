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
T.H('Dokunmadigi durumlar (ayni referans doner)');
const mevcut = [{ plays: 3, movie: { ids: { trakt: 42 }, title: 'Zaten var' } }];
T.ok('Zaten izlenmisse DEGISTIRMEZ (plays sayaci sunucunun isi)',
  izlenenFilmeEkle(mevcut, 42, FILM, AN) === mevcut);
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
T.ok('progress.ts ortak karari kullaniyor',
  /izlenenFilmeEkle\(prev, movieId, movieItemToMove\?\.movie \|\| mediaData\)/.test(prog));
T.ok('Eski "yalnizca listede varsa ekle" kosulu KALMADI',
  !/if \(!exists && movieItemToMove\)/.test(prog));
T.ok('markMovieAsWatched ikinci parametreyi aliyor',
  /markMovieAsWatched = async \(movieId: number, mediaData\?: any\)/.test(prog));
const detay = fs.readFileSync(path.join(KOK, 'app', 'movie', '[id].tsx'), 'utf8');
const cagri = (detay.match(/markMovieAsWatched\(traktIdNum, movieData\)/g) || []).length;
T.ok('Film detayinin IKI cagrisi da filmi geciyor (isaretle + tekrar izle)', cagri === 2, `${cagri} cagri`);
T.ok('Rozet watchedMovies okuyor (kusurun gorundugu yer)',
  /watchedMovies\?\.some\(\(m: any\) => m\.movie\?\.ids\?\.trakt === traktIdNum\)/.test(detay));

T.bitir();

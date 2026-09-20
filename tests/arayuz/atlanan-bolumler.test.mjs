// ==========================================================================
// ARAYUZ — M418/M419: "oncekileri de isaretle" hesabi + kaynak denetimleri
// ==========================================================================
// 🔴 CANLI HATA: dizi 21020'nin 5. sezonunda Trakt'ta yalnizca 19-21 numarali
// bolumler var. Kullanici S5E19'a basti; istemci `1..18` dongusuyle OLMAYAN
// 18 bolumu isaretlemeye calisti, Worker `kismi` dondu ve hata Discord'a
// dustu. Hesap artik SEZON LISTESINDEN yapiliyor.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';
import { atlananBolumler } from '../../utils/atlananBolumler.ts';

const { baslat } = yardimci;
const T = baslat('ARAYUZ ATLANAN BOLUMLER (M418)', { kokOneki: 'arayuz-atlanan-' });
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const b = (number, completed = false) => ({ number, completed });
// Canli vaka: S5 = 19,20,21
const GERCEK = { seasons: [{ number: 5, episodes: [b(19), b(20), b(21)] }] };
const DUZ = { seasons: [{ number: 1, episodes: [b(1, true), b(2), b(3, true), b(4), b(5)] }] };

// ─────────────────────────────────────────────────────────────────────────
T.H('Canli vaka: numaralar 1 den baslamiyor');
T.ok('S5E19 -> atlanan YOK (1-18 UYDURULMAZ)',
  JSON.stringify(atlananBolumler(GERCEK, 5, 19)) === '[]');
T.ok('S5E21 -> yalnizca 19,20',
  JSON.stringify(atlananBolumler(GERCEK, 5, 21)) === '[19,20]');

// ─────────────────────────────────────────────────────────────────────────
T.H('Olagan sezon');
T.ok('E5 -> izlenmemis 2 ve 4', JSON.stringify(atlananBolumler(DUZ, 1, 5)) === '[2,4]');
T.ok('E1 -> oncesi yok', JSON.stringify(atlananBolumler(DUZ, 1, 1)) === '[]');
T.ok('Artan sirada doner',
  JSON.stringify(atlananBolumler({ seasons: [{ number: 1, episodes: [b(3), b(1), b(2)] }] }, 1, 4)) === '[1,2,3]');

// ─────────────────────────────────────────────────────────────────────────
T.H('Bilinmiyorsa UYDURMA YOK');
T.ok('Ilerleme yok -> bos', JSON.stringify(atlananBolumler(null, 1, 5)) === '[]'
  && JSON.stringify(atlananBolumler(undefined, 1, 5)) === '[]');
T.ok('Sezon listede yok -> bos', JSON.stringify(atlananBolumler(DUZ, 9, 5)) === '[]');
T.ok('Sezonun bolum listesi bos/yok -> bos',
  JSON.stringify(atlananBolumler({ seasons: [{ number: 1, episodes: [] }] }, 1, 5)) === '[]'
  && JSON.stringify(atlananBolumler({ seasons: [{ number: 1 }] }, 1, 5)) === '[]');

// ─────────────────────────────────────────────────────────────────────────
T.H('M420 — ekranin bolum listesi verilince ILERLEME BEKLENMEZ');
// Kullanici: "arka arkaya 1-2 sn icinde isaretlersem soru sorulmuyor."
// Kok: yeni dizide ilerleme kaydi ilk isaretlemeden 2-3 sn SONRA geliyor;
// o pencerede sezon "bolumsuz" gorunuyordu.
T.ok('Ilerleme YOKKEN ekran listesiyle atlananlar bulunur',
  JSON.stringify(atlananBolumler(null, 1, 5, [1, 2, 3, 4, 5])) === '[1,2,3,4]');
T.ok('Ilerleme YARIM (yalniz E1 izlendi) + ekran listesi -> 2,3,4',
  JSON.stringify(atlananBolumler(
    { seasons: [{ number: 1, episodes: [b(1, true)] }] }, 1, 5, [1, 2, 3, 4, 5])) === '[2,3,4]');
T.ok('Ekran listesi bosluklu olsa da UYDURMA YOK (canli vaka)',
  JSON.stringify(atlananBolumler(null, 5, 21, [19, 20, 21])) === '[19,20]');
T.ok('Ekran listesi bos/verilmemisse eski davranis (ilerlemeye bakar)',
  JSON.stringify(atlananBolumler(DUZ, 1, 5, [])) === '[2,4]'
  && JSON.stringify(atlananBolumler(DUZ, 1, 5)) === '[2,4]');
T.ok('Izlenmisler (1 ve 3) ekran listesinden de elenir',
  JSON.stringify(atlananBolumler(DUZ, 1, 6, [1, 2, 3, 4, 5])) === '[2,4,5]');

// ─────────────────────────────────────────────────────────────────────────
T.H('Kaynak denetimi: iki cagri yerinde de dongu KALMADI');
const dugme = fs.readFileSync(path.join(KOK, 'components', 'EpisodeCheckButton.tsx'), 'utf8');
const kanca = fs.readFileSync(path.join(KOK, 'hooks', 'useEpisodeActions.ts'), 'utf8');
T.ok('EpisodeCheckButton ortak hesabi kullaniyor', /atlananBolumler\(progress, season, episode, sezonBolumleri\)/.test(dugme));
T.ok('useEpisodeActions ortak hesabi kullaniyor', /atlananBolumler\(showProgressMap\[showTraktId\], sNum, eNum\)/.test(kanca));
const akordiyon = fs.readFileSync(path.join(KOK, 'components', 'SeasonAccordion.tsx'), 'utf8');
T.ok('SeasonAccordion YAYINLANMIS bolum listesini geciriyor',
  /sezonBolumleri=\{yayinlanmisNumaralar\}/.test(akordiyon)
  && /isEpisodeAired\(ep, season\.aired_episodes \|\| 0\)/.test(akordiyon));
T.ok('Dugme listeyi hesaba geciriyor',
  /atlananBolumler\(progress, season, episode, sezonBolumleri\)/.test(dugme));
T.ok('Elle yazilmis 1..N-1 dongusu iki dosyada da YOK',
  !/for \(let i = 1; i < (episode|eNum); i\+\+\)/.test(dugme + kanca));

// ─────────────────────────────────────────────────────────────────────────
T.H('M419 kaynak denetimleri');
T.ok('Null ilerleme "dizi bitti" SAYILMIYOR', /if \(newProgress && !newProgress\.next_episode\)/.test(dugme));
T.ok('Diyalog dalinda kilit acik kaliyor', /performCheckIn = async \(isBulk: boolean, eps: number\[\]\) => \{\s*\n\s*setIsCheckLoading\(true\);/.test(kanca));
const kesfet = fs.readFileSync(path.join(KOK, 'hooks', 'useExplore.ts'), 'utf8');
T.ok('Arama yolunda refreshing kapaniyor',
  (kesfet.match(/setRefreshing\(false\)/g) || []).length >= 2);
const kart = fs.readFileSync(path.join(KOK, 'components', 'ShowCard.tsx'), 'utf8');
const izgara = fs.readFileSync(path.join(KOK, 'components', 'explore', 'ExploreWebGrid.tsx'), 'utf8');
T.ok('Iki "+" dugmesinde de misafir kapisi var',
  /isGuest/.test(kart) && /isGuest/.test(izgara));
T.ok('Web ikizi artik await + catch + busyRef',
  /await toggleWatchlistStatus/.test(izgara) && /busyRef/.test(izgara) && /catch \(error\)/.test(izgara));
const mut = fs.readFileSync(path.join(KOK, 'services', 'library', 'mutations', 'progress.ts'), 'utf8');
T.ok('Bes geri alma yolu da nesil korumali',
  (mut.match(/geriAlVeyaTazele\(showId, nesilBaslangic, previousState\)/g) || []).length === 5);
T.ok('ciftYaz kalici iz birakiyor', /logError\('mutations\.progress\.ciftYaz', error\)/.test(mut));

T.bitir();

// ==========================================================================
// ARAYUZ — M422: ilerleme kurallari + iyimser iskelet
// ==========================================================================
// URUN KURALI (kullanici, 2026-09-20):
//   * ilerleme yuzdesi = izlenen / (yayinlanmis) bolum
//   * aradan bir bolum geri alinirsa yuzde DUSER ve dizi "Bitirildi"den CIKAR
//   * "Siradaki Bolum" = izlenmemis EN ESKI bolum
//
// Bu takim o kurallari SAF katmanda sabitler (`optimistikIlerleme`), cunku
// ekrandaki yuzde/rozet/kova hesaplari hep bu nesneden turetiliyor
// (MediaHero: completed/aired, trackingLogic: next_episode).
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';
import {
  bolumleriIsaretle, bolumleriGeriAl, iskeletKur,
} from '../../services/library/mutations/optimistikIlerleme.ts';

const { baslat } = yardimci;
const T = baslat('ARAYUZ ILERLEME KURALLARI (M422)', { kokOneki: 'arayuz-ilerleme-' });
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const GECMIS = '2020-01-01T00:00:00.000Z';
const bol = (n, completed = false) => ({ number: n, completed, first_aired: GECMIS, last_watched_at: completed ? GECMIS : null });
// 3 sezon x 5 bolum; 3x5 dahil HEPSI izlenmis
const TAM = {
  seasons: [1, 2, 3].map((sn) => ({ number: sn, episodes: [1, 2, 3, 4, 5].map((n) => bol(n, true)) })),
};
const yuzde = (p) => (p.aired ? (p.completed / p.aired) * 100 : 0);
const bitti = (p) => !!p && p.aired > 0 && p.completed >= p.aired;

// ─────────────────────────────────────────────────────────────────────────
T.H('Baslangic: 3x5 e kadar her sey izlenmis');
const tam = bolumleriIsaretle(TAM, 3, [5], GECMIS);
T.ok('15/15 izlendi', tam.completed === 15 && tam.aired === 15, `${tam.completed}/${tam.aired}`);
T.ok('Yuzde 100', Math.round(yuzde(tam)) === 100);
T.ok('Bitirildi statusu ACIK', bitti(tam) === true);
T.ok('Siradaki bolum YOK', tam.next_episode === null);

// ─────────────────────────────────────────────────────────────────────────
T.H('Kullanicinin vakasi: ARADAN 2x1 in tiki kaldiriliyor');
const eksik = bolumleriGeriAl(tam, 2, [1]);
T.ok('Izlenen 15 -> 14', eksik.completed === 14, `${eksik.completed}/${eksik.aired}`);
T.ok('Yayinlanmis (payda) DEGISMEDI', eksik.aired === 15);
T.ok('Yuzde DUSTU (%93)', Math.round(yuzde(eksik)) === 93, String(Math.round(yuzde(eksik))));
T.ok('🔴 Bitirildi statusu DUSTU', bitti(eksik) === false);
T.ok('🔴 Siradaki bolum = izlenmemis EN ESKI (2x1)',
  eksik.next_episode?.season === 2 && eksik.next_episode?.number === 1,
  JSON.stringify(eksik.next_episode));
T.ok('Sezon sayaci da dustu (S2: 4/5)',
  eksik.seasons.find((s) => s.number === 2).completed === 4
  && eksik.seasons.find((s) => s.number === 2).aired === 5);
T.ok('Son izlenen bolum hala 3x5 (siraya gore)',
  eksik.last_episode?.season === 3 && eksik.last_episode?.number === 5);

// ─────────────────────────────────────────────────────────────────────────
T.H('Geri alinan bolum yeniden isaretlenince eski hale doner');
const geriDoldu = bolumleriIsaretle(eksik, 2, [1], GECMIS);
T.ok('15/15 ve Bitirildi geri geldi',
  geriDoldu.completed === 15 && bitti(geriDoldu) === true && geriDoldu.next_episode === null);

// ─────────────────────────────────────────────────────────────────────────
T.H('Yayinlanmamis bolum paydaya GIRMEZ (devam eden dizi %100 olabilir)');
const gelecek = {
  seasons: [{
    number: 1,
    episodes: [
      { number: 1, completed: true, first_aired: GECMIS },
      { number: 2, completed: true, first_aired: GECMIS },
      { number: 3, completed: false, first_aired: '2099-01-01T00:00:00.000Z' },
    ],
  }],
};
const devam = bolumleriIsaretle(gelecek, 1, [2], GECMIS);
T.ok('Payda 2 (yayinlanmis), izlenen 2', devam.aired === 2 && devam.completed === 2);
T.ok('Devam eden dizi %100 ve Bitirildi olabilir', Math.round(yuzde(devam)) === 100 && bitti(devam) === true);
T.ok('Yayinlanmamis bolum siradaki DEGIL', devam.next_episode === null);

// ─────────────────────────────────────────────────────────────────────────
T.H('OZEL SEZON (0) toplam sayaca girmez');
const ozelli = {
  seasons: [
    { number: 0, episodes: [bol(1), bol(2)] },
    { number: 1, episodes: [bol(1, true), bol(2, true)] },
  ],
};
const ozel = bolumleriIsaretle(ozelli, 1, [2], GECMIS);
T.ok('Toplam sayac yalniz normal sezonlari sayar', ozel.aired === 2 && ozel.completed === 2);
T.ok('Ozel bolum siradaki olarak onerilmez', ozel.next_episode === null);

// ─────────────────────────────────────────────────────────────────────────
T.H('🆕 Iyimser iskelet (ekranin katalog verisinden)');
const iskelet = iskeletKur([
  { number: 1, episodes: [{ number: 1, first_aired: GECMIS }, { number: 2, first_aired: GECMIS }] },
  { number: 2, episodes: [{ number: 1, first_aired: GECMIS }, { number: 2, first_aired: '2099-01-01T00:00:00.000Z' }] },
]);
T.ok('Iskelet sayaclari dogru (3 yayinlanmis, 0 izlenmis)',
  iskelet.aired === 3 && iskelet.completed === 0, `${iskelet.completed}/${iskelet.aired}`);
T.ok('Iskelette siradaki = ilk yayinlanmis bolum',
  iskelet.next_episode?.season === 1 && iskelet.next_episode?.number === 1);
const iskeletIsaretli = bolumleriIsaretle(iskelet, 1, [1, 2], GECMIS);
T.ok('🔴 Iskelet uzerinde COK BOLUM isaretlenebiliyor (UI ANINDA dolar)',
  iskeletIsaretli.completed === 2
  && iskeletIsaretli.seasons[0].episodes.every((b) => b.completed === true),
  `${iskeletIsaretli.completed}/${iskeletIsaretli.aired}`);
T.ok('Bos/gecersiz girdide iskelet YOK (uydurma yok)',
  iskeletKur(null) === null && iskeletKur([]) === null
  && iskeletKur([{ number: 1, episodes: [] }]) === null);

// ─────────────────────────────────────────────────────────────────────────
T.H('Kaynak denetimi: iskelet zinciri bagli mi');
const oku = (...y) => fs.readFileSync(path.join(KOK, ...y), 'utf8');
const prog = oku('services', 'library', 'mutations', 'progress.ts');
T.ok('Uc mutasyon da ilerleme yoksa iskelete dusuyor',
  (prog.match(/iskeletKur\(iskeletSezonlar\)/g) || []).length === 3,
  String((prog.match(/iskeletKur\(iskeletSezonlar\)/g) || []).length));
const ekran = oku('app', 'show', '[id].tsx');
T.ok('Dizi sayfasi ham sezon verisini kuruyor ve geciriyor',
  /const iskeletSezonlar = useMemo/.test(ekran) && /iskeletSezonlar=\{iskeletSezonlar\}/.test(ekran));
const dugme = oku('components', 'EpisodeCheckButton.tsx');
T.ok('Dugme iskeleti IKI mutasyona da geciriyor',
  /planiIsaretle\(traktId, plan, showMedia, iskeletSezonlar\)/.test(dugme)
  && /markEpisodeAsWatched\(traktId, season, episode, showMedia, iskeletSezonlar\)/.test(dugme));
const akordiyon = oku('components', 'SeasonAccordion.tsx');
T.ok('Sezon isaretleme de iskeleti geciriyor', /showMedia, iskeletSezonlar\)/.test(akordiyon));

T.bitir();

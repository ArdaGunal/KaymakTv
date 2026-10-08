import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('BOLUM SAYFASI ONCEKILERI DE ISARETLE (M463 / K2)', { kokOneki: 'bolum-plan-' });
const load = tsLoader(root);
const { atlananPlan, planToplami, planTekBolumMu } = load('utils/atlananBolumler.ts');
const { sezonEvreniKur } = load('utils/sezonEvreni.ts');
const source = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// Naagin benzeri: 4 sezon, Trakt /seasons?extended=full,episodes biçimi.
const sezon = (number, n) => ({ number, aired_episodes: n, episodes: Array.from({ length: n }, (_, i) => ({ number: i + 1, first_aired: '2019-01-01T00:00:00Z' })) });
const ham = [sezon(0, 2), sezon(1, 62), sezon(2, 72), sezon(3, 109), sezon(4, 10)];
const evren = sezonEvreniKur(ham).tumSezonlar;

T.H('Cihazda uretilen hata (eski davranis)');
const eski = atlananPlan(undefined, 4, 3);
T.ok('Ilerleme kaydi yokken evrensiz plan YALNIZ bu bolum (soru sorulmuyordu)', planTekBolumMu(eski, 4, 3));
const eksikKayit = { seasons: [{ number: 4, episodes: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, completed: i === 2 })) }] };
T.ok('Kayit yalniz S4 iceriyorsa evrensiz plan onceki sezonlari GORMEZ', atlananPlan(eksikKayit, 4, 5).every((p) => p.sezon === 4));

T.H('Yeni davranis (tam sezon listesi)');
const yeni = atlananPlan(undefined, 4, 3, evren);
T.ok('Ilk isaretlemede de onceki 3 sezon + S4 1..3 planlanir', yeni.length === 4 && planToplami(yeni) === 62 + 72 + 109 + 3, String(planToplami(yeni)));
T.ok('Ozel bolumler (S0) plana girmez', yeni.every((p) => p.sezon > 0));
const yeni2 = atlananPlan(eksikKayit, 4, 5, evren);
T.ok('Eksik kayitta da onceki sezonlar gelir, izlenen S4E3 atlanir', yeni2.length === 4 && !yeni2[3].bolumler.includes(3) && yeni2[3].bolumler.includes(5));

T.H('Baglanti');
const hook = source('hooks/useEpisodeActions.ts');
T.ok('Hook plani evrenle kuruyor', hook.includes('atlananPlan(showProgressMap[showTraktId], sNum, eNum, evren)'));
T.ok('Evren hazir degilse basista getShowSeasons ile cekiliyor, hata eski davranisa dusuyor', hook.includes('getShowSeasons(showTraktId)') && hook.includes("logWarning('useEpisodeActions.sezonEvreni'"));
T.ok('Bolum ekrani ray evrenini hook\'a veriyor', source('app/episode/[id].tsx').includes('tumSezonlar: railEvren.tumSezonlar'));
T.bitir();

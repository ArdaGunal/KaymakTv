// ==========================================================================
// ARAYUZ — M421: cok sezonlu isaretleme plani + denetim onarimlari
// ==========================================================================
// URUN KARARI (kullanici, 2026-09-20): "2. sezona gecen bir kullanici mantiken
// 1. sezonu da bitirmistir." Eski davranis YALNIZCA aktif sezonu tariyordu ve
// sezon siniri zincirin DORT katmanindaydi (karar → cagri → mutasyon → uc).
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';
import { atlananPlan, planToplami, planTekBolumMu } from '../../utils/atlananBolumler.ts';
import { izlenenDiziyeEkle, izlemeListesindenDus } from '../../services/library/mutations/optimistikDizi.ts';

const { baslat } = yardimci;
const T = baslat('ARAYUZ ISARETLEME PLANI (M421)', { kokOneki: 'arayuz-plan-' });
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const b = (number, completed = false) => ({ number, completed });
const EVREN = [
  { sezon: 0, bolumler: [1, 2] },           // ozel bolumler
  { sezon: 1, bolumler: [1, 2, 3, 4, 5] },
  { sezon: 2, bolumler: [1, 2, 3, 4, 5] },
];
const ILERLEME = {
  seasons: [
    { number: 0, episodes: [b(1), b(2)] },
    { number: 1, episodes: [b(1, true), b(2), b(3), b(4), b(5)] },
    { number: 2, episodes: [b(1), b(2), b(3), b(4), b(5)] },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
T.H('Kullanicinin vakasi: S1E1 izlenmis, S2E2 ye basiliyor');
const plan = atlananPlan(ILERLEME, 2, 2, EVREN);
T.ok('Plan IKI sezon kapsiyor', plan.length === 2, JSON.stringify(plan));
T.ok('1. sezonun KALANI (2,3,4,5) plana girdi',
  JSON.stringify(plan[0]) === '{"sezon":1,"bolumler":[2,3,4,5]}', JSON.stringify(plan[0]));
T.ok('2. sezondan yalnizca 1 ve 2',
  JSON.stringify(plan[1]) === '{"sezon":2,"bolumler":[1,2]}', JSON.stringify(plan[1]));
T.ok('Toplam 6 bolum (onay metni bu sayiyi gosterir)', planToplami(plan) === 6);
T.ok('OZEL SEZON (0) plana GIRMEZ', !plan.some((p) => p.sezon === 0));

// ─────────────────────────────────────────────────────────────────────────
T.H('Tek bolumluk plan -> soru SORULMAZ');
const hepsiIzlenmis = {
  seasons: [
    { number: 1, episodes: [b(1, true), b(2, true), b(3, true), b(4, true), b(5, true)] },
    { number: 2, episodes: [b(1, true), b(2)] },
  ],
};
const p2 = atlananPlan(hepsiIzlenmis, 2, 2, EVREN);
T.ok('Onceki her sey izlenmisse plan yalniz secilen bolum',
  JSON.stringify(p2) === '[{"sezon":2,"bolumler":[2]}]', JSON.stringify(p2));
T.ok('planTekBolumMu dogru', planTekBolumMu(p2, 2, 2) === true);
T.ok('Cok bolumluk planda planTekBolumMu false', planTekBolumMu(plan, 2, 2) === false);

// ─────────────────────────────────────────────────────────────────────────
T.H('Evren kaynaklari');
T.ok('Ekran listesi yoksa ILERLEME evreni kullanilir',
  JSON.stringify(atlananPlan(ILERLEME, 2, 2)) === '[{"sezon":1,"bolumler":[2,3,4,5]},{"sezon":2,"bolumler":[1,2]}]');
T.ok('Hicbiri yoksa YALNIZ secilen bolum (uydurma yok)',
  JSON.stringify(atlananPlan(null, 3, 7)) === '[{"sezon":3,"bolumler":[7]}]');
T.ok('Bolum numaralari 1 den baslamasa da dogru (canli vaka 21020 S5)',
  JSON.stringify(atlananPlan(null, 5, 21, [{ sezon: 5, bolumler: [19, 20, 21] }]))
    === '[{"sezon":5,"bolumler":[19,20,21]}]');
T.ok('Sonraki sezonlar plana GIRMEZ',
  !atlananPlan(ILERLEME, 1, 3, EVREN).some((p) => p.sezon > 1));

// ─────────────────────────────────────────────────────────────────────────
T.H('Dizi: izlenenlere ekleme + izleme listesinden dusme (denetim B + urun karari)');
const DIZI = { ids: { trakt: 55 }, title: 'Test Dizi' };
const eklenmis = izlenenDiziyeEkle([], 55, DIZI, '2026-09-20T10:00:00.000Z');
T.ok('Bos listeye eklenir', eklenmis.length === 1 && eklenmis[0].show.ids.trakt === 55);
T.ok('Girdi bicimi plays + last_watched_at + show',
  eklenmis[0].plays === 1 && eklenmis[0].last_watched_at === '2026-09-20T10:00:00.000Z');
const mevcut = [{ show: { ids: { trakt: 55 } } }];
T.ok('Zaten varsa AYNI referans', izlenenDiziyeEkle(mevcut, 55, DIZI) === mevcut);
T.ok('Veri yoksa/kimlik uymuyorsa DEGISMEZ',
  izlenenDiziyeEkle([], 55, null).length === 0
  && izlenenDiziyeEkle([], 55, { ids: { trakt: 99 } }).length === 0);
const { liste, dusen } = izlemeListesindenDus([{ show: { ids: { trakt: 55 } } }, { show: { ids: { trakt: 7 } } }], 55);
T.ok('Izleme listesinden duser ve girdi doner', liste.length === 1 && dusen?.show?.ids?.trakt === 55);
T.ok('Listede yoksa AYNI referans', (() => { const l = [{ show: { ids: { trakt: 7 } } }]; return izlemeListesindenDus(l, 55).liste === l; })());

// ─────────────────────────────────────────────────────────────────────────
T.H('Kaynak denetimleri');
const oku = (...y) => fs.readFileSync(path.join(KOK, ...y), 'utf8');
const prog = oku('services', 'library', 'mutations', 'progress.ts');
T.ok('planiIsaretle cok sezonlu ve SIRAYLA yaziyor',
  /export const planiIsaretle/.test(prog) && /for \(const p of temiz\) \{\s*\n\s*await ciftYaz\(/.test(prog));
T.ok('markEpisodesUpToAsWatched artik plana deleniyor',
  /markEpisodesUpToAsWatched[\s\S]{0,220}planiIsaretle\(showId, \[\{ sezon: season, bolumler: episodes \}\]/.test(prog));
T.ok('reactivateShowTracking izleme listesinden DUSURUYOR + izlenenlere EKLIYOR',
  /izlemeListesindenDus\(prev, showId\)/.test(prog) && /izlenenDiziyeEkle\(prev, showId, dizi\)/.test(prog));
T.ok('Eski "listede yoksa hicbir sey yapma" dali KALMADI',
  !/const idx = \(prev \|\| \[\]\)\.findIndex[\s\S]{0,80}if \(idx === -1\) return prev;\s*\n\s*const updated/.test(prog));
T.ok('Izlenen film TAKVIMDEN dusuyor', /setCalendarMovies\(\(prev: any\[\]\) =>/.test(prog));

const dugme = oku('components', 'EpisodeCheckButton.tsx');
T.ok('Dugme plani kullaniyor', /atlananPlan\(progress, season, episode, evren\)/.test(dugme));
T.ok('Onay metni SAYI gosteriyor',
  /skippedEpisodesMsgCokSezon/.test(dugme) && /skippedEpisodesMsgSayili/.test(dugme));
const kanca = oku('hooks', 'useEpisodeActions.ts');
T.ok('Bolum detayi da plani kullaniyor', /atlananPlan\(showProgressMap\[showTraktId\], sNum, eNum\)/.test(kanca));

const kol = oku('services', 'library', 'mutations', 'collections.ts');
T.ok('Gecmis silmede GERCEK geri alma var',
  /setWatchedShows\(onceki\.watchedShows\)/.test(kol) && /setShowProgressMap\(onceki\.showProgressMap\)/.test(kol));
// Yorum metninde gecebilir; aranan GERCEK CAGRI (satir basinda).
T.ok('Olu telafi cagrisi (fetchFreshData(null)) KALMADI', !/^\s*fetchFreshData\(null/m.test(kol));
T.ok('fetchFreshData artik bu dosyaya hic IMPORT edilmiyor', !/import \{ fetchFreshData \}/.test(kol));
T.ok('Gecmis silmede akis kaydi geri cekiliyor', /retractLocalActivity/.test(kol));

const emniyet = oku('services', 'library', 'emniyetAgi.ts');
T.ok('Emniyet agi Google-only kullanicida da calisiyor',
  !/if \(!traktTokenVar\) return 0;/.test(emniyet) && /fetchShowProgress\(id\)/.test(emniyet));

const akordiyon = oku('components', 'SeasonAccordion.tsx');
T.ok('Sezon dugmesinde donen simge YOK', !/seasonLoading/.test(akordiyon));
T.ok('Sezon akordiyonu tum sezonlari ve dizi verisini geciriyor',
  /tumSezonlar=\{tumSezonlar\}/.test(akordiyon) && /showMedia=\{showMedia\}/.test(akordiyon));

const worker = fs.readFileSync(path.join(KOK, '..', 'kaymaktv-feedback-worker', 'src', 'routes', 'library.js'), 'utf8');
T.ok('Worker: izlendi yazilinca izleme listesi satiri siliniyor',
  /izlemeListesindenDus\(env, verified\.userId, kok\)/.test(worker)
  && /user_watchlist\?\$\{p\}/.test(worker));

T.bitir();

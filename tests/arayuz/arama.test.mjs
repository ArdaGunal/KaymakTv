// ==========================================================================
// ARAYUZ — M415: Kesfet aramasi 1 harften baslar
// ==========================================================================
// Kullanici: "kullanici ara diyince 1 harf de olsa arasin."
// Eski esik 3'tu; iki harf yazan kullanici "arama calismiyor" sanmisti ve
// "24"/"Us"/"ER" gibi kisa adlar HIC aranamiyordu.
//
// 🔴 KAYNAK DENETIMI de var: `useExplore` esigi BES yerde kullaniyor
// (sayfalama kapisi, yenileme, arama efekti, dil degisimi, isSearching).
// Biri geride kalirsa ekran "arama modunda" ama veri trend'den gelir.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';
import { aramaAcikMi, ARAMA_EN_AZ_KARAKTER } from '../../utils/arama.ts';

const { baslat } = yardimci;
const T = baslat('ARAYUZ ARAMA ESIGI (M415)', { kokOneki: 'arayuz-arama-' });
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ─────────────────────────────────────────────────────────────────────────
T.H('Esik');
T.ok('Esik 1', ARAMA_EN_AZ_KARAKTER === 1);
T.ok('Tek harf ARAR', aramaAcikMi('a') === true);
T.ok('Iki harf ARAR (eski esikte aranmiyordu)', aramaAcikMi('24') === true && aramaAcikMi('Us') === true);
T.ok('Uc harf ve uzunu ARAR', aramaAcikMi('dark') === true);
T.ok('Bos sorgu ARAMAZ', aramaAcikMi('') === false);
T.ok('Yalnizca bosluk ARAMAZ', aramaAcikMi('   ') === false && aramaAcikMi('\t\n') === false);
T.ok('null/undefined ARAMAZ', aramaAcikMi(null) === false && aramaAcikMi(undefined) === false);
T.ok('Bosluklu tek harf ARAR', aramaAcikMi('  x  ') === true);

// ─────────────────────────────────────────────────────────────────────────
T.H('Kaynak denetimi: useExplore esigi TEK yerden okuyor');
const kaynak = fs.readFileSync(path.join(KOK, 'hooks', 'useExplore.ts'), 'utf8');
T.ok('Elle yazilmis 3 karakter esigi KALMADI', !/trim\(\)\.length > 2/.test(kaynak));
const kullanim = (kaynak.match(/aramaAcikMi\(searchQuery\)/g) || []).length;
T.ok('Bes kullanim yerinin hepsi ortak karardan', kullanim === 5, `${kullanim} kullanim`);
T.ok('utils/arama.ts iceri aktarilmis', /from '\.\.\/utils\/arama'/.test(kaynak));

T.bitir();

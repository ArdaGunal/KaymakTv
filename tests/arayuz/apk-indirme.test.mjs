// ==========================================================================
// ARAYUZ — APK-INDIR-01: indirme sayfasi APK'yi GitHub «beta» surumunden bulur
// ==========================================================================
// Hata (2026-11-07): dugme sabit `kaymaktv-latest.apk` adresine gidiyordu; APK
// surum numarali adla (`KaymakTV-2.6.8.apk`) yuklenince /download 404 verdi.
// Kullanici karari: surum numarali ad mantikli -> dosya adi koda yazilmaz.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = yardimci.baslat('ARAYUZ APK INDIRME (APK-INDIR-01)', { kokOneki: 'arayuz-apk-indir-' });
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');
const { betaApkSec } = tsLoader(KOK)('services/github.ts');

const varlik = (name, updated_at, size = 94231282) => ({
  name, updated_at, size, browser_download_url: `https://github.com/ArdaGunal/KaymakTv/releases/download/beta/${name}`,
});

T.H('betaApkSec');
let s = betaApkSec([varlik('KaymakTV-2.6.8.apk', '2026-11-06T22:08:52Z')]);
T.ok('surum numarali ad bulunur (canli durum 2026-11-07)', s?.ad === 'KaymakTV-2.6.8.apk' && /KaymakTV-2\.6\.8\.apk$/.test(s.url) && s.boyut === 94231282);
s = betaApkSec([varlik('KaymakTV-2.6.8.apk', '2026-11-06T22:00:00Z'), varlik('KaymakTV-2.6.9.apk', '2026-11-20T10:00:00Z')]);
T.ok('birden cok APK -> en son yuklenen', s?.ad === 'KaymakTV-2.6.9.apk');
s = betaApkSec([varlik('KaymakTV-2.6.9-AG-TEST.apk', '2026-11-21T00:00:00Z'), varlik('KaymakTV-2.6.9.apk', '2026-11-20T00:00:00Z')]);
T.ok('ag gunluklu test paketi asla secilmez', s?.ad === 'KaymakTV-2.6.9.apk');
s = betaApkSec([varlik('notlar.txt', '2026-11-21T00:00:00Z'), varlik('kaymaktv-latest.apk', '2026-11-01T00:00:00Z')]);
T.ok('APK olmayan dosya atlanir; eski sabit ad da calisir', s?.ad === 'kaymaktv-latest.apk');
T.ok('APK yoksa / bos girdi -> null (dugme surum sayfasina gider)', betaApkSec([varlik('a.zip', 'x')]) === null && betaApkSec(null) === null && betaApkSec(undefined) === null);

s = betaApkSec([varlik('KaymakTV-2.6.9-GOOGLE-TEST.apk', '2026-11-21T00:00:00Z'), varlik('KaymakTV-2.6.8.apk', '2026-11-06T00:00:00Z')]);
T.ok('Google test paketi de secilmez (adinda TEST)', s?.ad === 'KaymakTV-2.6.8.apk');

T.H('AD KURALI (M583): betik ile indirme sayfasi ayni kurali konusur');
const betik = oku('scripts/apk-derle.sh');
T.ok('betik adi derlenen paketin surumunden yazar: apk/KaymakTV-<versionName><EK>.apk',
  /HEDEF="\$KOK\/apk\/KaymakTV-\$SURUM\$EK\.apk"/.test(betik) && /SURUM=\$\(grep -o '"versionName": [^\n]*output-metadata\.json/.test(betik));
const ekler = [...betik.matchAll(/EK="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
T.ok(`test ekleri TEST iceriyor (${ekler.join(', ')})`, ekler.length >= 2 && ekler.every((e) => /TEST/.test(e)));
const ornek = (ek) => varlik(`KaymakTV-2.6.9${ek}.apk`, '2026-11-21T00:00:00Z');
T.ok('betigin her test paketini sayfa reddeder, yayin paketini secer',
  ekler.every((e) => betaApkSec([ornek(e)]) === null) && betaApkSec([ornek('')])?.ad === 'KaymakTV-2.6.9.apk');
T.ok('yayin derlemesi sonunda GitHub\'a hangi adla yuklenecegini soyler', /Yayin: GitHub 'beta' surumune AYNI adla yukle/.test(betik) && /TEST paketi: GitHub'a YUKLENMEZ/.test(betik));
T.ok('kural AGENTS.md\'de (git\'te, herkes icin)', /KaymakTV-<sürüm>\.apk/.test(oku('AGENTS.md')) && /apk-derle\.sh/.test(oku('AGENTS.md')));

T.H('Sayfa: sabit dosya adi yok, 404 yerine surum sayfasi');
const kodDosyalari = ['utils/constants.ts', 'app/(public)/download.web.tsx', 'hooks/useBetaSurumu.ts', 'services/github.ts'];
T.ok('kodda sabit `kaymaktv-latest.apk` adresi yok', kodDosyalari.every((d) => !/releases\/download\/beta\/kaymaktv-latest\.apk/.test(oku(d))));
const kanca = oku('hooks/useBetaSurumu.ts');
T.ok('APK bulunamazsa / istek duserse surum sayfasi', /indirmeAdresi: apk\?\.url \?\? GITHUB_RELEASES_URL/.test(kanca));
const sayfa = oku('app/(public)/download.web.tsx');
T.ok('sayfa kancayi kullaniyor, dugme dinamik adrese gidiyor', /useBetaSurumu\(\)/.test(sayfa) && /Linking\.openURL\(indirmeAdresi\)/.test(sayfa));
T.ok('elle yazilmis bayat boyut (~87 MB) kalkti', !/~87 MB|APK_SIZE/.test(sayfa));

T.bitir();

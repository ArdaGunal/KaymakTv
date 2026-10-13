import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('DIZI SAYFASI SIRASI (DIZI-SAYFA-01 / M513)', { kokOneki: 'dizi-sira-' });
const load = tsLoader(root);
const { diziSayfaSirasi } = load('utils/diziSayfaSirasi.ts');
const source = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const once = (dizi, a, b) => dizi.indexOf(a) < dizi.indexOf(b);

T.H('Karar (kullanici: «bu sadece apk da olcak»)');
for (const os of ['android', 'ios']) {
  const s = diziSayfaSirasi(os);
  T.ok(`${os}: sezonlar yorumlarin USTUNDE`, once(s, 'sezonlar', 'yorumlar'), s.join(','));
  T.ok(`${os}: oyuncular en ustte, benzerler en altta`, s[0] === 'oyuncular' && s[s.length - 1] === 'benzerler');
}
const web = diziSayfaSirasi('web');
T.ok('web: eski sira AYNEN (oyuncular, yorumlar, sezonlar, benzerler)', web.join(',') === 'oyuncular,yorumlar,sezonlar,benzerler', web.join(','));
T.ok('Her platformda dort bolum de bir kez var', ['android', 'ios', 'web'].every((os) => new Set(diziSayfaSirasi(os)).size === 4));

T.H('Baglanti');
const sayfa = source('app/show/[id].tsx');
T.ok('Mobil dal sirayi Platform.OS ile kuruyor', sayfa.includes('diziSayfaSirasi(Platform.OS)'));
T.ok('Mobil sezon listesi ayri bilesende', sayfa.includes('<SeasonsListMobile'));
T.ok('Masaustu web dali DEGISMEDI (sag ray SeasonsRailWeb)', sayfa.includes('<SeasonsRailWeb') && sayfa.includes('if (layout.isDesktopWeb)'));
T.ok('Dosya 400 satir sinirinin altinda', sayfa.split('\n').length <= 400, String(sayfa.split('\n').length));
T.bitir();

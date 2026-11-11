import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('DIZI SAYFASI SIRASI (DIZI-SAYFA-01 / M587)', { kokOneki: 'dizi-sira-' });
const load = tsLoader(root);
const { diziSayfaSirasi } = load('utils/diziSayfaSirasi.ts');
const source = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const once = (dizi, a, b) => dizi.indexOf(a) < dizi.indexOf(b);

T.H('Mobil detayda yeni sira; web mevcut sirasinda');
for (const os of ['android', 'ios']) {
  const s = diziSayfaSirasi(os);
  T.ok(`${os}: oyuncular, sezonlar, incelemeler, fragman`,
    once(s, 'oyuncular', 'sezonlar') && once(s, 'sezonlar', 'yorumlar') && once(s, 'yorumlar', 'fragman'), s.join(','));
  T.ok(`${os}: benzerler en altta`, s[s.length - 1] === 'benzerler');
}
const web = diziSayfaSirasi('web');
T.ok('web: eski sira AYNEN (oyuncular, yorumlar, sezonlar, benzerler)', web.join(',') === 'oyuncular,yorumlar,sezonlar,benzerler', web.join(','));
T.ok('Bolumler her platformda tekil', ['android', 'ios', 'web'].every((os) => {
  const s = diziSayfaSirasi(os);
  return new Set(s).size === s.length;
}));

T.H('Baglanti');
const sayfa = source('app/show/[id].tsx');
T.ok('Mobil dal sirayi Platform.OS ile kuruyor', sayfa.includes('diziSayfaSirasi(Platform.OS)'));
T.ok('Mobil sezon listesi ayri bilesende', sayfa.includes('<SeasonsListMobile'));
T.ok('Fragman native sirasinda ayri bilesende', sayfa.includes("bolum === 'fragman' && <MediaTrailer"));
T.ok('Masaustu web dali DEGISMEDI (sag ray SeasonsRailWeb)', sayfa.includes('<SeasonsRailWeb') && sayfa.includes('if (layout.isDesktopWeb)'));
T.ok('Dosya 400 satir sinirinin altinda', sayfa.split('\n').length <= 400, String(sayfa.split('\n').length));
T.bitir();

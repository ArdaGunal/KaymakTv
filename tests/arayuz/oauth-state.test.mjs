import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tsLoader } from '../ts-test-loader.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = require('../yardimci').baslat('TRAKT OAUTH STATE (S7 · M499)', { kokOneki: 'oauth-state-' });

const depo = new Map();
const AsyncStorage = {
  getItem: async (k) => (depo.has(k) ? depo.get(k) : null),
  setItem: async (k, v) => { depo.set(k, v); },
  removeItem: async (k) => { depo.delete(k); },
};
const { oauthStateEsit, oauthStateKaydet, oauthStateTuket } = tsLoader(root, {
  '@react-native-async-storage/async-storage': { __esModule: true, default: AsyncStorage },
})('services/oauthState.ts');

T.H('Saf karar');
T.ok('Esit ve yeterince uzun -> gecerli', oauthStateEsit('Ab3dEf9hIj', 'Ab3dEf9hIj'));
T.ok('Farkli -> gecersiz', !oauthStateEsit('Ab3dEf9hIj', 'saldirgan01'));
T.ok('Gelen yok (saldirganin ?code= baglantisi) -> gecersiz', !oauthStateEsit('Ab3dEf9hIj', null) && !oauthStateEsit('Ab3dEf9hIj', undefined));
T.ok('Saklanan yok -> gecersiz (null === null kabul edilmez)', !oauthStateEsit(null, null) && !oauthStateEsit('', ''));

T.H('Tek kullanimlik');
await oauthStateKaydet('Ab3dEf9hIj');
T.ok('Dogru state ilk seferde kabul', await oauthStateTuket('Ab3dEf9hIj'));
T.ok('Ayni state ikinci kez REDDEDILIR (tuketildi)', !(await oauthStateTuket('Ab3dEf9hIj')));
await oauthStateKaydet('Ab3dEf9hIj');
T.ok('Yanlis state de saklananı siler', !(await oauthStateTuket('baska12345')) && depo.size === 0);

T.H('Ekran kaynagi');
const ekran = fs.readFileSync(path.join(root, 'app/(public)/settings.tsx'), 'utf8');
T.ok('Giris oncesi state saklaniyor', /await oauthStateKaydet\(request\?\.state\)/.test(ekran) && ekran.indexOf('oauthStateKaydet(request?.state)') < ekran.indexOf('window.location.href = request.url'));
T.ok('Derin baglanti dali dogrulamadan gecer', /else if \(routerCode\) \{\s+dogrulanmisKod\(routerCode, routerState\)/.test(ekran));
T.ok('Web URL dali dogrulamadan gecer', /dogrulanmisKod\(code, urlParams\.get\('state'\)\)/.test(ekran));
T.ok('Dogrulamasiz handleTokenExchange cagrisi yalniz kutuphane yolunda + dogrulanmisKod icinde',
  (ekran.match(/handleTokenExchange\(/g) || []).length === 2 && /handleTokenExchange\(response\.params\.code\)/.test(ekran));
T.bitir();

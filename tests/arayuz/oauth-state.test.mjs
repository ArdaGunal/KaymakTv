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
const { oauthStateEsit, oauthStateKaydet, oauthStateTuket, stateListesiniCoz, STATE_OMRU_MS, STATE_TAVANI } = tsLoader(root, {
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

T.H('M620 K5: son 3 deger, 10 dk; uyusmayan donus listeye dokunmaz');
depo.clear();
await oauthStateKaydet('ilkDeneme01', 1000);
await oauthStateKaydet('ikinciDen02', 2000);
T.ok('Yanlis state REDDEDILIR ama listeyi SILMEZ', !(await oauthStateTuket('saldirgan01', 3000)) && stateListesiniCoz(depo.get('@kaymak_trakt_oauth_state_v1'), 3000).length === 2);
T.ok('Ilk denemenin donusu ikinci deneme sonrasi da kabul (eskisi ezilmiyor)', await oauthStateTuket('ilkDeneme01', 3000));
T.ok('Yalniz eslesen tuketildi; digeri duruyor', await oauthStateTuket('ikinciDen02', 3000) && !depo.has('@kaymak_trakt_oauth_state_v1'));
for (let n = 0; n < 5; n++) await oauthStateKaydet(`deneme000${n}`, 10_000 + n);
T.ok(`En cok ${STATE_TAVANI} deger tutulur (en eskiler duser)`, stateListesiniCoz(depo.get('@kaymak_trakt_oauth_state_v1'), 10_010).map((k) => k.s).join() === 'deneme0002,deneme0003,deneme0004');
T.ok('10 dk sonra gecersiz', !(await oauthStateTuket('deneme0004', 10_004 + STATE_OMRU_MS + 1)));
depo.set('@kaymak_trakt_oauth_state_v1', 'eskiBicim99');
T.ok('M620 oncesi duz metin kayit da okunur', await oauthStateTuket('eskiBicim99', 5));
T.ok('Bozuk / gelecekten kayit sayilmaz', stateListesiniCoz(JSON.stringify([{ s: 'x', t: 9e15 }, { s: 5 }, null]), 1000).length === 0);

T.H('Ekran kaynagi');
const ekran = fs.readFileSync(path.join(root, 'app/(public)/settings.tsx'), 'utf8');
T.ok('Giris oncesi state saklaniyor', /await oauthStateKaydet\(request\?\.state\)/.test(ekran) && ekran.indexOf('oauthStateKaydet(request?.state)') < ekran.indexOf('window.location.href = adres'));
T.ok('Derin baglanti dali dogrulamadan gecer', /else if \(routerCode\) \{\s+dogrulanmisKod\(routerCode, routerState\)/.test(ekran));
T.ok('Web URL dali dogrulamadan gecer', /dogrulanmisKod\(code, urlParams\.get\('state'\)\)/.test(ekran));
T.ok('Dogrulamasiz handleTokenExchange cagrisi yalniz kutuphane yolunda + dogrulanmisKod icinde',
  (ekran.match(/handleTokenExchange\(/g) || []).length === 2 && /void oauthStateTuket\(response\.params\.state\)/.test(ekran) && /handleTokenExchange\(response\.params\.code\)/.test(ekran));
T.ok('M617: Trakt sayfasi uygulamanin kendi gorevinde acilir (createTask: false) — e-posta kodu icin cikip donunce kapanmaz',
  /promptAsync\(\{ \.\.\.\(adres && zorunluGiris \? \{ url: adres \} : \{\}\), createTask: false \}\)/.test(ekran) &&!/promptAsync\(adres && zorunluGiris \? \{ url: adres \} : undefined\)/.test(ekran));
T.ok('M617: Trakt sayfasi kapaninca (dismiss) nasil surdurulecegi yazar (TR + EN)',
  ekran.includes("response?.type === 'dismiss' && !isGenerating") && ekran.includes("t('settings:traktSayfasiKapandi')")
  && ['tr', 'en'].every((d) => typeof JSON.parse(fs.readFileSync(path.join(root, `locales/${d}/settings.json`), 'utf8')).traktSayfasiKapandi === 'string'));
T.bitir();

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tsLoader } from '../ts-test-loader.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = require('../yardimci').baslat('TRAKT OTURUMU (kasa · plan §4.7): yenileme, tasima, gecici hata', { kokOneki: 'trakt-oturumu-' });

const depo = new Map();
const SecureStore = {
  getItemAsync: async (k) => (depo.has(k) ? depo.get(k) : null),
  setItemAsync: async (k, v) => { depo.set(k, v); },
  deleteItemAsync: async (k) => { depo.delete(k); },
};
let istekler = [];
let cevaplar = [];
const hataYanit = (status, code) => Object.assign(new Error('h'), { response: { status, data: { code } } });
const axios = {
  post: async (url, govde) => {
    istekler.push({ yol: url.replace(/^https?:\/\/[^/]+/, ''), govde });
    const c = cevaplar.shift();
    if (c instanceof Error) throw c;
    return { data: c };
  },
};
const W = 'https://worker.invalid'; // ts-test-loader'ın sabit Worker adresi
const kasaMod = tsLoader(root, { axios: { __esModule: true, default: axios } })('services/api/traktKasa.ts');
const O = tsLoader(root, {
  '../../utils/secureStorage': SecureStore,
  '../api/traktKasa': kasaMod,
})('services/auth/traktOturumu.ts');

const oturumCevabi = (erisim, kaymakOturum = 'oturum-yeni', ek = {}) => ({ success: true, erisim, erisimBitis: 1, kaymakOturum, userId: 'u', ...ek });
const hazirla = (d = {}) => { depo.clear(); istekler = []; cevaplar = []; for (const [k, v] of Object.entries(d)) depo.set(k, v); };

T.H('Yenileme: kasadan erisim');
hazirla({ traktAccessToken: 'e-eski', kaymakOturum: 'o-1' });
cevaplar = [oturumCevabi('e-yeni', 'o-2')];
let s = await O.traktOturumunuYenile();
T.ok('Oturumla token ister, erisim + kayan oturum yazar', s.tur === 'tamam' && s.erisim === 'e-yeni' && depo.get('traktAccessToken') === 'e-yeni' && depo.get('kaymakOturum') === 'o-2');
T.ok('Istek /auth/trakt/token, yalniz oturum tasir', istekler[0].yol === '/auth/trakt/token' && Object.keys(istekler[0].govde).join() === 'kaymakOturum');

T.H('🔴 Gecici hata oturumu KAPATMAZ (eskiden her hata cikisa atiyordu)');
for (const [ad, hata] of [['tekrar_dene 503', hataYanit(503, 'tekrar_dene')], ['429 rate_limited', hataYanit(429, 'rate_limited')], ['500 kodsuz', hataYanit(500)], ['internet yok', new Error('Network Error')]]) {
  hazirla({ traktAccessToken: 'e', kaymakOturum: 'o' });
  cevaplar = [hata];
  s = await O.traktOturumunuYenile();
  T.ok(`${ad} → gecici, anahtarlar yerinde`, s.tur === 'gecici' && depo.get('traktAccessToken') === 'e' && depo.get('kaymakOturum') === 'o');
}

T.H('Yalniz sunucunun «bitti» dedigi kodlar oturumu bitirir');
for (const [kod, status] of [['kasa_koptu', 410], ['kasa_yok', 404], ['invalid_token', 401]]) {
  hazirla({ traktAccessToken: 'e', kaymakOturum: 'o' });
  cevaplar = [hataYanit(status, kod)];
  T.ok(`${kod} → bitti`, (await O.traktOturumunuYenile()).tur === 'bitti');
}
hazirla({ traktAccessToken: 'e' });
T.ok('Oturum da eski anahtar da yok → bitti, istek yok', (await O.traktOturumunuYenile()).tur === 'bitti' && istekler.length === 0);

T.H('Eski cihaz: tek seferlik tasima');
hazirla({ traktAccessToken: 'e-eski', traktRefreshToken: 'y-eski' });
cevaplar = [oturumCevabi('e-yeni', 'o-yeni', { tasindi: true })];
let t = await O.eskiAnahtariTasi();
T.ok('Tasinir: yerel yenileme anahtari SILINIR, erisim + oturum yazilir', t.tur === 'tamam' && !depo.has('traktRefreshToken') && depo.get('kaymakOturum') === 'o-yeni' && depo.get('traktAccessToken') === 'e-yeni');
T.ok('Istek /auth/trakt/tasi, erisim + yenileme', istekler[0].yol === '/auth/trakt/tasi' && istekler[0].govde.traktAccessToken === 'e-eski' && istekler[0].govde.yenileme === 'y-eski');
hazirla({ traktAccessToken: 'e', kaymakOturum: 'o' });
T.ok('Yenileme anahtari yoksa tasima yok (ag istegi yok)', (await O.eskiAnahtariTasi()) === null && istekler.length === 0);
hazirla({ traktAccessToken: 'e', traktRefreshToken: 'y' });
cevaplar = [hataYanit(503, 'tekrar_dene')];
t = await O.eskiAnahtariTasi();
T.ok('Gecici hatada anahtar SILINMEZ (sonra yeniden denenir)', t.tur === 'gecici' && depo.get('traktRefreshToken') === 'y');
hazirla({ traktAccessToken: 'e', traktRefreshToken: 'y-olu' });
cevaplar = [hataYanit(409, 'tasi_gecersiz')];
t = await O.eskiAnahtariTasi();
T.ok('tasi_gecersiz: olu anahtar silinir, erisim durur (acilista cikis YOK)', t.tur === 'gecersiz' && !depo.has('traktRefreshToken') && depo.get('traktAccessToken') === 'e');

T.H('401 aninda eski cihaz');
hazirla({ traktAccessToken: 'e', traktRefreshToken: 'y' });
cevaplar = [oturumCevabi('e-yeni')];
T.ok('Once tasir', (await O.traktOturumunuYenile()).erisim === 'e-yeni' && istekler.length === 1 && istekler[0].yol === '/auth/trakt/tasi');
hazirla({ traktAccessToken: 'e', traktRefreshToken: 'y-olu' });
cevaplar = [hataYanit(409, 'tasi_gecersiz')];
T.ok('Anahtar olu, oturum yok → bitti (kisi giris yapar)', (await O.traktOturumunuYenile()).tur === 'bitti');
hazirla({ traktAccessToken: 'e', traktRefreshToken: 'y-olu', kaymakOturum: 'o-kardes' });
cevaplar = [hataYanit(409, 'tasi_gecersiz'), oturumCevabi('e-kardes')];
T.ok('Yan sekme tasimis: anahtar olu ama oturum var → kasadan alir, cikis YOK', (await O.traktOturumunuYenile()).erisim === 'e-kardes');

T.H('Yeni giris: bilet ile oturum (kod harcandi, yeniden denenir)');
hazirla();
cevaplar = [hataYanit(503, 'tekrar_dene'), oturumCevabi('e-1', 'o-1')];
const g = await O.girisOturumuAc('e-1', 'bilet');
T.ok('Gecici hatada ayni biletle yeniden dener', g.kaymakOturum === 'o-1' && istekler.length === 2 && istekler[1].govde.kasaBileti === 'bilet');
hazirla();
cevaplar = [hataYanit(400, 'bilet_gecersiz')];
let firladi = null;
try { await O.girisOturumuAc('e-1', 'bozuk'); } catch (e) { firladi = e; }
T.ok('Kalici hatada yeniden denemez, kodu tasir', firladi?.kod === 'bilet_gecersiz' && istekler.length === 1);

T.H('Hesap Sec sonrasi oturum');
const YENI = { access: 'e-yeni', kasaBileti: 'b' };
T.ok('trakt_ile_gir → giris', (await O.hesapSecSonrasiOturum({ oturum: 'trakt_ile_gir', kalanBenMiyim: false }, undefined, 'e')) === 'giris');
T.ok('yeni_trakt, bilet yok → giris', (await O.hesapSecSonrasiOturum({ oturum: 'yeni_trakt', kalanBenMiyim: true }, undefined, 'e')) === 'giris');
T.ok('ayni + kalan benim → ayni (istek yok)', (hazirla(), await O.hesapSecSonrasiOturum({ oturum: 'ayni', kalanBenMiyim: true }, undefined, 'e')) === 'ayni' && istekler.length === 0);
hazirla(); cevaplar = [oturumCevabi('e-yeni', 'o-b')];
let h = await O.hesapSecSonrasiOturum({ oturum: 'yeni_trakt', kalanBenMiyim: false }, YENI, 'e');
T.ok('yeni_trakt → biletle oturum', h.access === 'e-yeni' && h.oturum.kaymakOturum === 'o-b' && istekler[0].yol === '/auth/trakt/oturum');
hazirla(); cevaplar = [oturumCevabi('e-kasa', 'o-b')];
h = await O.hesapSecSonrasiOturum({ oturum: 'ayni', kalanBenMiyim: false }, undefined, 'e-cihaz');
T.ok('ayni + kalan baskasi → kasadan: KASANIN erisimi kullanilir, yenileme anahtari gonderilmez', h.access === 'e-kasa' && istekler[0].yol === '/auth/trakt/tasi' && !('yenileme' in istekler[0].govde));
hazirla(); cevaplar = [hataYanit(404, 'kasa_yok')];
T.ok('Kasa yoksa → giris (silme bitti, kisi bir kez Trakt\'a girer)', (await O.hesapSecSonrasiOturum({ oturum: 'ayni', kalanBenMiyim: false }, undefined, 'e')) === 'giris');

T.H('Kaynak denetimi');
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const dosyalar = ['services/api/traktClient.ts', 'features/feed/services/feedPublish.ts', 'hooks/useHesapSec.ts', 'hooks/useTraktBaglamaTamamla.ts', 'app/(public)/settings.tsx'];
T.ok('🔴 Yenileme anahtarinin Pi yolu istemcide KALMADI', !fs.existsSync(path.join(root, 'services/api/auth.ts')) && dosyalar.every((f) => !/refreshTraktToken|exchangeAuthCode|\/api\/trakt['"`]/.test(oku(f))));
T.ok('🔴 Cihaza yenileme anahtari YAZILMAZ', !/setItemAsync\('traktRefreshToken'/.test(oku('context/AuthContext.tsx')) && dosyalar.every((f) => !/setItemAsync\('traktRefreshToken'/.test(oku(f))));
const istemci = oku('services/api/traktClient.ts');
T.ok('Tek yenileme yolu: traktClient kuyruk tutmaz, tek ucus', !/isRefreshing|failedQueue/.test(istemci) && /yenilemeUcusu/.test(istemci));
T.ok('Yalniz «bitti» oturumu kapatir', istemci.indexOf("sonuc.tur === 'gecici'") < istemci.indexOf('notifySessionExpired();\n  throw err') && (istemci.match(/^\s*notifySessionExpired\(\);/gm) || []).length === 1);
T.ok('Yeni erisimde eski istemci atilir (bayat baslik kalmaz)', /cachedInstance = null;/.test(istemci.slice(istemci.indexOf('const erisimiUygula'), istemci.indexOf('let yenilemeUcusu'))));
const auth = oku('context/AuthContext.tsx');
T.ok('Acilista eski cihaz gecisi (Google-only degilse)', /if \(providerRaw !== 'google'\) void eskiCihazGecisi\(\);/.test(auth));
T.ok('Cikis ve Google oturumu kasa oturumunu da siler', (auth.match(/deleteItemAsync\('kaymakOturum'\)/g) || []).length === 2);
const koruyucu = tsLoader(root, { axios: { __esModule: true, default: { interceptors: { response: { use() {} } } } }, '../../utils/secureStorage': SecureStore, './traktClient': { isKaymakSessionToken: (t) => String(t).startsWith('kaymak_session_v1.') }, '../auth/oturumDenetimi': { hesapGecersizBildir() {} } })('services/api/workerYanitKoruyucu.ts');
T.ok('/auth/trakt/* 401\'i «hesap silindi» cikisi tetiklemez', !koruyucu.hesapGecersizYanitiMi(`${W}/auth/trakt/oturum`, 401, 'invalid_token', 'kaymak_session_v1.x'));
T.ok('Baska Worker ucunda koruma suruyor', koruyucu.hesapGecersizYanitiMi(`${W}/feed/post`, 401, 'invalid_token', 'kaymak_session_v1.x'));

T.bitir();

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tsLoader } from '../ts-test-loader.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = require('../yardimci').baslat('TRAKT WEB OAUTH PKCE', { kokOneki: 'oauth-state-' });

const depo = new Map();
const callback = 'https://kaymaktv.com/settings';
let adres = new URL(callback);
let yonlendirme;
let yazmadanYonlendirdi;
const ortakDepo = {
  getItem: (k) => depo.get(k) ?? null,
  setItem: (k, v) => { depo.set(k, v); },
  removeItem: (k) => { depo.delete(k); },
};
let kilitSirasi = Promise.resolve();
const window = {
  localStorage: ortakDepo,
  navigator: {
    locks: {
      request(_ad, islem) {
        const sonuc = kilitSirasi.then(islem);
        kilitSirasi = sonuc.catch(() => {});
        return sonuc;
      },
    },
  },
  location: {
    get href() { return adres.href; },
    get origin() { return adres.origin; },
    assign(url) {
      yazmadanYonlendirdi = depo.size === 0;
      yonlendirme = new URL(url);
    },
  },
  history: {
    state: { test: true },
    replaceState(state, _, yol) {
      this.state = state;
      adres = new URL(yol, adres);
    },
  },
};

const verifier = 'v'.repeat(43);
const digerVerifier = 'a'.repeat(128);
const state = 'Ab3dEf9hIj';
const platform = { OS: 'web' };
const uyarilar = [];
const istekler = [];
const girisler = [];
const onGiris = async (giris) => { girisler.push(giris); };
let config;
let istekSayisi = 0;
class SahteAuthRequest {
  constructor(ayar) {
    config = ayar;
    this.state = 'web-deneme-' + ++istekSayisi;
    this.codeVerifier = this.state.padEnd(43, 'v');
  }
  async makeAuthUrlAsync({ authorizationEndpoint }) {
    const params = new URLSearchParams({ state: this.state, redirect_uri: config.redirectUri });
    return authorizationEndpoint + '?' + params;
  }
}
const yukle = (sekme = window) => tsLoader(root, {
  react: {
    useEffect: (fn) => fn(),
    useRef: (current) => ({ current }),
    useState: (initial) => [initial, () => {}],
  },
  'react-native': { Platform: platform },
  'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
  'expo-auth-session': {
    AuthRequest: SahteAuthRequest,
    ResponseType: { Code: 'code' },
    CodeChallengeMethod: { S256: 'S256' },
  },
  axios: {
    __esModule: true,
    default: { post: async (url, data) => {
      istekler.push({ url, data });
      return { data: { success: true, erisim: 'test-erisim' } };
    } },
  },
  '../services/auth/traktHesapKilidi': {
    zorunluGirisAdresi: (url) => url + '&prompt=login',
  },
  '../utils/confirmDialog': { notify: (_, metin) => uyarilar.push(metin) },
  '../utils/errorLog': { logWarning() {} },
}, { window: sekme, URL });
const { oauthStateKaydet, oauthStateTuket } = yukle()('services/oauthState.ts');
const ekraniAc = () => yukle()('hooks/useTraktWebGirisi.ts').useTraktWebGirisi(onGiris);
const bekle = () => new Promise(setImmediate);

T.H('Ayni kokende sureli ve tek kullanimlik state/verifier');
await oauthStateKaydet(state, verifier, 1000);
await oauthStateKaydet('ikinciDen02', digerVerifier, 2000);
T.ok('Eksik ve eslesmeyen state reddedilir', await oauthStateTuket(null, 3000) === null && await oauthStateTuket('uyusmayan01', 3000) === null);
const ikiDonus = await Promise.all([oauthStateTuket(state, 3000), oauthStateTuket(state, 3000)]);
T.ok('Eszamanli iki donusten yalniz biri eslesen verifier degerini alir', ikiDonus[0] === verifier && ikiDonus[1] === null);
T.ok('Ikinci deneme kendi verifier degerini korur', await oauthStateTuket('ikinciDen02', 3000) === digerVerifier && depo.size === 0);
for (let n = 0; n < 4; n++) await oauthStateKaydet('deneme000' + n, verifier, 10_000 + n);
T.ok('En fazla son uc deneme saklanir', await oauthStateTuket('deneme0000', 10_010) === null && await oauthStateTuket('deneme0001', 10_010) === verifier);
T.ok('10 dakika dolunca kayit reddedilir ve temizlenir',
  await oauthStateTuket('deneme0003', 10_003 + 10 * 60 * 1000) === null && depo.size === 0);
depo.clear();

T.H('Yonlendirme ve soguk web donusu');
await ekraniAc().baslat(true);
const donusState = yonlendirme.searchParams.get('state');
T.ok('AuthRequest S256 ister ve HTTPS adresine doner', config.usePKCE === true && config.codeChallengeMethod === 'S256'
  && config.redirectUri === callback && yonlendirme.origin === 'https://auth.trakt.tv');
T.ok('State/verifier yonlendirmeden once saklanir ve kart prompt=login tasir', !yazmadanYonlendirdi && yonlendirme.searchParams.get('prompt') === 'login');
await ekraniAc().baslat(false);
T.ok('Yeni deneme farkli verifier ve state uretir', yonlendirme.searchParams.get('state') !== donusState);

adres = new URL(callback + '?code=yetki-kodu&state=' + donusState);
const yeniSekme = { ...window, localStorage: { ...ortakDepo } };
yukle(yeniSekme)('hooks/useTraktWebGirisi.ts').useTraktWebGirisi(onGiris);
await bekle();
T.ok('Yeni sekmedeki soguk donus ilk denemenin verifier degerini Worker JSON govdesine koyar', istekler.length === 1
  && istekler[0].url === 'https://worker.invalid/auth/trakt/degis'
  && JSON.stringify(istekler[0].data) === JSON.stringify({ code: 'yetki-kodu', redirect_uri: callback, code_verifier: donusState.padEnd(43, 'v') }));
T.ok('Basarida ortak giris calisir ve callback sorgusu temizlenir', girisler.length === 1 && adres.href === callback && window.history.state.test);
for (const query of ['?code=yetki-kodu&state=' + donusState, '?code=yetki-kodu', '?code=yetki-kodu&state=uyusmayan01']) {
  adres = new URL(callback + query);
  ekraniAc();
  await bekle();
}
T.ok('Tekrar, eksik ve yanlis state ile ag istegi yok', istekler.length === 1 && uyarilar.length === 3);

const iptalState = yonlendirme.searchParams.get('state');
adres = new URL(callback + '?error=access_denied&state=' + iptalState);
ekraniAc();
await bekle();
T.ok('Iptal eslesen verifier degerini siler ve kod degistirmez', istekler.length === 1 && await oauthStateTuket(iptalState) === null && uyarilar.at(-1) === 'loginCanceled');

adres = new URL('https://www.kaymaktv.com/settings?code=www-kod&state=www-state');
await oauthStateKaydet('www-state', verifier);
const www = ekraniAc();
await www.baslat(false);
await bekle();
T.ok('www kokeninde web OAuth baslamaz ve callback tuketilmez', !www.etkin && istekSayisi === 2
  && istekler.length === 1 && await oauthStateTuket('www-state') === verifier);

platform.OS = 'android';
adres = new URL(callback + '?code=yerel-kod&state=android-state');
await oauthStateKaydet('android-state', verifier);
const native = ekraniAc();
await native.baslat(false);
await bekle();
T.ok('Native web OAuth istegi baslatmaz ve callback tuketmez', !native.etkin && istekSayisi === 2 && istekler.length === 1 && await oauthStateTuket('android-state') === verifier);
T.bitir();

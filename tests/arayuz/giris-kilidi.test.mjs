import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tsLoader } from '../ts-test-loader.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = require('../yardimci').baslat('GIRIS KILIDI (GIRIS-KILIT-01 · kart hesabi Trakt donusunde)', { kokOneki: 'giris-kilidi-' });

const depo = new Map();
const AsyncStorage = {
  getItem: async (k) => (depo.has(k) ? depo.get(k) : null),
  setItem: async (k, v) => { depo.set(k, v); },
  removeItem: async (k) => { depo.delete(k); },
};
let traktCevabi = null;
let istekler = [];
const axios = {
  get: async (url, opt) => {
    istekler.push({ url, opt });
    if (traktCevabi instanceof Error) throw traktCevabi;
    return { data: traktCevabi };
  },
};
const K = tsLoader(root, {
  '@react-native-async-storage/async-storage': { __esModule: true, default: AsyncStorage },
  axios: { __esModule: true, default: axios },
})('services/auth/traktHesapKilidi.ts');

const UUID_GERCEK = 'a'.repeat(40), UUID_TEST = 'b'.repeat(40);
const ARDAGNL = { username: 'ArdaGnl', kaymakNo: 10241355, traktSlug: 'ardagnl', traktUuid: UUID_GERCEK };
const ayarlar = (slug, uuid) => ({ user: { username: slug, ids: { slug, uuid } } });

T.H('Saf karar');
T.ok('uuid ayni -> uyusuyor', K.traktHesabiUyusuyor(ARDAGNL, { slug: 'ardagnl', uuid: UUID_GERCEK }));
T.ok('🔴 T1: kart @ArdaGnl, gelen Trakt_test -> UYUSMAZ', !K.traktHesabiUyusuyor(ARDAGNL, { slug: 'ardagunalfb2001-test1-870ac6', uuid: UUID_TEST }));
T.ok('uuid iki tarafta varsa ad DEGIL uuid belirler (Trakt\'ta ad degismis)', K.traktHesabiUyusuyor(ARDAGNL, { slug: 'yeni-ad', uuid: UUID_GERCEK }));
T.ok('uuid ayni ad ama farkli uuid -> uyusmaz', !K.traktHesabiUyusuyor(ARDAGNL, { slug: 'ardagnl', uuid: UUID_TEST }));
T.ok('Beklenende uuid yok (eski satir) -> ad, harf duyarsiz', K.traktHesabiUyusuyor({ ...ARDAGNL, traktUuid: null }, { slug: 'ArdaGnl', uuid: UUID_TEST }));
T.ok('Karsilastirilacak hicbir sey yok -> uyusmaz (guvenli taraf)', !K.traktHesabiUyusuyor({ ...ARDAGNL, traktSlug: null, traktUuid: null }, { slug: 'x', uuid: null }));

T.H('Beklenti: kaydet / tuket / sil');
depo.clear();
await K.beklenenTraktHesabiKaydet(ARDAGNL);
const okunan = await K.beklenenTraktHesabiTuket();
T.ok('Kaydedilen geri okunur', okunan?.traktUuid === UUID_GERCEK && okunan?.username === 'ArdaGnl');
T.ok('Tek kullanimlik: ikinci okuma bos', (await K.beklenenTraktHesabiTuket()) === null && depo.size === 0);
await K.beklenenTraktHesabiKaydet({ username: 'Eski', kaymakNo: null, traktSlug: null, traktUuid: null });
T.ok('Trakt kimligi yoksa (eski Worker) beklenti YAZILMAZ -> bugunku davranis', depo.size === 0);
await K.beklenenTraktHesabiKaydet(ARDAGNL);
await K.beklenenTraktHesabiSil();
T.ok('Duz Trakt girisi beklentiyi siler', depo.size === 0);
await K.beklenenTraktHesabiKaydet(ARDAGNL);
const [anahtar] = [...depo.keys()];
depo.set(anahtar, JSON.stringify({ ...ARDAGNL, kaydedildi: Date.now() - 16 * 60 * 1000 }));
T.ok('15 dk\'dan eski beklenti yok sayilir', (await K.beklenenTraktHesabiTuket()) === null);
depo.set(anahtar, '{bozuk');
T.ok('Bozuk kayit yok sayilir (cokmez)', (await K.beklenenTraktHesabiTuket()) === null);

T.H('Denetim (token kaydedilmeden once)');
depo.clear(); istekler = [];
T.ok('Beklenti yok -> serbest, Trakt\'a HIC sorulmaz', (await K.traktHesapKilidiDenetle('tok')).durum === 'serbest' && istekler.length === 0);
await K.beklenenTraktHesabiKaydet(ARDAGNL);
traktCevabi = ayarlar('ardagunalfb2001-test1-870ac6', UUID_TEST);
const sonuc = await K.traktHesapKilidiDenetle('yeni-token');
T.ok('🔴 T1 senaryosu -> uyusmazlik + beklenen/gelen', sonuc.durum === 'uyusmazlik' && sonuc.beklenen.username === 'ArdaGnl' && sonuc.gelen.slug === 'ardagunalfb2001-test1-870ac6');
const [ist] = istekler;
T.ok('Trakt\'a Pi koprusunden /users/settings, YENI token basligi ile', /\/api\/trakt-proxy$/.test(ist.url) && ist.opt.params.endpoint === '/users/settings' && ist.opt.headers.Authorization === 'Bearer yeni-token');
await K.beklenenTraktHesabiKaydet(ARDAGNL);
traktCevabi = ayarlar('ardagnl', UUID_GERCEK);
T.ok('Dogru hesap -> uyusuyor', (await K.traktHesapKilidiDenetle('tok')).durum === 'uyusuyor');
await K.beklenenTraktHesabiKaydet(ARDAGNL);
traktCevabi = new Error('Network Error');
let firladi = false;
try { await K.traktHesapKilidiDenetle('tok'); } catch { firladi = true; }
T.ok('Trakt\'a ulasilamazsa HATA firlar (cagiran oturum acmaz)', firladi);
await K.beklenenTraktHesabiKaydet(ARDAGNL);
traktCevabi = { user: {} };
firladi = false;
try { await K.traktHesapKilidiDenetle('tok'); } catch { firladi = true; }
T.ok('Trakt kimlik vermezse HATA firlar', firladi);

T.H('Worker cevabi suzgeci');
const G = tsLoader(root, { axios: { __esModule: true, default: axios } })('services/api/googleAuth.ts');
const h = G.bagliHesap({ username: 'ArdaGnl', kaymakNo: 10241355, traktSlug: 'ardagnl', traktUuid: UUID_GERCEK });
T.ok('traktSlug + traktUuid tasinir', h.traktSlug === 'ardagnl' && h.traktUuid === UUID_GERCEK);
const eski = G.bagliHesap({ username: 'ArdaGnl', kaymakNo: 10241355 });
T.ok('Eski Worker (alan yok) -> null, cokmez', eski.traktSlug === null && eski.traktUuid === null);

T.H('Ekran kaynagi');
const ekran = fs.readFileSync(path.join(root, 'app/(public)/settings.tsx'), 'utf8');
const govde = ekran.slice(ekran.indexOf('const handleTokenExchange'));
const i = (s) => govde.indexOf(s);
T.ok('Kilit token degisiminden SONRA, baglama/Google baglama/saveTokens\'tan ONCE',
  i('exchangeAuthCode(code') > -1 && i('traktHesapKilidiDenetle(tokenData.access_token)') > i('exchangeAuthCode(code')
  && i('traktHesapKilidiDenetle(') < i('traktBaglamaTamamla(tokenData)')
  && i('traktHesapKilidiDenetle(') < i('completeGoogleLinkIfPending(')
  && i('traktHesapKilidiDenetle(') < i('saveTokens('));
const uyusmazlikDali = govde.slice(i("kilit.durum === 'uyusmazlik'"), i('traktBaglamaTamamla(tokenData)'));
T.ok('Uyusmazlikta uyari + return; token KAYDEDILMEZ', /notify\(/.test(uyusmazlikDali) && /return;/.test(uyusmazlikDali) && !/saveTokens|router\.replace/.test(uyusmazlikDali));
T.ok('Kart dugmesi beklentiyi saklayan yolu kullanir', /onTraktIleDevam=\{handleKartlaTraktGiris\}/.test(ekran)
  && /handleKartlaTraktGiris = async \(\) => \{\s+await beklenenTraktHesabiKaydet\(google\.bagliHesap\);\s+await traktGirisiniBaslat\(\);/.test(ekran));
T.ok('Duz Trakt dugmesi beklentiyi SILER', /handleTraktLogin = async \(\) => \{\s+await beklenenTraktHesabiSil\(\);\s+await traktGirisiniBaslat\(\);/.test(ekran)
  && /<TraktGirisDugmesi[^>]*onPress=\{handleTraktLogin\}/.test(ekran));
const kutu = fs.readFileSync(path.join(root, 'components/auth/TraktIleGirKutusu.tsx'), 'utf8');
T.ok('Kart beklenen Trakt hesabini gosterir', /settings:kartTraktHesabi/.test(kutu) && /hesap!\.traktSlug/.test(kutu));

T.H('Ceviri (TR + EN)');
for (const dil of ['tr', 'en']) {
  const j = JSON.parse(fs.readFileSync(path.join(root, `locales/${dil}/settings.json`), 'utf8'));
  T.ok(`${dil}: uyari basligi + metni + kart satiri, degiskenler tam`,
    !!j.traktUyusmazlikBaslik && ['{{ad}}', '{{beklenen}}', '{{gelen}}'].every((d) => j.traktUyusmazlikMetin?.includes(d)) && j.kartTraktHesabi?.includes('{{slug}}'));
}
T.bitir();

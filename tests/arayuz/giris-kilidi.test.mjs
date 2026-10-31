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

T.H('GIRIS-KILIT-02 · e-posta + deneme sayisi yonlendirmeden sag cikar');
depo.clear();
await K.beklenenTraktHesabiKaydet({ ...ARDAGNL, googleEmail: 'ardagunalfb2001@gmail.com', deneme: 1 });
const k2 = await K.beklenenTraktHesabiTuket();
T.ok('Google e-postasi ve deneme sayisi geri okunur', k2?.googleEmail === 'ardagunalfb2001@gmail.com' && k2?.deneme === 1);
T.ok('E-posta okununca cihazdan SILINIR (tek kullanimlik)', depo.size === 0);
await K.beklenenTraktHesabiKaydet({ ...ARDAGNL, deneme: -3 });
T.ok('Bozuk deneme sayisi 0 sayilir', (await K.beklenenTraktHesabiTuket())?.deneme === 0);

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
traktCevabi = { user: { name: 'Arda Test', ids: { slug: 'ardagunalfb2001-test1-870ac6', uuid: UUID_TEST }, images: { avatar: { full: 'https://secure.gravatar.com/avatar/x' } } } };
const s3 = await K.traktHesapKilidiDenetle('tok');
T.ok('Trakt gorunen adi + profil resmi ekrana tasinir', s3.gelen.ad === 'Arda Test' && s3.gelen.avatar === 'https://secure.gravatar.com/avatar/x');
await K.beklenenTraktHesabiKaydet(ARDAGNL);
traktCevabi = { user: { ids: { slug: 'x', uuid: UUID_TEST }, images: { avatar: { full: 'javascript:alert(1)' } } } };
T.ok('https olmayan resim adresi kullanilmaz', (await K.traktHesapKilidiDenetle('tok')).gelen.avatar === null);
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
T.ok('Uyusmazlikta tam sayfa ekran + return; token KAYDEDILMEZ', /setUyusmazlik\(\{ beklenen: kilit\.beklenen, gelen: kilit\.gelen \}\)/.test(uyusmazlikDali) && /return;/.test(uyusmazlikDali) && !/saveTokens|router\.replace|notify\(/.test(uyusmazlikDali));
T.ok('Uyusmazlik gunlugu kimlik tasimaz (yalniz deneme sayisi)', /logWarning\('girisKilidi\.uyusmazlik', new Error\('trakt_hesap_uyusmazligi'\), \{ deneme: String\(kilit\.beklenen\.deneme\) \}\)/.test(uyusmazlikDali));
T.ok('Kart dugmesi beklentiyi saklar ve Trakt girisini ZORLAR', /onTraktIleDevam=\{handleKartlaTraktGiris\}/.test(ekran)
  && /handleKartlaTraktGiris = async \(\) => \{\s+if \(google\.bagliHesap\) await beklenenTraktHesabiKaydet\(\{ \.\.\.google\.bagliHesap, deneme: 0 \}\);\s+else await beklenenTraktHesabiSil\(\);\s+await traktGirisiniBaslat\(true\);/.test(ekran));
T.ok('Duz Trakt dugmesi beklentiyi SILER, zorlamaz', /handleTraktLogin = async \(\) => \{\s+await beklenenTraktHesabiSil\(\);\s+await traktGirisiniBaslat\(false\);/.test(ekran)
  && /<TraktGirisDugmesi[^>]*onPress=\{handleTraktLogin\}/.test(ekran));
T.ok('Tekrar dene: deneme +1, zorunlu giris', /handleTekrarDene = async \(\) => \{\s+if \(!uyusmazlik\) return;\s+await beklenenTraktHesabiKaydet\(\{ \.\.\.uyusmazlik\.beklenen, deneme: uyusmazlik\.beklenen\.deneme \+ 1 \}\);[\s\S]{0,80}traktGirisiniBaslat\(true\)/.test(ekran));
T.ok('Web ve APK ayni zorunlu adresi kullanir', /window\.location\.href = adres;/.test(ekran) && /promptAsync\(adres && zorunluGiris \? \{ url: adres \} : undefined\)/.test(ekran) && /zorunluGirisAdresi\(request\.url\)/.test(ekran));
T.ok('Ekran acikken diger secenekler ve Google dugmesi gizli (Google SOKULMEZ)', /const kutuAcik = \(GOOGLE_GIRIS_ACIK && google\.durum === 'trakt_ile_gir'\) \|\| uyariAcik;/.test(ekran) && /giris=\{google\} gizli=\{uyariAcik\}/.test(ekran));
const gdugme = fs.readFileSync(path.join(root, 'components/auth/GoogleGirisDugmesi.tsx'), 'utf8');
T.ok('Madde 231: Google sarmalayicisi kosulsuz, gizleme yalniz display:none', /<View style=\{props\.gizli \? styles\.tamGizli : undefined\}>/.test(gdugme) && /tamGizli: \{ display: 'none' \}/.test(gdugme));
const kutu = fs.readFileSync(path.join(root, 'components/auth/TraktIleGirKutusu.tsx'), 'utf8');
T.ok('Kart Google e-postasini + Trakt adini + ne yapacagini gosterir', /settings:kartTraktHesabi/.test(kutu) && /settings:uyusmazlikGoogleSatiri/.test(kutu) && /settings:traktIleDevamKutuTraktli/.test(kutu));
const uyari = fs.readFileSync(path.join(root, 'components/auth/TraktHesapUyusmazligiEkrani.tsx'), 'utf8');
T.ok('Uyari ekrani: tek birincil dugme + ikincil baglanti, «@X ile devam» YOK', (uyari.match(/onPress=/g) || []).length === 2 && /onTekrarDene/.test(uyari) && /onBaskaYol/.test(uyari) && !/ileDevamEt|devamEt\b/.test(uyari));
T.ok('Ikinci denemede rehber', /const rehber = beklenen\.deneme >= 1;/.test(uyari) && /rehberAdim1/.test(uyari) && /rehberAdim3/.test(uyari));

T.H('Zorunlu giris adresi (saf)');
T.ok('prompt=login eklenir, state korunur', K.zorunluGirisAdresi('https://trakt.tv/oauth/authorize?client_id=x&state=Ab3dEf9hIj') === 'https://trakt.tv/oauth/authorize?client_id=x&state=Ab3dEf9hIj&prompt=login');
T.ok('Zaten prompt varsa iki kez eklenmez', K.zorunluGirisAdresi('https://t/a?prompt=login') === 'https://t/a?prompt=login');
T.ok('Soru isareti yoksa ? ile eklenir', K.zorunluGirisAdresi('https://t/a') === 'https://t/a?prompt=login');

T.H('Ceviri (TR + EN)');
const anahtarlar = ['traktIleDevamKutuTraktli', 'uyusmazlikBaslik', 'uyusmazlikAlt', 'uyusmazlikIstenen', 'uyusmazlikSecilen', 'uyusmazlikGoogleSatiri', 'uyusmazlikTekrarDene', 'uyusmazlikIpucu', 'uyusmazlikBaskaYol', 'rehberBaslik', 'rehberAdim1', 'rehberAdim2', 'rehberAdim3', 'kartTraktHesabi'];
for (const dil of ['tr', 'en']) {
  const j = JSON.parse(fs.readFileSync(path.join(root, `locales/${dil}/settings.json`), 'utf8'));
  T.ok(`${dil}: ${anahtarlar.length} anahtar dolu, degiskenler tam, eski diyalog metni silindi`,
    anahtarlar.every((k) => typeof j[k] === 'string' && j[k].trim())
    && ['traktIleDevamKutuTraktli', 'uyusmazlikIpucu', 'rehberAdim2'].every((k) => j[k].includes('<1>{{trakt}}</1>'))
    && j.uyusmazlikGoogleSatiri.includes('{{email}}') && j.kartTraktHesabi.includes('{{slug}}')
    && !('traktUyusmazlikBaslik' in j) && !('traktUyusmazlikMetin' in j));
}
T.bitir();

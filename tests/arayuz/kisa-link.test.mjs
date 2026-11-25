import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// Kimlik Faz 6 (M522) · D7 — kaymaktv.com/u/<KaymakNo>. Kullanıcı: «ücretsiz şekilde mantıklı».
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('KISA PROFIL BAGLANTISI /u/<KaymakNo> (Kimlik Faz 6 · M522)', { kokOneki: 'kisa-link-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { profilPaylasimLinki } = tsLoader(root)('utils/kaymakNo.ts');

T.H('Baglanti');
T.ok('Gecerli numara → https://kaymaktv.com/u/<no>', profilPaylasimLinki(10337897) === 'https://kaymaktv.com/u/10337897');
T.ok('Gecersiz/eksik numara → null (dugme cizilmez)', [null, undefined, 1234, 100000000, 10.5].every((n) => profilPaylasimLinki(n) === null));

T.H('Rota /u/[id]');
const kanca = oku('hooks/useKaymakNoYonlendir.ts');
T.ok('Rota var ve yalniz yonlendiriyor', fs.existsSync(path.join(root, 'app/u/[id].tsx')) && /useKaymakNoYonlendir\(no\)/.test(oku('app/u/[id].tsx')));
T.ok('🔴 Girissiz/misafir → giris ekrani, numara SORULMAZ (D6)', kanca.indexOf("router.replace('/(public)/settings')") > -1 && kanca.indexOf("router.replace('/(public)/settings')") < kanca.indexOf('kaymakNoCoz('));
T.ok('Girisli → /user/<ad> (gizlilik kurallari orada)', /router\.replace\(`\/user\/\$\{encodeURIComponent\(sonuc\)\}`\)/.test(kanca));
T.ok('Yok / goruntulenemez ayri metin (engel sizmaz: ad yok)', /setDurum\(sonuc\)/.test(kanca));

T.ok('🔴 Kendi numaram → herkese acik ekran degil, kendi Profil sekmem (canli bulgu M522: «Follow» cikiyordu)',
  ['screens/PublicProfileMobile.tsx', 'app/(protected)/user/[slug].web.tsx'].every((f) => /useKendiProfilineYonlendir\(kaymakProfil\?\.kendisi\)/.test(oku(f))) &&
  /if \(kendisi\) router\.replace\('\/\(protected\)\/\(tabs\)\/profile'\)/.test(oku('hooks/useKendiProfilineYonlendir.ts')));

T.H('Paylasim + App Links');
// 1.0.1 Dal 2 (2026-11-15): paylas numara etiketinden «Profili Duzenle» / «Takip Et» yanindaki
// ayri dugmeye tasindi; mantik `hooks/useProfilEylemleri.ts` (`useProfilPaylas`).
const paylas = oku('hooks/useProfilEylemleri.ts');
T.ok('Profil paylasimi ortak adaptoru ve panoya kopyalandi geri bildirimini kullanir',
  /usePaylasim\(\)/.test(paylas) && /paylasHedefi\(\{ tur: 'u', id: kaymakNo \}/.test(paylas) && /sonuc === 'kopyalandi'/.test(paylas));

T.H('Paylasim adaptoru birim testleri');
const hedef = { tur: 'u', id: 10337897 };
const link = profilPaylasimLinki(hedef.id);
const metin = 'KaymakTV';
function adaptor(platform, navigator, { nativeShare, kopyala } = {}) {
  const yukle = tsLoader(root, {
    react: { useCallback: (callback) => callback },
    'react-native': { Platform: { OS: platform }, Share: { share: nativeShare, dismissedAction: 'dismissedAction' } },
    'expo-clipboard': { setStringAsync: kopyala },
  }, { navigator });
  return yukle('hooks/usePaylasim.ts').usePaylasim();
}

let nativeMesaj;
const native = adaptor('android', undefined, {
  nativeShare: async ({ message }) => { nativeMesaj = message; return { action: 'sharedAction' }; },
});
T.ok('Android sistem paylasimi metni ve HTTPS baglantisini alir',
  await native(hedef, metin) === 'paylasildi' && nativeMesaj === metin + '\n' + link);

const nativeIptal = adaptor('android', undefined, { nativeShare: async () => ({ action: 'dismissedAction' }) });
T.ok('Sistem paylasim sayfasi kapatilinca iptal doner', await nativeIptal(hedef, metin) === 'iptal');

let webVerisi;
const web = adaptor('web', { share: async (veri) => { webVerisi = veri; } });
T.ok('Web Share metni ve URL alanini ayri alir',
  await web(hedef, metin) === 'paylasildi' && webVerisi?.url === link && webVerisi?.text === metin);

let kopyalanan;
const pano = adaptor('web', { canShare: () => false, share: () => { throw new Error('Desteklenmiyor'); } }, {
  kopyala: async (veri) => { kopyalanan = veri; return true; },
});
T.ok('Web Share desteklenmiyorsa sadece URL panoya yazilir',
  await pano(hedef, metin) === 'kopyalandi' && kopyalanan === link);

const eksik = adaptor('web', undefined, { kopyala: async () => false });
T.ok('Pano yazimi basarisizsa kopyalandi sonucu donmez', await eksik(hedef, metin) === 'basarisiz');

let iptaldeKopyalandi = false;
const iptal = adaptor('web', { share: async () => { throw new DOMException('Iptal', 'AbortError'); } }, {
  kopyala: async () => { iptaldeKopyalandi = true; return true; },
});
T.ok('Web paylasim iptalinde panoya yazilmaz', await iptal(hedef, metin) === 'iptal' && !iptaldeKopyalandi);

const paylasimHatasi = new Error('Paylasim hatasi');
let kaydedilenHata;
const hataliPaylasim = adaptor('web', { share: async () => { throw paylasimHatasi; } });
T.ok('Paylasim hatasi cagiranin hata kaydina gider',
  await hataliPaylasim(hedef, metin, (hata) => { kaydedilenHata = hata; }) === 'basarisiz' && kaydedilenHata === paylasimHatasi);

kopyalanan = undefined;
T.ok('Gecersiz hedef panoya yazilmaz',
  await pano({ tur: 'u', id: 123 }, metin) === 'basarisiz' && kopyalanan === undefined);
const app = JSON.parse(oku('app.json')).expo.android;
T.ok('App Links /u/ (uygulama yukluyse baglanti uygulamada acilir)', app.intentFilters[0].data.some((d) => d.pathPrefix === '/u/' && d.host === 'kaymaktv.com'));

T.H('Ceviri (TR + EN)');
for (const dil of ['tr', 'en']) {
  const s = JSON.parse(oku(`locales/${dil}/common.json`));
  const eksik = ['profilPaylas', 'profilPaylasMesaj', 'profilLinkKopyalandi', 'kisaLinkYok', 'kisaLinkGorulemez', 'kisaLinkHata', 'kisaLinkAnaSayfa'].filter((k) => !s[k]);
  T.ok(`${dil}: anahtarlar tam`, eksik.length === 0, eksik.join(','));
}
T.bitir();

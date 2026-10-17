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
const etiket = oku('components/profile/KaymakNoEtiketi.tsx');
T.ok('Profil etiketinde paylas: native Share, web share ya da panoya', /profilPaylasimLinki\(no\)/.test(etiket) && /Share\.share\(/.test(etiket) && /nav\.share\(/.test(etiket) && /Clipboard\.setStringAsync\(link\)/.test(etiket));
const app = JSON.parse(oku('app.json')).expo.android;
T.ok('App Links /u/ (uygulama yukluyse baglanti uygulamada acilir)', app.intentFilters[0].data.some((d) => d.pathPrefix === '/u/' && d.host === 'kaymaktv.com'));

T.H('Ceviri (TR + EN)');
for (const dil of ['tr', 'en']) {
  const s = JSON.parse(oku(`locales/${dil}/common.json`));
  const eksik = ['profilPaylas', 'profilPaylasMesaj', 'profilLinkKopyalandi', 'kisaLinkYok', 'kisaLinkGorulemez', 'kisaLinkHata', 'kisaLinkAnaSayfa'].filter((k) => !s[k]);
  T.ok(`${dil}: anahtarlar tam`, eksik.length === 0, eksik.join(','));
}
T.bitir();

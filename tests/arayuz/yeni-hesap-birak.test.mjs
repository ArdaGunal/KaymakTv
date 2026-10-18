import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('YENI HESABI BIRAK LINKI (Kimlik Faz 4b / D4 · M515)', { kokOneki: 'yeni-hesap-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const kanca = oku('hooks/useYeniHesapBirak.ts');
const servis = oku('features/feed/services/accountDeletion.ts');
const ekran = oku('app/(public)/profil-olustur.tsx');

T.H('Ne zaman gorunur');
T.ok('Google girisi kapaliyken hic sorulmaz (tek yol Trakt → link zarar verirdi)', /if \(!GOOGLE_GIRIS_ACIK \|\| !accessToken \|\| isGuest\) return;/.test(kanca));
T.ok('Karar SUNUCUDA: durum ucu birakilabilir === true olmali', servis.includes('/account/yeni-hesap/durum') && /birakilabilir === true/.test(servis));
T.ok('Durum okunamazsa link gizli', /\.catch\(\(\) => canli && setGorunur\(false\)\)/.test(kanca));
T.ok('M536: bilgi kutusu yalniz gorunur iken ciziliyor (soru ekrani degil, D4 / Secenek A)', /\{yeniHesap\.gorunur && \(/.test(ekran) && /t\('settings:zatenHesapEylem'\)/.test(ekran) && /t\('settings:zatenHesapBaslik'\)/.test(ekran));

T.H('Basinca');
const birakI = kanca.indexOf('await yeniHesabiBirak('), cikisI = kanca.indexOf('await removeKeys()');
// M536 — kullanici (2026-10-18): «bu baglantiya bastigi anda yeni_hesabi_birak calissin» → onay sorusu YOK.
T.ok('🔴 M536: onay sorusu YOK — basinca once sunucu, EN SON cikis (Google oturumu da kapanir)', kanca.indexOf('confirmAsync(') === -1 && birakI > -1 && cikisI > birakI);
T.ok('Sunucu reddederse oturum KAPATILMAZ (catch icinde return)', /catch \(hata\) \{[\s\S]*?notify\([\s\S]*?return;\s*\}/.test(kanca.slice(birakI, cikisI)));
T.ok('Cikistan sonra giris ekranina', /router\.replace\('\/settings'\)/.test(kanca));
T.ok('Birak ucu 409\'da hata firlatir', servis.includes('/account/yeni-hesabi-birak') && /if \(!response\.data\?\.success\) throw/.test(servis));

T.H('Ceviri (TR + EN)');
for (const dil of ['tr', 'en']) {
  const s = JSON.parse(oku(`locales/${dil}/settings.json`));
  const eksik = ['yeniHesapLink', 'yeniHesapBirakBaslik', 'yeniHesapBirakMetin', 'yeniHesapBirakOnay', 'yeniHesapBirakHata'].filter((k) => !s[k]);
  T.ok(`${dil}: bes anahtar da var`, eksik.length === 0, eksik.join(','));
}
T.bitir();

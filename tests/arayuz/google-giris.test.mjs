import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = require('../yardimci').baslat('GOOGLE GIRIS DUGMESI (G1 perdesi kalkti · M501)', { kokOneki: 'google-giris-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const var_ = (f) => fs.existsSync(path.join(root, f));

T.H('Gizli kapi kalkti (kullanici 2026-10-12)');
T.ok('gizli-giris ekrani ve useSecretTap silindi', !var_('app/(public)/gizli-giris.tsx') && !var_('hooks/useSecretTap.ts'));
T.ok('Vitrinlerde gizli kapi izi yok', ['app/(public)/index.tsx', 'app/(public)/index.web.tsx'].every((f) => !/useSecretTap|gizli-giris|markaBas/.test(oku(f))));

T.H('Giris ekrani');
const ekran = oku('app/(public)/settings.tsx');
const trakt = ekran.indexOf("t('loginTrakt')"), google = ekran.indexOf('<GoogleGirisDugmesi'), veya = ekran.indexOf('<OrDivider');
T.ok('Google dugmesi Trakt dugmesinin ALTINDA, VEYA ayracinin USTUNDE', trakt > -1 && google > trakt && veya > google);
T.ok('Kullanim kosullari kapisi Google icin de gecerli', /<GoogleGirisDugmesi etkin=\{isChecked/.test(ekran));

T.H('Dugme + mantik');
const dugme = oku('components/auth/GoogleGirisDugmesi.tsx');
const kanca = oku('hooks/useGoogleHesapGiris.ts');
T.ok('Web GIS konteyneri kosulsuz (Madde 231), onay yokken dokunulmaz', /nativeID=\{buttonElementId\}/.test(dugme) && /pointerEvents=\{etkin && durum === 'bos'/.test(dugme));
T.ok('Native dugme onay yokken pasif', /disabled=\{!etkin\}/.test(dugme));
T.ok('Kullanicinin kendi iptali hata sayilmaz', /if \(!sonuc\.cancelled\)/.test(dugme));
T.ok('Tek uc: create_new (hesap varsa sunucu oturum verir)', /createGoogleOnlyAccount\(idToken/.test(kanca) && /saveGoogleSession/.test(kanca));
T.ok('Hata sessiz yutulmaz', /logError\('googleGiris\.createGoogleOnly'/.test(kanca));

T.H('Ceviri');
const tr = JSON.parse(oku('locales/tr/common.json')), en = JSON.parse(oku('locales/en/common.json'));
T.ok('googleSigningIn TR + EN', !!tr.googleSigningIn && !!en.googleSigningIn);
T.bitir();

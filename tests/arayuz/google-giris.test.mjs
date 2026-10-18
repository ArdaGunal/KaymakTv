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
const trakt = ekran.indexOf('<TraktGirisDugmesi'), google = ekran.indexOf('<GoogleGirisDugmesi'), veya = ekran.indexOf('<OrDivider');
T.ok('Google dugmesi Trakt dugmesinin ALTINDA, VEYA ayracinin USTUNDE', trakt > -1 && google > trakt && veya > google);
// M536 (GIRIS-TASARIM-01): iki dugme AYNI olcu — web genisligi tek sabitte, Google cizimi ona bagli.
const td = oku('components/auth/TraktGirisDugmesi.tsx'), gis = oku('hooks/useGoogleSignIn.ts');
const gen = Number((td.match(/GIRIS_DUGME_GENISLIK_WEB = (\d+)/) || [])[1]);
T.ok('M536: webde Trakt ve Google dugmesi AYNI genislik', gen > 0 && new RegExp(`width: ${gen},`).test(gis), String(gen));
T.ok('Kullanim kosullari kapisi Google icin de gecerli', /<GoogleGirisDugmesi etkin=\{isChecked/.test(ekran));
T.ok('M502 Faz 0 + D10: dugme bayraga bagli, bayrak tek yerde', /import \{ GOOGLE_GIRIS_ACIK \} from '..\/..\/utils\/googleGirisBayragi'/.test(ekran) && !/const GOOGLE_GIRIS_ACIK/.test(ekran) && /\{GOOGLE_GIRIS_ACIK && <GoogleGirisDugmesi/.test(ekran));

T.H("D10 → GIRIS-G-02 · once yalniz test APK'si (2026-10-13), sonra herkese (2026-10-17)");
const bayrak = oku('utils/googleGirisBayragi.ts');
// GIRIS-G-02 (kullanici 2026-10-17): «butonu ac ve su an kalsin» — herkese acik, tek yerde.
T.ok('GIRIS-G-02: Google girisi HERKESE ACIK (tek satir, kapatmak = false)', /export const GOOGLE_GIRIS_ACIK = true;/.test(bayrak));
const envDosyalari = ['.env', '.env.local', '.env.production'].filter(var_);
T.ok('.env dosyalarinda bayrak YOK (web/yayin paketine gomulmesin)', envDosyalari.every((f) => !/EXPO_PUBLIC_GOOGLE_GIRIS_TEST/.test(oku(f))), envDosyalari.join(','));
const derle = oku('scripts/apk-derle.sh');
T.ok('apk-derle.sh yayin derlemesinde bayragi SILIYOR', /unset EXPO_PUBLIC_AG_IZLE EXPO_PUBLIC_GOOGLE_GIRIS_TEST/.test(derle));
T.ok('--google-test ayri adla cikiyor (yanlislikla yuklenmesin)', /--google-test\) export EXPO_PUBLIC_GOOGLE_GIRIS_TEST=1;.*EK="-GOOGLE-TEST"/.test(derle));

T.H('Dugme + mantik');
const dugme = oku('components/auth/GoogleGirisDugmesi.tsx');
const kanca = oku('hooks/useGoogleHesapGiris.ts');
T.ok('Web GIS konteyneri kosulsuz (Madde 231), onay yokken dokunulmaz', /nativeID=\{buttonElementId\}/.test(dugme) && /pointerEvents=\{etkin && durum === 'bos'/.test(dugme));
T.ok('Native dugme onay yokken pasif', /disabled=\{!etkin\}/.test(dugme));
T.ok('Kullanicinin kendi iptali hata sayilmaz', /if \(!sonuc\.cancelled\)/.test(dugme));
T.ok('Faz 3: ONCE check, sonra (yalniz bagli degilse) create_new', kanca.indexOf('checkGoogleAccount(idToken') > -1 && kanca.indexOf('checkGoogleAccount(idToken') < kanca.indexOf('createGoogleOnlyAccount(idToken'));
T.ok('Faz 3: trakt_ile_gir hata kodu da yonlendirmeye duser', /error\?\.code === 'trakt_ile_gir'/.test(kanca));
T.ok('Faz 3: Trakt ile devam kutusu giris ekraninda + handleTraktLogin', ekran.includes('<TraktIleGirKutusu') && /onTraktIleDevam=\{handleTraktLogin\}/.test(ekran));
// 🔴 M536: eskiden kutu ana Trakt dugmesinin ALTINA ciziliyordu → ekranda iki «Trakt ile Giris Yap».
T.ok('🔴 M536: kutu acikken ana Trakt dugmesi ve misafir baglantilari GIZLI (tek birincil dugme)',
  /\{!kutuAcik && \(\s*<TraktGirisDugmesi/.test(ekran) && /\{!kutuAcik && <>\s*<>\s*<OrDivider/.test(ekran) && !dugme.includes('<TraktIleGirKutusu'));
const kutu = oku('components/auth/TraktIleGirKutusu.tsx');
T.ok('M536: kutu kisinin kendi @ad + #no bilgisini gosterir, tek birincil + ikincil', /`@\$\{hesap\.username\}`/.test(kutu) && /#\{hesap!\.kaymakNo\}/.test(kutu) && /baskaHesaplaDene/.test(kutu) && (kutu.match(/onPress=/g) || []).length === 2);
T.ok('Hata sessiz yutulmaz', /logError\('googleGiris\.girisYap'/.test(kanca));

T.H('Faz 3 saf karar (D2/D4)');
const { googleGirisAdimi } = (await import('../ts-test-loader.mjs')).tsLoader(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'))('utils/googleGirisKarari.ts');
T.ok('Bagli degil -> yeni (soru yok)', googleGirisAdimi({ status: 'unlinked' }) === 'yeni');
T.ok('Google-only (belge var) -> oturum', googleGirisAdimi({ status: 'linked', traktLinked: false, sessionToken: 'x' }) === 'oturum');
T.ok("Trakt'li -> trakt_ile_gir", googleGirisAdimi({ status: 'linked', traktLinked: true }) === 'trakt_ile_gir');
T.ok('Belge yoksa guvenli taraf -> trakt_ile_gir', googleGirisAdimi({ status: 'linked', traktLinked: false }) === 'trakt_ile_gir');

T.H('Ceviri');
const tr = JSON.parse(oku('locales/tr/common.json')), en = JSON.parse(oku('locales/en/common.json'));
T.ok('googleSigningIn + googleTraktIleGir TR + EN', ['googleSigningIn', 'googleTraktIleGir'].every((k) => !!tr[k] && !!en[k]));
T.bitir();

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// Kimlik Faz 5 (M520) · D3 — «Giriş yöntemleri» + «Hesap Seç» (istemci).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('GIRIS YONTEMLERI + HESAP SEC (Kimlik Faz 5 · M520)', { kokOneki: 'hesap-sec-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const disk = new Map();
const as = {
  getItem: async (k) => disk.get(k) ?? null,
  setItem: async (k, v) => { disk.set(k, v); },
  removeItem: async (k) => { disk.delete(k); },
};
const N = tsLoader(root, { '@react-native-async-storage/async-storage': { default: as, ...as } })('services/auth/baglamaNiyeti.ts');

T.H('Baglama niyeti (giris ekrani token\'i oturum ACMAZ, baglar)');
await N.traktBaglamaNiyetiYaz(1_000);
T.ok('Yazilan niyet gorunur', await N.traktBaglamaNiyetiVarMi(2_000));
T.ok('Tuketilir (tek kullanimlik)', (await N.traktBaglamaNiyetiTuket(2_000)) === true && (await N.traktBaglamaNiyetiTuket(2_000)) === false);
await N.traktBaglamaNiyetiYaz(1_000);
T.ok('15 dk sonra gecersiz (ve yine silinir)', (await N.traktBaglamaNiyetiTuket(1_000 + N.NIYET_OMRU_MS + 1)) === false && disk.size === 0);

T.H('Giris ekrani');
const giris = oku('app/(public)/settings.tsx');
const takas = giris.slice(giris.indexOf('const handleTokenExchange'));
T.ok('Niyet kontrolu saveTokens\'TAN ONCE (yoksa ayri hesap acilirdi — bolunme yolu 2)',
  takas.indexOf('if (await traktBaglamaTamamla(tokenData)) return;') > -1 &&
  takas.indexOf('if (await traktBaglamaTamamla(tokenData)) return;') < takas.indexOf('await saveTokens('));
const tamamla = oku('hooks/useTraktBaglamaTamamla.ts');
T.ok('Yalniz niyet + Google-only oturumda devreye girer', /if \(!niyet \|\| !accessToken \|\| isGuest \|\| authProvider !== 'google'\) return false;/.test(tamamla));
T.ok('Hatada Google oturumu KALIR (gecis yalniz basarida)', tamamla.indexOf('await gecis(') < tamamla.indexOf('catch (e)') && !/catch \(e\)[\s\S]*gecis\(/.test(tamamla));
T.ok('Cakismada yeni Trakt token\'lari yalniz bellekte (store)', /yeniTrakt: \{ access: tokenData\.access_token, refresh: tokenData\.refresh_token \}/.test(tamamla));
const store = oku('store/hesapSecStore.ts');
T.ok('Hesap Sec deposu diske YAZMAZ', !/AsyncStorage|SecureStore|persist/.test(store.replace(/\/\*\*[\s\S]*?\*\//g, '')));

T.H('Ayarlar → Giris yontemleri');
const bolum = oku('components/settings/GirisYontemleriSection.tsx');
T.ok('Trakt bagla → niyet + giris ekrani', /traktBaglamaNiyetiYaz\(\);\s*router\.push\('\/\(public\)\/settings'\)/.test(oku('hooks/useGirisYontemleri.ts')));
T.ok('Google bagla dugmesi yalniz Google girisi acikken (GIRIS-G-02)', /\(y\.googleBagli \|\| GOOGLE_GIRIS_ACIK\)/.test(bolum));
const ayar = oku('app/(protected)/account-settings.tsx');
T.ok("Eski «Trakt'a baglan → giris ekrani» (niyetsiz) yolu kalkti", !/TraktAccountSection/.test(ayar) && !/onGoToLogin=\{\(\) => router\.push\('\/\(public\)\/settings'\)\}/.test(ayar));

T.H('Hesap Sec ekrani');
const kanca = oku('hooks/useHesapSec.ts');
const ekran = oku('app/(protected)/hesap-sec.tsx');
T.ok('Iki kart (KaymakNo · ad · yontem · sayilar)', (ekran.match(/<HesapKarti /g) || []).length === 2 && /hesap\.sayilar\.izleme/.test(oku('components/hesapSec/HesapKarti.tsx')));
T.ok('2. ayri uyari ekrani (adim uyari) + «Diger hesabindaki butun bilgiler silinecek»', /h\.adim === 'sec'/.test(ekran) && /hesapSecUyariBaslik/.test(ekran));
T.ok('🔴 Kaydirmadan Sil dugmesi PASIF; kanca da kaydirilmadan cagirmaz', /disabled=\{!h\.kaydirildi \|\| h\.calisiyor\}/.test(ekran) && /if \(!durum \|\| !secim \|\| !accessToken \|\| !kaydirildi \|\| calisiyor\) return;/.test(kanca));
const kaydir = oku('components/KaydirarakOnay.tsx');
T.ok('Kaydirma esigi %88; yarida birakilirsa geri doner', /const ESIK = 0\.88;/.test(kaydir) && /Animated\.spring\(x, \{ toValue: 0/.test(kaydir) && (kaydir.match(/onTamam\(\)/g) || []).length === 1);
T.ok('Oturum gecisi: once tam cikis (D8), sonra yeni belge', /await removeKeys\(\);\s*await saveTokens\(access, refresh\);/.test(oku('hooks/useOturumGecisi.ts')));
T.ok('trakt_ile_gir → cikis + giris ekrani', /r\.oturum === 'trakt_ile_gir'[\s\S]*?await removeKeys\(\);[\s\S]*?router\.replace\('\/\(public\)\/settings'\)/.test(kanca));

T.H('Ceviri (TR + EN)');
const anahtarlar = ['girisYontemleriBaslik', 'traktBagla', 'googleBagla', 'hesapSecBaslik', 'hesapSecAciklama', 'hesapSecUyariBaslik', 'hesapSecUyariMetin', 'kaydirOnayMetin', 'hesapSecSilDevam', 'baglamaModuNotu', 'hesapSecSureDoldu'];
for (const dil of ['tr', 'en']) {
  const s = JSON.parse(oku(`locales/${dil}/settings.json`));
  const eksik = anahtarlar.filter((k) => !s[k]);
  T.ok(`${dil}: anahtarlar tam`, eksik.length === 0, eksik.join(','));
}
T.bitir();

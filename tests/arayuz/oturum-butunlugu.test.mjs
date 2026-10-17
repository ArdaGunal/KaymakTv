import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// M525 — oturum bütünlüğü paketi (kullanıcı onayı 2026-10-17: «HEPSİ ŞİMDİ YAPILSIN»).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('OTURUM BUTUNLUGU (M525 a–e)', { kokOneki: 'oturum-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

let cihazToken = 'kaymak_session_v1.A';
const secure = { getItemAsync: async () => cihazToken, setItemAsync: async () => {}, deleteItemAsync: async () => {} };
const load = tsLoader(root, { 'react-native': { Platform: { OS: 'android' } }, 'expo-secure-store': secure });
const O = load('services/auth/oturumDenetimi.ts');

T.H('(a) 401 korumasi — tur, cihazin bugunku oturumuyla mi?');
T.ok('Ayni token → devam', await O.oturumHalaBuMu('kaymak_session_v1.A'));
cihazToken = null; // cikis: SecureStore bosaldi
T.ok('Cikista SecureStore bos → tur DURUR (eskiden token\'siz Trakt istegi = 401)', (await O.oturumHalaBuMu('kaymak_session_v1.A')) === false);
cihazToken = 'trakt-yeni';
T.ok('Hesap gecisinde baska token → tur DURUR', (await O.oturumHalaBuMu('kaymak_session_v1.A')) === false);
const f = oku('services/library/fetchers.ts');
T.ok('syncHiddenLists: oturum belgesiyle ya da degismis oturumla Trakt\'a GITMEZ', /if \(!accessToken \|\| isKaymakSessionToken\(accessToken\) \|\| !\(await oturumHalaBuMu\(accessToken\)\)\) return;/.test(f));
T.ok('fetchFreshData: Google-only karari cagrinin token\'indan', /const kaymakKullanici = isKaymakSessionToken\(accessToken\) \|\| \(await kaymakKullanicisiMi\(\)\);/.test(f) && /if \(accessToken && !\(await oturumHalaBuMu\(accessToken\)\)\) return;/.test(f));

T.H('(b) Worker invalid_token → tam cikis (yalniz KaymakTV oturum belgesi)');
let cikis = 0;
const kapat = O.onHesapGecersiz(() => { cikis++; });
O.hesapGecersizBildir(); O.hesapGecersizBildir(); O.hesapGecersizBildir();
T.ok('Ust uste gelen 401\'ler TEK cikisa iner (cikisin kendi istekleri dongu kurmaz)', cikis === 1);
kapat();
const koru = oku('services/api/workerYanitKoruyucu.ts');
T.ok('Kosul: Worker adresi + 401 + invalid_token + KaymakTV oturum belgesi', /url\.startsWith\(KAYMAK_WORKER_URL\)\s*&& status === 401 && kod === 'invalid_token' && isKaymakSessionToken\(oturum\)/.test(koru));
T.ok('Koruyucu istegin hatasini degistirmez', /return Promise\.reject\(hata\);/.test(koru));
const auth = oku('context/AuthContext.tsx');
T.ok('AuthContext kuruyor ve dinliyor → removeKeys (D8)', /workerYanitKoruyucusunuKur\(\);/.test(auth) && /onHesapGecersiz\(\(\) => \{[\s\S]*?removeKeysRef\.current\(\)/.test(auth) && /removeKeysRef\.current = removeKeys;/.test(auth));

T.H('(c) Bayat «ben» kimligi');
let disk = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
let yazilan = null;
// userBlocks Supabase'e bagli — davranis sahte userBlocks ile denetlenir.
const B = tsLoader(root, { '../../features/feed/services/userBlocks': {
  getMySupabaseUserId: async () => disk,
  setMySupabaseUserId: async (id) => { yazilan = id; disk = id; },
} })('services/auth/benKimligi.ts');
let sifirlama = 0;
B.onKimlikDegisti(() => { sifirlama++; });
T.ok('Ayni id → hicbir sey', (await B.benKimliginiDogrula('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) === false && sifirlama === 0);
T.ok('🔴 Sunucu BASKA id → disk duzelir + kimlik onbellekleri sifirlanir', (await B.benKimliginiDogrula('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')) === true && yazilan === 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' && sifirlama === 1);
T.ok('Kapida (oturum basina bir kez) cagriliyor', /void benKimliginiDogrula\(p\.userId\);/.test(oku('hooks/useAdOnayKapisi.ts')));
T.ok('AuthContext sifirlama: akis, takip, engel, kimlik onbellekleri', /onKimlikDegisti\(\(\) => \{[\s\S]*?useFeedStore\.getState\(\)\.reset\(\);[\s\S]*?invalidateBlockedUserIds\(\);[\s\S]*?invalidateIdentityScopedFeedCaches\(\);/.test(auth));

T.H('(d) Baglama / Hesap Sec oncesi bekleyen is uyarisi');
T.ok('Trakt baglama baslamadan sorulur', /if \(!\(await bekleyenIsOnayi\(\)\)\) return;\s*await traktBaglamaNiyetiYaz\(\);/.test(oku('hooks/useGirisYontemleri.ts')));
const hs = oku('hooks/useHesapSec.ts');
T.ok('Hesap Sec: sunucu cagrisindan ONCE sorulur', hs.indexOf('if (!(await bekleyenIsOnayi())) return;') > -1 && hs.indexOf('if (!(await bekleyenIsOnayi())) return;') < hs.indexOf('await hesapSec('));
T.ok('Onay kancasi bekleyen is yoksa sormaz', /if \(n === 0\) return true;/.test(oku('hooks/useBekleyenIsOnayi.ts')));

T.H('(e) Trakt\'li hesap kutusunda yerel Google oturumu kapanir');
T.ok('Iki dalda da googleOturumunuKapat', (oku('hooks/useGoogleHesapGiris.ts').match(/void googleOturumunuKapat\(\);/g) || []).length === 2);

T.H('Ceviri');
for (const dil of ['tr', 'en']) {
  const s = JSON.parse(oku(`locales/${dil}/settings.json`));
  T.ok(`${dil}: hesapDegisimBekleyenMetin {{n}} + yineDeDevam`, /\{\{n\}\}/.test(s.hesapDegisimBekleyenMetin || '') && !!s.yineDeDevam);
}
T.bitir();

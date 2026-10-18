import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// M538 — oturum kuşağı (D8 yarışı). Canlı bulgu (2026-10-18, M537 sonu): isim ekranında
// «Yeni hesap açmadan ona giriş yap» ile hesap silinirken süren kütüphane senkronu, çıkış
// temizliğinden SONRA `@trakt_lib_calendarShows/Movies`'i `[]` yazdı + hata günlüğüne kayıt düştü.
// Kural: çıkış anında kuşak ilerler; eski kuşağın geç gelen yanıtı diske/mağazaya/günlüğe yazmaz.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('OTURUM KUSAGI (D8 yarisi · M538)', { kokOneki: 'kusak-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const TOKEN = 'kaymak_session_v1.A';
let cihazToken = TOKEN;
const secure = { getItemAsync: async () => cihazToken, setItemAsync: async () => {}, deleteItemAsync: async () => {} };
const ertele = () => { let coz, red; const p = new Promise((a, b) => { coz = a; red = b; }); return { p, coz, red }; };
const tikla = () => new Promise((r) => setTimeout(r, 0));

// Sahte `./utils`: her yazma kaydedilir; setter'lar yalnız sayılır.
const yazilan = [], setterlar = [], gunluk = [];
const utils = new Proxy({
  CACHE_KEYS: new Proxy({}, { get: (_, k) => `@trakt_lib_${String(k)}` }),
  safeStorageSet: async (k) => { yazilan.push(k); },
  persistShowProgressMap: () => { yazilan.push('showProgressMap'); },
  readChunkedRecord: async () => null,
  writeChunkedRecord: async (k) => { yazilan.push(k); },
}, { get: (o, k) => (k in o ? o[k] : (...a) => { setterlar.push(String(k)); }) });
const ortak = {
  'react-native': { Platform: { OS: 'android' } },
  '../../utils/secureStorage': secure,
  '../../utils/errorLog': { logError: (c) => { gunluk.push(c); } },
  './utils': utils,
  './hiddenSyncGuard': { reconcileHiddenIds: (_, ids) => ids },
};

let tur = null;
const library = {
  syncLibrary: () => tur.sync.p,
  fetchTakvim: () => { tur.basladi.coz(); return tur.takvim.p; },
  kaymakKullanicisiMi: async () => true,
};
const yeniTur = () => { tur = { sync: ertele(), takvim: ertele(), basladi: ertele() }; };
const sifirla = () => { yazilan.length = 0; setterlar.length = 0; gunluk.length = 0; };

// Tek yükleyici: oturumDenetimi her iki modülde AYNI örnek (kuşak sayacı paylaşılır).
const load = tsLoader(root, {
  ...ortak,
  '@react-native-async-storage/async-storage': { default: { multiSet: async () => {} } },
  '../../store/useLibraryStore': { useLibraryStore: { getState: () => ({}) } },
  '../api/library': library,
  './emniyetAgi': { sezonsuzlariTamamla: async () => {} },
  '../traktApi': {},
  '../api/traktClient': { isKaymakSessionToken: (t) => typeof t === 'string' && t.startsWith('kaymak_session_v1.') },
  '../../utils/cacheTTL': { CACHE_TTL: { SYNC_INTERVAL: 600000 } },
  '../api/requestQueue': { requestQueue: { enqueue: async () => null } },
  '../../utils/metrics': { setMemoryGauge: () => {} },
});
const O = load('services/auth/oturumDenetimi.ts');
const S = load('services/library/kaymakSync.ts');
const F = load('services/library/fetchers.ts');

T.H('Kusak sayaci');
T.ok('oturumKusagi / oturumKusaginiIlerlet var', typeof O.oturumKusagi === 'function' && typeof O.oturumKusaginiIlerlet === 'function');
const k0 = O.oturumKusagi?.();
O.oturumKusaginiIlerlet?.();
T.ok('Ilerletince kusak degisir', O.oturumKusagi?.() !== k0);

T.H('kaymakKutuphaneSenkronu — cikis sirasinda gelen yanit');
// (1) Silinmis hesabin 502/401'i cikistan SONRA geldi → gunluge yazilmaz, hata bayragi kalkmaz.
sifirla(); yeniTur();
let s1 = S.kaymakKutuphaneSenkronu();
O.oturumKusaginiIlerlet?.();
tur.sync.red(Object.assign(new Error('Request failed with status code 502'), { response: { status: 502 } }));
T.ok('Eski kusagin hatasi: false doner', (await s1) === false);
T.ok('🔴 Eski kusagin hatasi yerel hata gunlugune YAZILMAZ', gunluk.length === 0, gunluk.join(','));
T.ok('Eski kusagin hatasi hasSyncError koymaz', !setterlar.includes('setHasSyncError'), setterlar.join(','));
// (2) Basarili ama gec gelen dolu yanit → disk/magaza yazilmaz.
sifirla(); yeniTur();
s1 = S.kaymakKutuphaneSenkronu();
O.oturumKusaginiIlerlet?.();
tur.sync.coz({ success: true, diziler: [], filmler: [], puanDiziler: [], puanFilmler: [], puanBolumler: [],
  izlemeListesiDiziler: [{ show: { ids: { trakt: 1 } } }], izlemeListesiFilmler: [], favoriDiziler: [], favoriFilmler: [], gizliDiziler: [], gizliFilmler: [] });
T.ok('Eski kusagin basarili yaniti: false doner', (await s1) === false);
T.ok('🔴 Eski kusagin yaniti diske YAZILMAZ', yazilan.length === 0, yazilan.join(','));
T.ok('Eski kusagin yaniti magazaya yazilmaz (yalniz yukleniyor bayraklari)', setterlar.every((s) => s === 'setIsLoading' || s === 'setIsMoviesLoading'), setterlar.join(','));

T.H('fetchFreshData — takvim cikistan SONRA geldi (canli bulgu)');
sifirla(); yeniTur();
cihazToken = TOKEN;
const f1 = F.fetchFreshData(TOKEN, true);
await tur.basladi.p; // tur oturum denetimini gecti, istekler yolda
cihazToken = null; // removeKeys: SecureStore bosaldi…
O.oturumKusaginiIlerlet?.(); // …ve kusak ilerledi
tur.sync.red(Object.assign(new Error('Request failed with status code 401'), { response: { status: 401 } }));
tur.takvim.coz({ diziler: [], filmler: [] });
await f1; await tikla();
T.ok('🔴 @trakt_lib_calendarShows/Movies cikistan sonra YAZILMAZ', !yazilan.some((k) => /calendar/.test(k)), yazilan.join(','));
T.ok('🔴 Hicbir anahtar yazilmaz (lastFetchTime dahil)', yazilan.length === 0, yazilan.join(','));
T.ok('Takvim magazaya da yazilmaz', !setterlar.includes('setCalendarShows') && !setterlar.includes('setCalendarMovies'), setterlar.join(','));
T.ok('Hata gunlugu bos', gunluk.length === 0, gunluk.join(','));

T.H('Ayni kusakta tur normal yazar (koruma asiri degil)');
sifirla(); yeniTur();
cihazToken = TOKEN;
const f2 = F.fetchFreshData(TOKEN, true);
await tur.basladi.p;
tur.sync.coz({ success: true, diziler: [], filmler: [], puanDiziler: [], puanFilmler: [], puanBolumler: [],
  izlemeListesiDiziler: [], izlemeListesiFilmler: [], favoriDiziler: [], favoriFilmler: [], gizliDiziler: [], gizliFilmler: [] });
tur.takvim.coz({ diziler: [{ show: { ids: { trakt: 7 } } }], filmler: [] });
await f2; await tikla();
T.ok('Takvim diske yazilir', yazilan.includes('@trakt_lib_calendarShows') && yazilan.includes('@trakt_lib_calendarMovies'), yazilan.join(','));

T.H('Baglanti');
const auth = oku('context/AuthContext.tsx');
const govde = auth.slice(auth.indexOf('const removeKeys = async'));
T.ok('removeKeys kusagi HER SEYDEN ONCE ilerletir', /const removeKeys = async \(\) => \{\s*oturumKusaginiIlerlet\(\);/.test(auth) && govde.indexOf('oturumKusaginiIlerlet();') < govde.indexOf('aktarimiDurdur();'));
const birak = oku('hooks/useYeniHesapBirak.ts');
T.ok('Yeni hesabi birak: kusak Worker silmesinden ONCE ilerler', birak.indexOf('oturumKusaginiIlerlet();') > -1 && birak.indexOf('oturumKusaginiIlerlet();') < birak.indexOf('await yeniHesabiBirak(accessToken);'));
T.bitir();

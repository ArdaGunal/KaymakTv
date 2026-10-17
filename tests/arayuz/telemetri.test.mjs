import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// DISCORD-01 (M529) — canlı bulgu: aynı hata aynı anda iki yerden gelince Discord'a İKİ kez gidiyordu
// (iki `useMyTraktProfile.graf`, aynı kurulum, aynı dakika). Disk kontrolü oku-değiştir-yaz → yarış.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('TELEMETRI TEKRAR ENGELI (DISCORD-01 · M529)', { kokOneki: 'telemetri-' });

const disk = new Map();
const yavas = () => new Promise((r) => setTimeout(r, 5)); // gerçek AsyncStorage da async
const as = {
  getItem: async (k) => { await yavas(); return disk.get(k) ?? null; },
  setItem: async (k, v) => { await yavas(); disk.set(k, v); },
};
const gonderilen = [];
const load = tsLoader(root, {
  axios: { default: { post: async (url, govde) => { gonderilen.push(govde); return { data: {} }; } } },
  'react-native': { Platform: { OS: 'android', Version: 37 } },
  'expo-constants': { default: { expoConfig: { version: '2.6.6' } } },
  '@react-native-async-storage/async-storage': { default: as, ...as },
});
const Tel = load('services/api/telemetry.ts');

const hata = { context: 'useMyTraktProfile.graf', message: 'İşlem tamamlanamadı.' };
await Promise.all([Tel.reportErrorRemotely(hata), Tel.reportErrorRemotely(hata), Tel.reportErrorRemotely(hata)]);
T.ok('🔴 Ayni anda gelen 3 ayni hata → Discord\'a TEK istek (eskiden yarista coklu)', gonderilen.length === 1, String(gonderilen.length));

await Tel.reportErrorRemotely({ context: 'notificationStore.refreshActivity', message: 'İşlem tamamlanamadı.' });
T.ok('Farkli baglam ayrica gider', gonderilen.length === 2);

Tel.__telemetriOturumunuSifirla();
await Tel.reportErrorRemotely(hata);
T.ok('Yeni oturumda da 24 saat icinde ayni hata GITMEZ (disk kaydi)', gonderilen.length === 2);

T.H('Hesap silmede kurulum kimligi yenilenir, sayaclar kalir');
as.removeItem = async (k) => { await yavas(); disk.delete(k); };
const ilkKimlik = disk.get('@kaymak_install_id_v1');
T.ok('Gonderimde kurulum kimligi olustu', !!ilkKimlik && gonderilen[0].installId === ilkKimlik);
await Tel.kurulumKimliginiYenile();
T.ok('🔴 kurulumKimliginiYenile: install id silindi, kota + 24 saat kaydi DURUYOR', !disk.has('@kaymak_install_id_v1') && disk.has('@kaymak_telemetry_quota_v1') && disk.has('@kaymak_telemetry_seen_v1'));
Tel.__telemetriOturumunuSifirla();
await Tel.reportErrorRemotely({ context: 'yeni.hata', message: 'x' });
T.ok('Sonraki gonderim YENI kurulum kimligiyle', gonderilen.length === 3 && gonderilen[2].installId !== ilkKimlik);
T.ok('Anahtar adlari tek kaynak (TELEMETRI_ANAHTARLARI)', Tel.TELEMETRI_ANAHTARLARI.kurulum === '@kaymak_install_id_v1' && Tel.TELEMETRI_ANAHTARLARI.kota === '@kaymak_telemetry_quota_v1' && Tel.TELEMETRI_ANAHTARLARI.gorulen === '@kaymak_telemetry_seen_v1');

T.H('Gecici hata siniflandirma (kullanici kurali 2026-10-18)');
const { geciciHataNedeni } = tsLoader(root)('utils/geciciHata.ts');
const yanit = (status) => ({ isAxiosError: true, message: 'Request failed', response: { status } });
for (const s of [502, 503, 504, 522, 524]) T.ok(`${s} → gecici (Discord'a GITMEZ)`, geciciHataNedeni(yanit(s)) === `http_${s}`);
for (const s of [500, 400, 401, 403, 404, 409, 422, 429]) T.ok(`${s} → GERCEK hata (Discord'a gider)`, geciciHataNedeni(yanit(s)) === null);
T.ok('Network Error → gecici', geciciHataNedeni({ message: 'Network Error', code: 'ERR_NETWORK' }) === 'ERR_NETWORK');
T.ok('axios zaman asimi → gecici', geciciHataNedeni({ message: 'timeout of 15000ms exceeded', code: 'ECONNABORTED' }) === 'ECONNABORTED');
T.ok('Canceled → gecici', geciciHataNedeni({ name: 'CanceledError', message: 'canceled', code: 'ERR_CANCELED' }) === 'ERR_CANCELED');
T.ok('fetch «Network request failed» → gecici', geciciHataNedeni(new TypeError('Network request failed')) === 'network');
T.ok('🔴 TypeError (JS hatasi) → GERCEK', geciciHataNedeni(new TypeError("Cannot read properties of undefined (reading 'x')")) === null);
T.ok('🔴 Parse/sema hatasi → GERCEK', geciciHataNedeni(new SyntaxError('Unexpected token < in JSON')) === null);
T.ok('🔴 Mesajinda «timeout» gecen baska hata → GERCEK', geciciHataNedeni(new Error('setTimeout is not a function')) === null);
T.ok('🔴 Supabase RPC hatasi (yanitli 500) → GERCEK', geciciHataNedeni({ response: { status: 500, data: { code: 'P0001' } } }) === null);
T.ok('Duz metin / null → GERCEK', geciciHataNedeni('hata') === null && geciciHataNedeni(null) === null);
T.ok('Sarilmis: KaymakAramaHatasi.neden = 522 → gecici', geciciHataNedeni({ tur: 'genel', message: 'İşlem tamamlanamadı.', neden: yanit(522) }) === 'http_522');
T.ok('Sarilmis: neden = 500 → GERCEK', geciciHataNedeni({ tur: 'genel', message: 'İşlem tamamlanamadı.', neden: yanit(500) }) === null);
T.ok('Error.cause zinciri de aranir', geciciHataNedeni(new Error('x', { cause: { code: 'ERR_CANCELED' } })) === 'ERR_CANCELED');

T.H('logError: gecici → yalniz yerel (gercek nedenle), gercek → Discord');
const uzak = [];
const yerelDisk = new Map();
const yas = { getItem: async (k) => yerelDisk.get(k) ?? null, setItem: async (k, v) => { yerelDisk.set(k, v); } };
const E = tsLoader(root, {
  '@react-native-async-storage/async-storage': { default: yas, ...yas },
  '../services/api/telemetry': { reportErrorRemotely: async (x) => { uzak.push(x); } },
})('utils/errorLog.ts');
// Gercek KaymakAramaHatasi gibi: Error + tur + neden.
const sarili = (neden) => Object.assign(new Error('İşlem tamamlanamadı.'), { tur: 'genel', neden });
E.logError('notificationStore.refreshActivity', sarili({ message: 'canceled', code: 'ERR_CANCELED' }));
E.logError('useMyTraktProfile.graf', sarili(yanit(500)));
E.logError('render', new TypeError('x is undefined'));
await new Promise((r) => setTimeout(r, 20)); // yerel yazma kuyrugu
const kayit = await E.getErrorLog();
T.ok("🔴 12:28 seli: Canceled sarili hata Discord'a GITMEDI", !uzak.some((x) => x.context === 'notificationStore.refreshActivity'));
T.ok('Yerel gunlukte gercek nedeniyle duruyor', kayit.some((k) => k.context === 'notificationStore.refreshActivity' && /\[geçici: ERR_CANCELED\]/.test(k.message) && k.tags?.gecici === 'ERR_CANCELED'), JSON.stringify(kayit));
T.ok("🔴 Gercek 500 ve TypeError Discord'a GITTI", uzak.some((x) => x.context === 'useMyTraktProfile.graf') && uzak.some((x) => x.context === 'render'));

T.H('kaymakSocial kok nedeni tasir');
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ks = oku('services/api/kaymakSocial.ts');
T.ok('genel hatasi axios hatasini `neden` olarak tasiyor', /new KaymakAramaHatasi\('genel', yanit\?\.message \|\| 'İşlem tamamlanamadı\.', error\)/.test(ks) && /public readonly neden\?: unknown/.test(ks));

T.H('Hesap silme akislarinda kurulum kimligi yenileniyor');
for (const f of ['hooks/useSettings.ts', 'hooks/useYeniHesapBirak.ts', 'hooks/useHesapSec.ts']) {
  T.ok(`${f}: await kurulumKimliginiYenile()`, /await kurulumKimliginiYenile\(\);/.test(oku(f)));
}
const ayar = oku('hooks/useSettings.ts');
const cikisGovde = ayar.slice(ayar.indexOf('const handleLogout'), ayar.indexOf('const handleDeleteAccount'));
T.ok('🔴 Normal cikista kurulum kimligi YENILENMEZ', cikisGovde.length > 0 && !cikisGovde.includes('kurulumKimliginiYenile'));
T.bitir();

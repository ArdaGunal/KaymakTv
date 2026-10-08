import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// M466 · Discord `pushTokens.register` 429 (android 36, 2.6.0, 2026-10-09 00:01).
// Planlama efekti her veri değişiminde kaydı yeniden çağırıyordu; Worker'ın
// dakikada 20 sınırı aşılıyordu. Kayıt artık süreç başına tekrarlanamaz.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('PUSH KAYDI TEKRARLANAMAZ (M466)', { kokOneki: 'push-kayit-' });

let istekler = 0; let cevap = async () => ({ data: { success: true } });
let auth = 'tok-hesapA-000000000000';
const uzak = [];
const mocks = {
  'react-native': { Platform: { OS: 'android' } },
  'expo-device': { isDevice: true },
  'expo-notifications': {
    getPermissionsAsync: async () => ({ status: 'granted' }),
    getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[cihaz]' }),
  },
  axios: (() => { const post = async (url) => { istekler++; await new Promise((r) => setTimeout(r, 5)); return cevap(url); }; return { default: { post }, post }; })(),
  '@react-native-async-storage/async-storage': { default: { getItem: async () => null, setItem: async () => {} }, getItem: async () => null, setItem: async () => {} },
  'expo-secure-store': { getItemAsync: async () => auth, setItemAsync: async () => {}, deleteItemAsync: async () => {} },
  'expo-constants': { default: { expoConfig: { version: '2.6.0' } } },
};
const load = tsLoader(root, mocks);
// Discord'a giden yolu (telemetry) yakala: logError → reportErrorRemotely.
const tel = load('services/api/telemetry.ts');
tel.reportErrorRemotely = async (r) => { uzak.push(r.context); };
const P = load('features/notifications/services/pushTokens.ts');

T.H('Firtina: planlama efekti 30 kez arka arkaya cagirir');
for (let i = 0; i < 30; i++) await P.registerPushToken();
T.ok('30 cagri → TEK Worker istegi', istekler === 1, `istek=${istekler}`);

T.H('Esanli cagrilar tek ucus');
P.kayitHafizasiniSifirla(); istekler = 0;
const sonuc = await Promise.all(Array.from({ length: 5 }, () => P.registerPushToken()));
T.ok('5 esanli cagri → 1 istek, hepsi basarili', istekler === 1 && sonuc.every(Boolean));

T.H('429 geri cekilmesi');
P.kayitHafizasiniSifirla(); istekler = 0;
cevap = async () => { const e = new Error('Request failed with status code 429'); e.response = { status: 429 }; throw e; };
await P.registerPushToken(); await P.registerPushToken(); await P.registerPushToken();
T.ok('429 sonrasi 10 dk yeni istek YOK', istekler === 1);
T.ok('429 Discord\'a hata olarak GITMEZ (yalniz yerel uyari)', !uzak.includes('pushTokens.register'));

T.H('Gercek hata hala raporlanir');
P.kayitHafizasiniSifirla(); istekler = 0; uzak.length = 0;
cevap = async () => { const e = new Error('Request failed with status code 500'); e.response = { status: 500 }; throw e; };
await P.registerPushToken();
T.ok('500 → Discord raporu (gercek sorun gizlenmez)', uzak.includes('pushTokens.register'));

T.H('Hesap degisimi / cikis');
P.kayitHafizasiniSifirla(); istekler = 0; cevap = async () => ({ data: { success: true } });
await P.registerPushToken();
auth = 'tok-hesapB-111111111111';
await P.registerPushToken();
T.ok('Farkli hesap ayni cihazda hemen kaydolur', istekler === 2);
await P.unregisterPushToken();
istekler = 0; await P.registerPushToken();
T.ok('Cikistan sonra hafiza sifir → yeniden kayit', istekler === 1);
T.bitir();

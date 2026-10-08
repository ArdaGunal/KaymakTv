// M438: gerçek store/hook gövdelerini bağımlılıkları sahteleyerek çalıştırır.
// Ağ yok; taze profil, bayat graf, yeni mutasyon ve oturum değişimi yarışır.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import yardimci from '../yardimci.js';

const T = yardimci.baslat('TAKIP PROFILI (M438)', { kokOneki: 'takip-profil-' });
const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tr = JSON.parse(fs.readFileSync(path.join(kok, 'locales/tr/common.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(kok, 'locales/en/common.json'), 'utf8'));
const kisi = 'test-hedef';
const graf = (following = [], pendingOut = []) => ({ following, pendingOut });
const flush = () => new Promise((r) => setImmediate(r));

function yukle(dosya, taklitler) {
  const kod = ts.transpileModule(fs.readFileSync(path.join(kok, dosya), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(kod, {
    exports,
    require: (ad) => {
      if (!(ad in taklitler)) throw new Error(`Taklit eksik: ${ad}`);
      return taklitler[ad];
    },
    console, Date, Map, Set,
  }, { filename: dosya });
  return exports;
}

const disk = new Map();
let ilkDiskOkumasi = true;
let diskYanitiniVer;
const ilkOkuma = new Promise((r) => { diskYanitiniVer = r; });
const zaman = Date.now();
let agIstegi = 0;
const moduleStore = yukle('store/followStore.ts', {
  zustand: { create: () => (kur) => {
    let state;
    const store = (selector) => selector(state);
    const set = (parca) => { state = { ...state, ...(typeof parca === 'function' ? parca(state) : parca) }; };
    store.getState = () => state;
    store.setState = set;
    state = kur(set, store.getState);
    return store;
  } },
  '@react-native-async-storage/async-storage': { default: {
    getItem: async (k) => {
      if (!ilkDiskOkumasi) return disk.get(k) ?? null;
      ilkDiskOkumasi = false;
      return ilkOkuma;
    },
    setItem: async (k, v) => { disk.set(k, v); },
    removeItem: async (k) => { disk.delete(k); },
  } },
  '../services/api/kaymakSocial': { fetchKaymakGraph: async () => { agIstegi++; return graf(); } },
  '../utils/cacheTTL': { CACHE_TTL: { SYNC_INTERVAL: 600000 } },
  '../utils/errorLog': { logError: (ad, e) => { throw new Error(`${ad}: ${e}`); } },
});
const store = moduleStore.useFollowStore;
const nesil = moduleStore.takipMutasyonNesli;

T.H('Disk hidrasyonu profilin taze sonucundan once tamamlanir');
const profilIsi = store.getState().applyProfileConnection(kisi, 'following', nesil());
diskYanitiniVer(JSON.stringify({ connectionStates: { [kisi]: 'pending' }, fetchedAt: zaman }));
await profilIsi;
T.ok('Diskteki pending taze following bilgisini ezmedi', store.getState().connectionStates[kisi] === 'following');
T.ok('Global graf TTL yenilenmedi', store.getState().fetchedAt === zaman);
T.ok('Taze iliski diske yazildi', JSON.parse(disk.get('kaymak-follow-storage-v2')).connectionStates[kisi] === 'following');
await store.getState().fetchFollowGraph();
T.ok('Taze profile ragmen tum graf icin ek istek yok', agIstegi === 0);

T.H('Bayat graf ile taze profil yarisi');
const eskiGrafNesli = nesil();
await store.getState().applyProfileConnection(kisi, 'following', eskiGrafNesli);
store.getState().applyGraf(graf([], [kisi]), eskiGrafNesli);
T.ok('Profilden once baslayan pending graf takip durumunu ezmedi', store.getState().connectionStates[kisi] === 'following');
const tazeGrafNesli = nesil();
store.getState().applyGraf(graf([], [kisi]), tazeGrafNesli);
T.ok('Daha yeni sunucu grafinin pending sonucu uygulanir', store.getState().connectionStates[kisi] === 'pending');

T.H('Kullanici eylemi ve oturum degisimi korunur');
const eskiProfilNesli = nesil();
store.getState().setOptimisticState(kisi, 'none');
await store.getState().applyProfileConnection(kisi, 'following', eskiProfilNesli);
T.ok('Gec profil yaniti kullanicinin geri cekmesini geri almadi', !store.getState().connectionStates[kisi]);
await store.getState().applyProfileConnection(kisi, 'none', nesil());
T.ok('Sunucudaki yok durumu da uygulanir', !store.getState().connectionStates[kisi]);
const oncekiOturum = nesil();
store.getState().reset();
await store.getState().applyProfileConnection(kisi, 'following', oncekiOturum);
T.ok('Onceki oturumun profil yaniti yeni hesaba sizmadi', !store.getState().connectionStates[kisi]);

T.H('Diyalog pending/following durumuna ve dile gore secilir');
let onayMetni;
let yazma = 0;
let dil = tr;
const hook = yukle('hooks/useFollowState.ts', {
  react: { useCallback: (f) => f, useEffect: () => {}, useState: (v) => [v, () => {}] },
  'react-native': { Alert: { alert: () => {} } },
  'react-i18next': { useTranslation: () => ({ t: (k, fallback) => dil[k] ?? fallback }) },
  '../context/AuthContext': { useAuth: () => ({ accessToken: 'test', isGuest: false }) },
  '../services/api/kaymakSocial': {
    unfollowKaymakUser: async () => { yazma++; },
    followKaymakUser: async () => { yazma++; return 'istek'; },
  },
  '../store/followStore': moduleStore,
  '../store/notificationStore': { useNotificationStore: {} },
  '../utils/metrics': { recordMutationResult: () => {} },
  '../utils/confirmDialog': {
    notify: () => {},
    confirmAsync: async (...metin) => { onayMetni = metin; return false; },
  },
});
for (const [ad, sozluk] of [['tr', tr], ['en', en]]) {
  dil = sozluk;
  store.getState().setOptimisticState(kisi, 'pending');
  await hook.useFollowState(kisi, 'test', true).toggleFollow();
  T.ok(`${ad}: pending geri cekme basligi`, onayMetni[0] === sozluk.withdrawRequestTitle);
  T.ok(`${ad}: pending geri cekme metni ve butonu`, onayMetni[1] === sozluk.withdrawRequestMessage && onayMetni[2] === sozluk.withdrawRequestConfirm);
  store.getState().setOptimisticState(kisi, 'following');
  await hook.useFollowState(kisi, 'test', true).toggleFollow();
  T.ok(`${ad}: following takipten cikma metnini korur`, onayMetni[0] === sozluk.unfollowTitle && onayMetni[2] === sozluk.unfollowConfirm);
}
T.ok('Iptal iki durumda da sunucuya yazmadi', yazma === 0);

T.H('Profil odagi ve arka plandan donus taze iliskiyi uygular');
let odak;
let appListener;
let kaldirildi = false;
let profilOkuma = 0;
const identity = yukle('features/publicProfile/hooks/usePublicProfileIdentity.ts', {
  react: { useCallback: (f) => f, useState: (v) => [v, () => {}] },
  'react-native': { AppState: {
    currentState: 'active',
    addEventListener: (_ad, listener) => {
      appListener = listener;
      return { remove: () => { kaldirildi = true; } };
    },
  } },
  'expo-router': { useFocusEffect: (callback) => { odak = callback; } },
  '../../../services/api/kaymakSocial': {
    fetchKaymakProfile: async () => {
      profilOkuma++;
      return { profile: { userId: kisi }, iliski: 'takip' };
    },
    KaymakAramaHatasi: class extends Error {},
  },
  './usePublicProfile': { usePublicProfile: () => ({ profile: null, isLoading: false }) },
  '../../../store/followStore': moduleStore,
});
identity.usePublicProfileIdentity('test');
const odagiKapat = odak();
await flush();
T.ok('Profil odaginda sunucu iliskisi dugmeye geldi', store.getState().connectionStates[kisi] === 'following');
appListener('active');
await flush();
T.ok('Zaten aktifken gereksiz yeniden okuma yok', profilOkuma === 1);
appListener('background');
appListener('active');
await flush();
T.ok('Arka plandan donuste profil yeniden okundu', profilOkuma === 2);
odagiKapat();
T.ok('Odak kaybolunca AppState aboneligi kaldirildi', kaldirildi);

T.bitir();

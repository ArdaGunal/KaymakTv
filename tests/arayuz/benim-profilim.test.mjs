import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// HIZ-01 Paket 2 (M544) — kendi profilim tek paylaşılan store'da (Faz 2 önbellek + Faz 3 tekil istek)
// ve supabase-js okumalarına sınır + tek tekrar.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const T = yardimci.baslat('BENIM PROFILIM + SUPABASE OKUMA SINIRI (M544)', { kokOneki: 'benim-profilim-' });

// ── Sahte bağımlılıklar ─────────────────────────────────────────────────
const disk = new Map();
const AsyncStorage = {
  getItem: async (k) => (disk.has(k) ? disk.get(k) : null),
  setItem: async (k, v) => { disk.set(k, v); },
  removeItem: async (k) => { disk.delete(k); },
};
const sayac = { trakt: 0, profil: 0, graf: 0 };
let grafHatasi = false;
let profilKapisi = null; // verilirse profil isteği bu söz çözülene kadar bekler
const ertele = () => { let coz; const p = new Promise((r) => { coz = r; }); return { p, coz }; };
const mocks = {
  zustand: require('zustand'),
  '@react-native-async-storage/async-storage': { __esModule: true, default: AsyncStorage },
  '../services/api/social': { getUserProfile: async () => { sayac.trakt++; return { private: false, vip: true, ids: { slug: 'arda' } }; } },
  '../services/api/kaymakSocial': { fetchKaymakGraph: async () => { sayac.graf++; if (grafHatasi) throw new Error('522'); return { followersCount: 7, followingCount: 3 }; } },
  '../features/feed/services/profile': { getMyProfile: async () => {
    sayac.profil++;
    if (profilKapisi) await profilKapisi;
    return { username: 'arda_sunucu', avatarUrl: null, bio: 'b', displayName: 'Arda', kaymakNo: 48291735 };
  } },
  '../utils/errorLog': { logError: () => {} },
};
const { useBenimProfilimStore, TAZE_SURE_MS } = tsLoader(root, mocks)('store/benimProfilimStore.ts');
const st = useBenimProfilimStore.getState;
const baglam = (ek = {}) => ({ accessToken: 'tok', isGuest: false, authProvider: 'trakt', myUsername: 'arda', myAvatarUrl: null, updateMyProfile: async () => {}, ...ek });
const sifirlaSayac = () => { sayac.trakt = 0; sayac.profil = 0; sayac.graf = 0; };

// 1) Disk → anında; ağ arkada.
disk.set('kaymak.benimProfilim.v1', JSON.stringify({ profile: { username: 'arda_disk' }, followersCount: 5, followingCount: 2, kaymakNo: 1 }));
const kapi = ertele();
profilKapisi = kapi.p;
const tur = st().tazele(baglam());
await new Promise((r) => setTimeout(r, 10));
T.ok('Diskteki son profil AG BEKLENMEDEN gorunur (iskelet yok)', st().veri?.profile?.username === 'arda_disk' && st().isLoading === false);
kapi.coz();
profilKapisi = null;
await tur;
T.ok('Ag tamamlaninca sunucu profili + sayilar + KaymakNo yazilir', st().veri.profile.username === 'arda_sunucu' && st().veri.followersCount === 7 && st().veri.kaymakNo === 48291735);
T.ok('Taze profil diske yazildi (sonraki acilis aninda)', JSON.parse(disk.get('kaymak.benimProfilim.v1')).profile.username === 'arda_sunucu');
T.ok('Trakt dalinda profil ve sayilar PARALEL (her biri 1 kez)', sayac.trakt === 1 && sayac.profil === 1 && sayac.graf === 1);

// 2) Faz 3 — beş tüketici aynı anda bağlanır → tek tur.
st().sifirla();
sifirlaSayac();
await Promise.all([1, 2, 3, 4, 5].map(() => st().tazele(baglam())));
T.ok('5 es zamanli baglanma → Trakt /users/me TEK kez (eskiden her tuketici ayri)', sayac.trakt === 1 && sayac.profil === 1);

// 3) Taze süre içinde zorlanmamış tazeleme ağa gitmez; zorlanmış gider.
sifirlaSayac();
await st().tazele(baglam());
T.ok(`${TAZE_SURE_MS / 1000} sn icinde odak tazelemesi aga gitmez`, sayac.trakt === 0);
await st().tazele(baglam(), true);
T.ok('Zorlanmis tazeleme (Kaydet / cekmeli yenile) aga gider', sayac.trakt === 1);

// 4) Sayılar düşerse önceki değer korunur.
grafHatasi = true;
await st().tazele(baglam(), true);
T.ok('Takip grafi duserse onceki sayi KORUNUR (0 yalani yok)', st().veri.followersCount === 7);
grafHatasi = false;

// 5) Sıfırlama: RAM + disk temiz; sıfırlamadan önce başlamış tur yeni oturuma yazmaz.
const kapi2 = ertele();
profilKapisi = kapi2.p;
const eskiTur = st().tazele(baglam(), true);
await new Promise((r) => setTimeout(r, 5));
st().sifirla();
kapi2.coz();
profilKapisi = null;
await eskiTur;
await new Promise((r) => setTimeout(r, 5));
T.ok('Cikis/kimlik degisimi: RAM bos, disk anahtari silindi', st().veri === null && !disk.has('kaymak.benimProfilim.v1'));

// 6) Misafir: ağ yok, iskelet yok.
sifirlaSayac();
await st().tazele(baglam({ isGuest: true }));
T.ok('Misafirde ag istegi yok ve yukleniyor durumu kapanir', sayac.trakt === 0 && sayac.profil === 0 && st().isLoading === false);

// 7) Google-only: Trakt'a hiç gitmez.
st().sifirla();
sifirlaSayac();
await st().tazele(baglam({ authProvider: 'google' }));
T.ok('Google-only: Trakt /users/me YOK, profil sunucudan', sayac.trakt === 0 && st().veri.profile.username === 'arda_sunucu' && st().veri.kaymakNo === 48291735);

// ── supabase-js okuma sınırı ────────────────────────────────────────────
const { sinirliFetchKur } = tsLoader(root, {}, { AbortController })('features/feed/services/supabaseSinirliFetch.ts');
const sus = console.warn;
console.warn = () => {};
const yanit = (status) => ({ status, ok: status < 400 });
let n = 0;
const asiliSonraHizli = (input, init) => {
  n++;
  if (n === 1) return new Promise((_, red) => init.signal.addEventListener('abort', () => red(new Error('aborted'))));
  return Promise.resolve(yanit(200));
};
let r = await sinirliFetchKur(asiliSonraHizli, 30)('https://x/rest/v1/feed_activities', { method: 'GET' });
T.ok('Asili okuma sinirda kesilir, taze deneme doner', r.status === 200 && n === 2);

n = 0;
r = await sinirliFetchKur(async () => { n++; return yanit(n === 1 ? 522 : 200); }, 30)('https://x/rest/v1/app_settings');
T.ok('522 okumada bir kez daha (method yoksa GET sayilir)', r.status === 200 && n === 2);

n = 0;
let sinyal;
r = await sinirliFetchKur(async (i, init) => { n++; sinyal = init?.signal; return yanit(502); }, 30)('https://x/rest/v1/comments', { method: 'POST', body: '{}' });
T.ok('POST (yazma) dokunulmaz: tek deneme, sinyal eklenmez', r.status === 502 && n === 1 && sinyal === undefined);

n = 0;
const cagiran = new AbortController();
let atildi = false;
const s = sinirliFetchKur((i, init) => { n++; return new Promise((_, red) => init.signal.addEventListener('abort', () => red(new Error('aborted')))); }, 5000);
const p = s('https://x/rest/v1/feed_activities', { method: 'GET', signal: cagiran.signal }).catch(() => { atildi = true; });
cagiran.abort();
await p;
T.ok('Cagiranin kendi iptali tekrarlanmaz', atildi && n === 1);
console.warn = sus;

T.bitir();

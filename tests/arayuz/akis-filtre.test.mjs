import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// C6 · Gizli filtre: sunucu sorgusu + store koruması + yüklem.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const T = yardimci.baslat('AKIS FILTRE (C6)', { kokOneki: 'akis-filtre-' });

// Sahte Supabase: zincir çağrılarını kaydeder.
let kayit = [];
const zincir = () => {
  const q = new Proxy({}, {
    get: (_t, ad) => {
      if (ad === 'then') return (ok) => ok({ data: [], error: null });
      return (...args) => { kayit.push([ad, ...args]); return q; };
    },
  });
  return q;
};
const load = tsLoader(root, {
  zustand: require('zustand'),
  axios: { default: {} },
  '../../../store/followStore': { getFollowingUserIds: () => ['arkadas'] },
  './supabaseClient': { supabase: { from: (t) => { kayit.push(['from', t]); return zincir(); } } },
  '../../../utils/metrics': { recordApiLatency: () => {}, recordMutationResult: () => {} },
  './userBlocks': { getBlockedUserIds: async () => new Set(), getMySupabaseUserId: async () => 'ben' },
  './feedSocial': { getMyLikedActivityIds: async () => new Set() },
});
const api = load('features/feed/services/feedApi.ts');
const { filtreyeUyar } = load('features/feed/utils/feedFilter.ts');
const { useFeedStore } = load('features/feed/store/feedStore.ts');

const sorgu = async (filtre, imlec = null) => { kayit = []; await api.fetchFeedActivities(imlec, true, filtre); return kayit; };
const bul = (k, ad) => k.filter((c) => c[0] === ad);

const tum = await sorgu('tumu');
T.ok('Tumu: tip/or filtresi yok', bul(tum, 'or').length === 0 && !bul(tum, 'is').length);
const akt = await sorgu('aktiviteler');
T.ok('Aktiviteler: sistem tipleri + note/rating NULL', JSON.stringify(bul(akt, 'in').find((c) => c[1] === 'activity_type')?.[2]) === JSON.stringify(['watched_episode', 'watched_movie', 'started_show', 'completed_show'])
  && bul(akt, 'is').some((c) => c[1] === 'note' && c[2] === null) && bul(akt, 'is').some((c) => c[1] === 'rating' && c[2] === null));
const gon = await sorgu('gonderiler');
T.ok('Gonderiler (ilk sayfa): note VEYA rating', bul(gon, 'or').length === 1 && bul(gon, 'or')[0][1] === 'note.not.is.null,rating.not.is.null');
const gon2 = await sorgu('gonderiler', { activityAt: '2026-10-09T10:00:00.000Z', id: 'x' });
T.ok('Gonderiler + imlec: TEK or ifadesinde birlesir (iki or= parametresine guvenilmez)', bul(gon2, 'or').length === 1 && /^and\(or\(note\.not\.is\.null,rating\.not\.is\.null\),or\(activity_at\.lt\./.test(bul(gon2, 'or')[0][1]));
const tak = await sorgu('takip');
const kullanicilar = bul(tak, 'in').find((c) => c[1] === 'user_id')?.[2] ?? [];
T.ok(`Takip Ettiklerim: BEN haric (${JSON.stringify(kullanicilar)})`, !kullanicilar.includes('ben') && kullanicilar.includes('arkadas'));

// Yüklem (Realtime/iyimser eklemeler).
const u = (id) => ({ id });
T.ok('Yuklem: gonderi/inceleme/puan/alintili izleme = Gonderiler', ['posted', 'reviewed'].every((t) => filtreyeUyar({ activityType: t, note: 'x', user: u('a') }, 'gonderiler', 'ben'))
  && filtreyeUyar({ activityType: 'rated', rating: 8, user: u('a') }, 'gonderiler', 'ben') && filtreyeUyar({ activityType: 'watched_episode', note: 'x', user: u('a') }, 'gonderiler', 'ben'));
T.ok('Yuklem: ciplak izleme = Aktiviteler, alintili izleme DEGIL', filtreyeUyar({ activityType: 'watched_episode', user: u('a') }, 'aktiviteler', 'ben') && !filtreyeUyar({ activityType: 'watched_episode', note: 'x', user: u('a') }, 'aktiviteler', 'ben'));
T.ok('Yuklem: Takip = ben haric', filtreyeUyar({ activityType: 'posted', note: 'x', user: u('a') }, 'takip', 'ben') && !filtreyeUyar({ activityType: 'posted', note: 'x', user: u('ben') }, 'takip', 'ben'));

// Store koruması.
const st = useFeedStore.getState;
const kart = (id, ek) => ({ id, user: u('a'), activityType: 'watched_episode', activityAt: '2026-10-10T10:00:00.000Z', likeCount: 0, commentCount: 0, ...ek });
st().setFirstPage({ items: [kart('k1')], hasMore: true, nextCursor: { activityAt: 'x', id: 'k1' } });
st().setFiltre('gonderiler', 'ben');
T.ok('Filtre degisince liste bosalir, imlec sifirlanir', st().activities.length === 0 && st().nextCursor === null && st().isHydrated === false && st().filtre === 'gonderiler');
st().upsertActivity(kart('canli-izleme'), true);
T.ok('Gonderiler acikken canli «izledi» listeye GIRMEZ, rozete sayilmaz', st().activities.length === 0 && st().unseenCount === 0);
st().upsertActivity(kart('canli-gonderi', { activityType: 'posted', note: 'merhaba' }), true);
T.ok('Uyan canli gonderi girer', st().activities.some((a) => a.id === 'canli-gonderi') && st().unseenCount === 1);
st().upsertActivity(kart('temp-x', { isPending: true, activityType: 'posted', note: 'y' }), false);
st().replaceActivity('temp-x', kart('gercek-izleme'));
T.ok('Gercek satir filtreye uymazsa gecici kart yalniz duser', !st().activities.some((a) => a.id === 'temp-x' || a.id === 'gercek-izleme'));
T.ok('Disk kopyasi filtreliyken yuklenmez', st().hydrateFromDisk([kart('d1')]) === false);
st().reset();
T.ok('Cikis filtreyi Tumu yapar', st().filtre === 'tumu');

// Kaynak: gizli başlık + yarış koruması.
const kanca = fs.readFileSync(path.join(root, 'features/feed/hooks/useGizliFiltreBasligi.ts'), 'utf8');
T.ok('Acilista cip yuksekligi kadar asagi kaydirilmis baslar (yalniz Tumu, bir kez)', /scrollToOffset\(\{ offset: cipH, animated: false \}\)/.test(kanca) && /gizlendi\.current \|\| filtre !== 'tumu'/.test(kanca));
T.ok('Kisa listede de gizlenebilsin: icerik >= liste + cip', /icerikMinYukseklik: listeH > 0 \? listeH \+ cipH/.test(kanca));
const feed = fs.readFileSync(path.join(root, 'features/feed/hooks/useFeed.ts'), 'utf8');
T.ok('Yarisa karsi: eski filtrenin yaniti yeni listeye yazilmaz', (feed.match(/getState\(\)\.filtre !== istenen\) return/g) || []).length >= 2);
T.ok('Akis ekrani 400 satirin altinda', fs.readFileSync(path.join(root, 'app/(protected)/(tabs)/feed.tsx'), 'utf8').split('\n').length < 400);
T.bitir();

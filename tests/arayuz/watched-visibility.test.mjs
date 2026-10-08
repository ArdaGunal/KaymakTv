import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tsLoader } from '../ts-test-loader.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = require('../yardimci').baslat('IZLEME KARTI SUREKLILIGI (M441)', { kokOneki: 'watched-visibility-' });
const load = tsLoader(root);
const projection = load('services/library/outbox/projection.ts');
const { categorizeShows } = load('store/tracking/trackingLogic.ts');
const id = 33733, at = '2026-10-03T04:00:00.000Z';
const media = { ids: { trakt: id }, title: 'Fixture (canli hesap degil)' };
const job = { id: 'local', owner: 'test', trakt: true, mediaType: 'show', mediaId: id,
  watchedAt: at, media, parts: [{ season: 1, episodes: [8] }] };
const partial = { aired: 9, completed: 7, next_episode: { season: 1, number: 8, title: 'E08' },
  seasons: [{ number: 1, episodes: [{ number: 8, completed: false }] }] };
const categories = (map, pending = [], list = [{ show: media, last_watched_at: at }]) => categorizeShows({
  watchedShows: list, watchlistShows: [], showProgressMap: map, pendingShowIds: pending,
  now: Date.parse(at), labels: { unnamedShow: '?', notStarted: 'Baslamadi', caughtUp: 'Guncel' },
});
const visible = (c) => c.upNext.length + c.paused.length + c.notStarted.length;

T.H('M440 gercek kod reproducer: eksik sezon -> next=null -> kart kaybi');
projection.setWatchedProjection([job]);
const optimistic = projection.projectProgress({ [id]: partial });
T.ok('Yama bolumu isaretledi; var olmayan E09 uydurulmadi', optimistic[id].seasons[0].episodes[0].completed && !optimistic[id].next_episode);
T.ok('Eksik katalog 7/9 -> 8/9: sahte 1/1 ve final konfeti yok', optimistic[id].completed === 8 && optimistic[id].aired === 9 && optimistic[id].catalogIncomplete === true);
const waiting = categories(optimistic, [id]);
T.ok('Sunucu teyidi beklerken kart kaybolmaz, caughtUp degil', visible(waiting) === 1 && waiting.caughtUp.length === 0);
T.ok('Sahte bolum butonu yok: kart hesaplanma durumunda, ready=false', waiting.upNext[0]?.isCalculating === true && waiting.upNext[0]?.readyToWatch === false);
const resumedList = projection.projectWatchedList([{ show: media, last_watched_at: '2020-01-01T00:00:00Z' }], 'show');
T.ok('Cold replay eski izleme tarihini diriltip kapali paused kovasina tasimaz', resumedList[0].last_watched_at === at && categories(optimistic, [id], resumedList).upNext.length === 1);
T.ok('Bekleyen eski niyet daha yeni izlemeyi geri tarihe cekmez', projection.projectWatchedList([{ show: media, last_watched_at: '2027-01-01T00:00:00Z' }], 'show')[0].last_watched_at.startsWith('2027'));
const other = { ...media, ids: { trakt: 2 } };
T.ok('Diger gercek bitmis dizi pending diye hayatta tutulmaz', categories({ 2: { completed: 1, next_episode: null } }, [id], [{ show: other }]).caughtUp.length === 1);
T.ok('Gizleme onceligi bekleyen yazmada da korunur', categorizeShows({ watchedShows: [{ show: media }], watchlistShows: [],
  showProgressMap: optimistic, pendingShowIds: [id], hiddenShowIds: [id], labels: { unnamedShow: '?', notStarted: '?', caughtUp: '?' } }).hidden.length === 1);

T.H('Tam/otoriter okumayi ayni isaretle ikinci kez hesaplayip bozma');
const confirmed = { ...partial, completed: 8, next_episode: { season: 1, number: 9, title: 'E09' },
  seasons: [{ number: 1, episodes: [{ number: 8, completed: true, last_watched_at: at }] }] };
const afterRead = projection.projectProgress({ [id]: confirmed });
T.ok('Sunucunun E09 bilgisi eksik seasons yuzunden null olmadi', afterRead[id].next_episode?.number === 9);
T.ok('Sunucu sayaclari ikinci yamada 1/1 olarak daralmadi', afterRead[id].aired === 9 && afterRead[id].completed === 8);
projection.setWatchedProjection([{ ...job, feedDone: true }]);
projection.setWatchedProjection([]);
T.ok('Kuyruk bittikten sonra gec gelen yama da karti kaybettirmez', visible(categories(projection.projectProgress({ [id]: confirmed }))) === 1);
const finished = { ...confirmed, aired: 8, next_episode: null };
T.ok('Gercek final teyidi geldikten sonra caughtUp urun kurali surer', categories(projection.projectProgress({ [id]: finished })).caughtUp.length === 1);
projection.setWatchedProjection([], true);

T.H('Gercek runtime: 429 boyunca kart gorunur, cooldown tek okuma');
let clock = Date.parse(at), sends = 0, reads = 0, blocked = true;
class TestDate extends Date { static now() { return clock; } }
const disk = new Map();
const outboxState = { ready: false, pendingCount: 0, hasError: false, pendingShowIds: [] };
const views = [];
let library = { watchedShows: [{ show: media, last_watched_at: at }], watchedMovies: [], watchlistShows: [], watchlistMovies: [], showProgressMap: { [id]: partial } };
let runtimeLoad;
const sample = () => {
  if (!runtimeLoad || !outboxState.pendingCount) return;
  const c = runtimeLoad('store/tracking/trackingLogic.ts').categorizeShows({ ...library,
    pendingShowIds: outboxState.pendingShowIds, now: clock, labels: { unnamedShow: '?', notStarted: '?', caughtUp: '?' } });
  views.push(visible(c));
};
const set = (patch) => { Object.assign(library, typeof patch === 'function' ? patch(library) : patch); sample(); };
runtimeLoad = tsLoader(root, {
  '@react-native-async-storage/async-storage': { default: { getItem: async (k) => disk.get(k) ?? null, setItem: async (k, v) => disk.set(k, v) } },
  '../../../features/feed/services/userBlocks': { getMySupabaseUserId: async () => 'fixture-owner' },
  '../../api/traktClient': { isKaymakSessionToken: () => true },
  '../utils': { CACHE_KEYS: {}, safeStorageSet: () => {}, persistShowProgressMap: () => {} },
  '../../../store/useLibraryStore': { useLibraryStore: { getState: () => library } },
  '../../../store/watchedOutboxStore': { useWatchedOutboxStore: { getState: () => outboxState, setState: (s) => { Object.assign(outboxState, s); sample(); } } },
  './transport': { expandWatchedSeason: async () => [8], writeKaymakWatched: async () => {
    sends++; if (blocked) throw Object.assign(new Error('429 fixture'), { response: { status: 429, headers: { 'retry-after': '45' } } });
  }, writeTraktWatched: async () => {}, publishWatched: async () => {}, readWatchedSnapshot: async () => {
    reads++; return { success: true, diziler: [{ traktId: id, title: media.title, ilerleme: confirmed }], filmler: [] };
  } },
  '../../../utils/errorLog': { logWarning: () => {}, logError: () => {} },
}, { Date: TestDate });
Object.assign(library, runtimeLoad('store/slices/historySlice.ts').createHistorySlice(set));
Object.assign(library, runtimeLoad('store/slices/watchlistSlice.ts').createWatchlistSlice(set));
Object.assign(library, { watchedShows: [{ show: media, last_watched_at: at }], showProgressMap: { [id]: partial } });
const runtime = runtimeLoad('services/library/outbox/runtime.ts');
const tick = () => new Promise((r) => setImmediate(r));
await runtime.startWatchedOutbox('kaymak_session_v1.fixture');
await runtime.queueWatched(job); runtime.resumeWatchedOutbox(); await tick();
T.ok('429 sonrasi pending kimlik ve disk niyeti korunur', outboxState.pendingShowIds.includes(id) && outboxState.hasError && disk.size === 1);
T.ok('Her ara store guncellemesinde kart gorunur, bir an bile 0 degil', views.length > 0 && views.every((n) => n === 1));
clock += 44000; runtime.resumeWatchedOutbox(); runtime.resumeWatchedOutbox(); await tick();
T.ok('Retry-After suresinden once ek yazma/okuma yok', sends === 1 && reads === 0);
blocked = false; clock += 1000; runtime.resumeWatchedOutbox(); await tick();
T.ok('Cooldown sonrasi TEK yazma ve TEK tam okuma', sends === 2 && reads === 1 && outboxState.pendingCount === 0);
T.ok('Teyit sonrasi pending sifir, E09 karti hala gorunur', outboxState.pendingShowIds.length === 0 && visible(categories(library.showProgressMap)) === 1);
runtime.stopWatchedOutbox();
T.ok('Hesap degisimi pending kimliklerini temizler', outboxState.pendingShowIds.length === 0);

T.H('Baglanti: mark 700ms tek-dizi okumasini baslatmaz');
const main = fs.readFileSync(path.join(root, 'services/library/mutations/progress.ts'), 'utf8');
const hook = fs.readFileSync(path.join(root, 'hooks/useTrackingShows.ts'), 'utf8');
const web = fs.readFileSync(path.join(root, 'components/EpisodeCard.web.tsx'), 'utf8');
const button = fs.readFileSync(path.join(root, 'components/EpisodeCheckButton.tsx'), 'utf8');
T.ok('Mark finish yerel cache yazar; okuma yalniz outbox surucusunde', !main.includes('tazelemeyiPlanla') && main.includes('persistShowProgressMap') && main.includes('cancelProgressRefresh'));
T.ok('Hook pending kimliklerine abone ve kategorizasyona bagli', hook.includes('useWatchedOutboxStore') && hook.includes('pendingShowIds,'));
T.ok('Web karti da bilinmeyen bolume basilabilir tik uretmez', /!data\.isCalculating &&\s+data\.season/.test(web));
T.ok('Eksik katalogda next=null final callback calistirmaz', button.includes('!newProgress.catalogIncomplete'));
T.bitir();

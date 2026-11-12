import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('KALICI IZLEME KUYRUGU (M439)', { kokOneki: 'watched-outbox-' });
const { createWatchedOutbox } = tsLoader(root)('services/library/outbox/engine.ts');
const at = '2026-10-03T00:00:00.123Z';
const A = { owner: 'A', token: 'A-token', trakt: false };
const B = { owner: 'B', token: 'B-token', trakt: false };
const draft = (episode = 6) => ({ mediaType: 'show', mediaId: 33733, watchedAt: at,
  parts: [{ season: 1, episodes: [episode] }] });
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise((r) => setImmediate(r));
const key = (job, part, e, s) => `${s.owner}/${job.mediaId}/${part.season}/${e}/${job.watchedAt}`;

function harness(disk = new Map(), remote = new Set(), traktRows = new Set(), overrides = {}) {
  const events = [];
  const ports = {
    read: async (k) => disk.get(k) ?? null,
    write: async (k, v) => { disk.set(k, v); },
    expand: async () => [1, 2],
    kaymak: async (j, p, s) => {
      events.push(['kaymak', j.watchedAt, s.owner]);
      for (const e of p.episodes || [0]) remote.add(key(j, p, e, s));
    },
    trakt: async (j, p, s) => {
      events.push(['trakt', p.traktStarted]);
      for (const e of p.episodes || [0]) traktRows.add(key(j, p, e, s));
    },
    publish: async (_j, s) => { events.push(['publish', s.owner]); },
    refresh: async (s) => { events.push(['refresh', s.owner]); },
    changed: (jobs, error) => { events.push(['changed', jobs.length, error]); },
    ...overrides,
  };
  return { engine: createWatchedOutbox(ports), disk, remote, traktRows, events, ports };
}

T.H('Disk ACK: basari ve ag yazmasindan ONCE kalici niyet');
const gate = deferred();
const h = harness(undefined, undefined, undefined, { write: async (k, v) => { await gate.promise; h.disk.set(k, v); } });
await h.engine.start(A);
let acknowledged = false;
const intent = h.engine.enqueue(draft()).then(() => { acknowledged = true; });
await tick();
await h.engine.drain();
T.ok('Disk bitmeden ACK yok ve ag istegi yok', !acknowledged && h.remote.size === 0 && h.engine.pending().length === 0);
gate.resolve(); await intent;
T.ok('ACK sonrasi diskte ayni zaman damgali islem var', JSON.parse(h.disk.get('kaymak-watched-outbox-v1:A')).jobs[0].watchedAt === at);
T.ok('Token gunlukte YOK', !h.disk.get('kaymak-watched-outbox-v1:A').includes('A-token'));

T.H('Isaretle ve kill: yeni surec ayni sahipte surdurur');
const restarted = harness(h.disk, h.remote);
await restarted.engine.start(A); await restarted.engine.drain();
T.ok('Acilista son S01E06 sunucuya yazildi', restarted.remote.size === 1);
T.ok('Gonderim sonrasi gunluk bosaldi', JSON.parse(h.disk.get('kaymak-watched-outbox-v1:A')).jobs.length === 0);
T.ok('Google-only Trakt a hic gitmedi', !restarted.events.some((e) => e[0] === 'trakt'));

T.H('Sunucu yazdi ama yanit kayboldu: ayni damga, tek satir');
const lost = harness();
lost.ports.kaymak = async (j, p, s) => { for (const e of p.episodes) lost.remote.add(key(j, p, e, s)); throw new Error('yanit kayip'); };
const uncertain = createWatchedOutbox(lost.ports);
await uncertain.start(A); await uncertain.enqueue(draft());
await assert.rejects(uncertain.drain());
T.ok('Yanit kaybinda gunluk silinmedi', JSON.parse(lost.disk.get('kaymak-watched-outbox-v1:A')).jobs.length === 1);
const restored = harness(lost.disk, lost.remote);
await restored.engine.start(A); await restored.engine.drain();
T.ok('Tekrar ayni damgada upsert: satir sayisi hala 1', restored.remote.size === 1);

T.H('Seri disk yazimi ve tek surucu');
const burst = harness(); await burst.engine.start(A);
await Promise.all([burst.engine.enqueue(draft(7)), burst.engine.enqueue(draft(8)), burst.engine.enqueue(draft(9))]);
T.ok('Eszamanli uc niyetin hicbiri diskte ezilmedi', JSON.parse(burst.disk.get('kaymak-watched-outbox-v1:A')).jobs.length === 3);
const f1 = burst.engine.drain(), f2 = burst.engine.drain();
T.ok('Iki drain ayni ucus sozunu paylasir', f1 === f2); await f1;
T.ok('Uc yazma ve TEK toplu sunucu okumasi', burst.remote.size === 3 && burst.events.filter((e) => e[0] === 'refresh').length === 1);

T.H('Disk hatasi ve bozuk gunluk: sessiz kayip/uzerine yazma yok');
const fullDisk = harness(undefined, undefined, undefined, { write: async () => { throw new Error('disk dolu'); } });
await fullDisk.engine.start(A); await assert.rejects(fullDisk.engine.enqueue(draft()));
T.ok('Disk hatasinda pending/ACK/HTTP yok', fullDisk.engine.pending().length === 0 && fullDisk.remote.size === 0);
const corruptDisk = new Map([['kaymak-watched-outbox-v1:A', '{bozuk']]);
const corrupt = harness(corruptDisk); await assert.rejects(corrupt.engine.start(A));
T.ok('Bozuk veri oldugu gibi korundu', corruptDisk.get('kaymak-watched-outbox-v1:A') === '{bozuk');

T.H('Hesap degisimi: eski ucus yeni hesaba sizmaz');
const ownerGate = deferred();
const owner = harness(undefined, undefined, undefined, { kaymak: async (_j, _p, s) => { owner.events.push(['captured', s.owner]); await ownerGate.promise; } });
await owner.engine.start(A); await owner.engine.enqueue(draft());
const oldFlight = owner.engine.drain(); await tick(); owner.engine.stop();
const nextSession = owner.engine.start(B); await tick();
T.ok('Yeni oturum eski belirsiz POST bitmeden yeniden gondermez', owner.engine.current()?.owner === 'B' && owner.events.filter((e) => e[0] === 'captured').length === 1);
ownerGate.resolve(); await oldFlight; await nextSession;
T.ok('B gunlugu bos ve eski A kaydi diskte duruyor', owner.engine.pending().length === 0 && JSON.parse(owner.disk.get('kaymak-watched-outbox-v1:A')).jobs.length === 1);
T.ok('Eski ucus feed/refresh B ile calismadi', !owner.events.some((e) => e[0] === 'publish' || e[0] === 'refresh'));

T.H('Trakt ucus notu once diskte, yari kalmis plan parcasi hatirlanir');
const trSession = { ...A, trakt: true };
const tg = harness();
tg.ports.trakt = async (j, p) => {
  T.ok('POST oncesi traktStarted diskte', JSON.parse(tg.disk.get('kaymak-watched-outbox-v1:A')).jobs[0].parts[0].traktStarted === true);
  throw new Error('trakt yanit kayip');
};
const trEngine = createWatchedOutbox(tg.ports);
await trEngine.start(trSession); await trEngine.enqueue(draft()); await assert.rejects(trEngine.drain());
const trRestart = harness(tg.disk, tg.remote); await trRestart.engine.start(trSession); await trRestart.engine.drain();
T.ok('Kaymak fazi zaten tamam, tekrar gonderilmedi', !trRestart.events.some((e) => e[0] === 'kaymak'));
T.ok('Trakt adaptoru replay=true aldi (gecmis dogrulamasi gerekir)', trRestart.events.find((e) => e[0] === 'trakt')?.[1] === true);

T.H('Gercek tasima adaptoru: replay yalniz eksik Trakt bolumunu yazar');
const http = [];
let historyFailure = false;
const transport = tsLoader(root, {
  axios: { default: {
    get: async (url, opts) => {
      http.push(['GET', url, opts]);
      if (historyFailure) throw new Error('gecmis okunamadi');
      return { headers: { 'x-pagination-page-count': '1' }, data: [{ watched_at: at,
        show: { ids: { trakt: 33733 } }, episode: { season: 1, number: 6 } }] };
    },
    post: async (url, body, opts) => {
      http.push(['POST', url, body, opts]);
      return { data: { added: { episodes: 1 }, success: true, yazilan: 2 } };
    },
  } },
  '../../../features/feed/services/feedPublish': { formatEpisodeCode: (s, e) => `S${s}E${e}` },
})('services/library/outbox/transport.ts');
const job = { ...draft(), owner: 'A', id: 'job', trakt: true };
await transport.writeTraktWatched(job, { season: 1, episodes: [6, 7], traktStarted: true }, trSession);
const post = http.find((e) => e[0] === 'POST');
T.ok('E06 zaten ayni damgada: yalniz E07 POST edildi', post[2].shows[0].seasons[0].episodes.length === 1 && post[2].shows[0].seasons[0].episodes[0].number === 7);
T.ok('Trakt tekrarinda da EYLEM damgasi degismedi', post[2].shows[0].seasons[0].episodes[0].watched_at === at);
http.length = 0; historyFailure = true;
await assert.rejects(transport.writeTraktWatched(job, { season: 1, episodes: [7], traktStarted: true }, trSession));
T.ok('Gecmis okunamazsa korlemesine POST yok', !http.some((e) => e[0] === 'POST'));
await assert.rejects(transport.writeTraktWatched(job, { season: 1, episodes: [7] }, A));
T.ok('Google-only icin Trakt POST reddedildi', !http.some((e) => e[0] === 'POST'));

T.H('ISTEK-SEL (M607): Trakt damgayi SANIYEYE keser; tekrar turu sonsuz donmez');
// Gercek Trakt yaniti: `…:00.000Z`. Bizim damga `…:00.123Z`. Eski kod ms ile karsilastirip mevcut
// kaydi gormuyor, her turda yeniden POST ediyordu (emulatorde olculdu, 2026-11-12).
const traktDamga = at.replace(/\.\d{3}Z$/, '.000Z');
const sahte = (gecmis, postYaniti) => {
  const kayit = [];
  const tr = tsLoader(root, {
    axios: { default: {
      get: async (url, opts) => { kayit.push(['GET', url, opts]); return { headers: { 'x-pagination-page-count': '1' }, data: gecmis() }; },
      post: async (url, body) => { kayit.push(['POST', url, body]); return { data: postYaniti(body) }; },
    } },
    '../../../features/feed/services/feedPublish': { formatEpisodeCode: (s, e) => `S${s}E${e}` },
  })('services/library/outbox/transport.ts');
  return { tr, kayit };
};
const bolumSatiri = (n, damga = traktDamga) => ({ watched_at: damga, show: { ids: { trakt: 33733 } }, episode: { season: 1, number: n } });

const s1 = sahte(() => [bolumSatiri(6), bolumSatiri(7)], () => ({ added: { episodes: 0 } }));
await s1.tr.writeTraktWatched(job, { season: 1, episodes: [6, 7], traktStarted: true }, trSession);
T.ok('Trakt saniyeye kesilmis kayitlar VAR sayildi: tekrar turunda POST yok', !s1.kayit.some((e) => e[0] === 'POST'), JSON.stringify(s1.kayit.map((e) => e[0])));

const s2 = sahte(() => [bolumSatiri(6, '2026-10-03T00:00:01.000Z')], () => ({ added: { episodes: 2 } }));
await s2.tr.writeTraktWatched(job, { season: 1, episodes: [6, 7], traktStarted: true }, trSession);
T.ok('Bir saniye farkli kayit AYNI sayilmaz (yalniz ayni saniye)', s2.kayit.find((e) => e[0] === 'POST')?.[2].shows[0].seasons[0].episodes.length === 2);

let yazildi = false;
const s3 = sahte(() => (yazildi ? [bolumSatiri(7)] : []), () => { yazildi = true; return { added: { episodes: 0 } }; });
await s3.tr.writeTraktWatched(job, { season: 1, episodes: [7] }, trSession);
T.ok('added sayisi tutmasa da gecmiste varsa is BITER (dongu yok)', s3.kayit.filter((e) => e[0] === 'POST').length === 1);

const s4 = sahte(() => [], () => ({ added: { episodes: 0 }, not_found: { episodes: [{ ids: { trakt: 1 } }] } }));
await s4.tr.writeTraktWatched(job, { season: 1, episodes: [7] }, trSession);
T.ok('Trakt bolumu TANIMIYORSA (not_found) is biter, sonsuz tekrar yok', s4.kayit.filter((e) => e[0] === 'POST').length === 1);

// Gercek Trakt yaniti (emulator, 2026-11-12, show 1397 S01E01): zaten izlenmis bolum EKLENMEZ, GUNCELLENIR.
// O saniyede gecmiste satir da yok. Eski kod bunu basarisiz sayip sonsuza dek yeniden POST ediyordu.
const gercekYanit = { added: { movies: 0, episodes: 0 }, updated: { movies: 0, episodes: 1 },
  not_found: { movies: [], shows: [], seasons: [], episodes: [], people: [], users: [] } };
const s6 = sahte(() => [], () => gercekYanit);
await s6.tr.writeTraktWatched(job, { season: 1, episodes: [1], traktStarted: true }, trSession);
T.ok('GERCEK yanit {added:0, updated:1}: is biter, tek POST, dogrulama GET\'i bile yok', s6.kayit.filter((e) => e[0] === 'POST').length === 1
  && s6.kayit.filter((e) => e[0] === 'GET').length === 1, JSON.stringify(s6.kayit.map((e) => e[0])));
T.ok('traktIslenen = added + updated (dizi/film ayri, bozuk alan 0)', s6.tr.traktIslenen(gercekYanit, 'show') === 1
  && s6.tr.traktIslenen({ added: { movies: 1 }, updated: { movies: 'x' } }, 'movie') === 1 && s6.tr.traktIslenen(undefined, 'show') === 0);

const s5 = sahte(() => [], () => ({ added: { episodes: 0 } }));
await assert.rejects(s5.tr.writeTraktWatched(job, { season: 1, episodes: [7] }, trSession));
T.ok('Ne yazildi ne tanimadi dedi: hata (kayit korunur, sessizce yutulmaz)', s5.kayit.filter((e) => e[0] === 'POST').length === 1);
T.ok('traktTanimadi saf: bos/eksik govde false', !s5.tr.traktTanimadi(undefined) && !s5.tr.traktTanimadi({ episodes: [] }) && s5.tr.traktTanimadi({ shows: [{}] }));

T.H('ISTEK-SEL (M607): acilis /feed/sync F5 sikliginda tekrarlanmaz');
const aralik = tsLoader(root, {
  '@react-native-async-storage/async-storage': { default: { getItem: async () => null, setItem: async () => {} } },
})('features/feed/services/feedSyncAraligi.ts');
const dk = 60 * 1000;
T.ok('Son tur yoksa kosulur', aralik.feedSyncAtlanirMi(null, 1_000_000) === false);
T.ok('30 sn once kostuysa atlanir', aralik.feedSyncAtlanirMi(1_000_000, 1_000_000 + 30_000) === true);
T.ok('2 dk dolunca yeniden kosulur', aralik.feedSyncAtlanirMi(1_000_000, 1_000_000 + 2 * dk) === false);
T.ok('Saat geri gittiyse (gelecek damga) kosulur', aralik.feedSyncAtlanirMi(1_000_000 + dk, 1_000_000) === false);
const tetik = fs.readFileSync(path.join(root, 'features/feed/hooks/useFeedSyncTrigger.ts'), 'utf8');
T.ok('Tetikleyici once araligi okuyor, basari ve 429 sonrasi yaziyor', tetik.indexOf('feedSyncAtlanirMi') < tetik.indexOf('syncFeedActivity(accessToken)')
  && (tetik.match(/feedSyncSonTurYaz\(\)/g) || []).length === 2 && tetik.includes('status === 429'));

T.H('Gercek mutasyon: disk ACK olmadan ilerleme/film degismez');
const localGate = deferred();
const state = { showProgressMap: { 33733: { seasons: [{ number: 1, episodes: [{ number: 6, completed: false, first_aired: '2020-01-01' }] }] } },
  watchlistShows: [], watchedShows: [], watchlistMovies: [], watchedMovies: [], calendarMovies: [] };
let durable = false;
const progress = tsLoader(root, {
  '../../../store/useLibraryStore': { useLibraryStore: { getState: () => state } },
  '../utils': {
    CACHE_KEYS: {}, safeStorageSet: () => {}, persistShowProgressMap: () => {},
    setShowProgressMap: (fn) => { assert.equal(durable, true); state.showProgressMap = fn(state.showProgressMap); },
    setWatchlistMovies: (fn) => { assert.equal(durable, true); state.watchlistMovies = fn(state.watchlistMovies); },
    setWatchedMovies: (fn) => { assert.equal(durable, true); state.watchedMovies = fn(state.watchedMovies); },
    setCalendarMovies: (fn) => { state.calendarMovies = fn(state.calendarMovies); },
  },
  '../outbox/runtime': {
    queueWatched: async (d) => { await localGate.promise; durable = true; return d; }, resumeWatchedOutbox: () => {},
  },
  '../../../utils/metrics': { recordMutationResult: () => {} },
  '../../../features/feed/services/feedPublish': { nowStamp: () => at },
  '../../../locales/index': { default: { language: 'tr' } },
  '../mediaMeta': { resolveMediaMeta: () => ({ title: 'Test', tmdbId: 1 }) },
  './progressState': { nesliArtir: () => {}, reactivateShowTracking: () => {}, unhideMovieIfNeeded: () => {},
    mevcutIlerleme: (id) => state.showProgressMap[id], cancelProgressRefresh: () => {} },
  './progressUndo': {},
})('services/library/mutations/progress.ts');
const marking = progress.markEpisodeAsWatched(33733, 1, 6);
const movieMarking = progress.markMovieAsWatched(1, { title: 'Test Film', ids: { trakt: 1 } });
await tick();
T.ok('Disk beklerken tik gri ve film listesi degismedi', !state.showProgressMap[33733].seasons[0].episodes[0].completed && state.watchedMovies.length === 0);
localGate.resolve(); await marking; await movieMarking;
T.ok('Kalici ACK sonrasi bolum ve film isaretli', state.showProgressMap[33733].seasons[0].episodes[0].completed && state.watchedMovies.length === 1);

T.H('Bekleyen yama: sunucu/cache tazelemesi tiki silemez');
const projection = tsLoader(root)('services/library/outbox/projection.ts');
projection.setWatchedProjection([{ ...job, skeleton: [{ number: 1, episodes: [{ number: 6, first_aired: '2020-01-01' }] }] }]);
const projected = projection.projectProgress({});
T.ok('Bos/bayat harita yerine bekleyen E06 yamasini korur', projected[33733]?.seasons[0].episodes[0].completed === true);
projection.setWatchedProjection([], true);
T.ok('Hesap degisince yama temizlendi', Object.keys(projection.projectProgress({})).length === 0);

T.H('Cok sezonlu checkpoint ve son okuma hatasi: tam gunluk korunur');
const pieces = harness(undefined, undefined, undefined, { kaymak: async (j, p, s) => {
  if (p.season === 2) throw new Error('ikinci sezon ag yok');
  for (const e of p.episodes) pieces.remote.add(key(j, p, e, s));
} });
await pieces.engine.start(A);
await pieces.engine.enqueue({ ...draft(), parts: [{ season: 1, episodes: [6, 7] }, { season: 2, episodes: [1, 2] }] });
await assert.rejects(pieces.engine.drain());
const pieceRestart = harness(pieces.disk, pieces.remote);
await pieceRestart.engine.start(A); await pieceRestart.engine.drain();
T.ok('Ilk sezon tekrarlanmadi, iki sezon dort bolum diskte/sunucuda tam', pieceRestart.events.filter((e) => e[0] === 'kaymak').length === 1 && pieces.remote.size === 4);
const readFail = harness(undefined, undefined, undefined, { refresh: async () => { throw new Error('son okuma yok'); } });
await readFail.engine.start(A); await readFail.engine.enqueue(draft()); await assert.rejects(readFail.engine.drain());
T.ok('Remote ACK sonrasi tam okuma dusunce gunluk tutulur', JSON.parse(readFail.disk.get('kaymak-watched-outbox-v1:A')).jobs[0].feedDone === true);
const readRestart = harness(readFail.disk, readFail.remote); await readRestart.engine.start(A); await readRestart.engine.drain();
T.ok('Yeniden acilista kayitlar tekrarlanmaz, yalniz tam okuma/gunluk tamamlama', !readRestart.events.some((e) => e[0] === 'kaymak' || e[0] === 'publish') && readRestart.engine.pending().length === 0);

T.H('Gercek runtime: acilis cift tetik, erken dokunus ve oturum iptali');
const identityGate = deferred();
const rtDisk = new Map();
let rtDiskFailure = false;
let rt401 = false, renewed = 0;
const rtState = { ready: false, pendingCount: 0, hasError: false };
const rtLibrary = { showProgressMap: {}, watchedShows: [], watchedMovies: [], watchlistShows: [], watchlistMovies: [],
  setShowProgressMap: () => {}, setWatchedShows: () => {}, setWatchedMovies: () => {}, setWatchlistShows: () => {}, setWatchlistMovies: () => {} };
let identityCalls = 0;
const runtime = tsLoader(root, {
  '@react-native-async-storage/async-storage': { default: { getItem: async (k) => rtDisk.get(k) ?? null, setItem: async (k, v) => {
    if (rtDiskFailure) throw new Error('disk dolu'); rtDisk.set(k, v);
  } } },
  '../../../features/feed/services/userBlocks': { getMySupabaseUserId: async () => { identityCalls++; return identityGate.promise; } },
  '../../api/traktClient': { isKaymakSessionToken: (token) => token.startsWith('kaymak_session_v1.'),
    refreshAccessToken: async () => { renewed++; return 'fresh'; } },
  '../utils': { CACHE_KEYS: {}, safeStorageSet: () => {}, persistShowProgressMap: () => {} },
  '../../../store/useLibraryStore': { useLibraryStore: { getState: () => rtLibrary } },
  '../../../store/watchedOutboxStore': { useWatchedOutboxStore: { getState: () => rtState, setState: (s) => Object.assign(rtState, s) } },
  './transport': { expandWatchedSeason: async () => [1], writeKaymakWatched: async () => {
    if (rt401) throw Object.assign(new Error('yetki'), { response: { status: 401 } });
  }, writeTraktWatched: async () => {},
    publishWatched: async () => {}, readWatchedSnapshot: async () => ({ success: true }) },
  '../../../utils/errorLog': { logWarning: () => {}, logError: () => {} },
})('services/library/outbox/runtime.ts');
const firstStart = runtime.startWatchedOutbox('kaymak_session_v1.test');
const secondStart = runtime.startWatchedOutbox('kaymak_session_v1.test');
const earlyTap = runtime.queueWatched(draft());
await tick();
T.ok('NetInfo ve mount acilisi TEK soz/kimlik okuma, erken dokunus disk bekler', firstStart === secondStart && identityCalls === 1 && rtDisk.size === 0);
identityGate.resolve('A'); await firstStart; await earlyTap;
T.ok('Erken dokunus dogru sahipte kalici ACK aldi', rtState.ready && JSON.parse(rtDisk.get('kaymak-watched-outbox-v1:A')).jobs.length === 1);
runtime.stopWatchedOutbox();
T.ok('Oturum durmasi diskteki kabul edilmis niyeti SILMEZ', !rtState.ready && JSON.parse(rtDisk.get('kaymak-watched-outbox-v1:A')).jobs.length === 1);
await runtime.startWatchedOutbox('kaymak_session_v1.test');
await runtime.flushWatchedOutbox();
rtDiskFailure = true;
await assert.rejects(runtime.queueWatched(draft(8)));
T.ok('Gercek runtime: disk hatasi tum ekranlarda gorunur, ACK/gunluk yok', rtState.saveError
  && JSON.parse(rtDisk.get('kaymak-watched-outbox-v1:A')).jobs.length === 0);
rtDiskFailure = false;
await runtime.queueWatched(draft(8));
T.ok('Basarili yeni disk ACK hata bandini kapatir', !rtState.saveError);
runtime.stopWatchedOutbox();
rt401 = true;
await runtime.startWatchedOutbox('kaymak_session_v1.test'); await tick();
T.ok('401: Google-only Trakt refresh YOK, niyet diskte durur', renewed === 0 && rtState.hasError
  && JSON.parse(rtDisk.get('kaymak-watched-outbox-v1:A')).jobs.length === 1);
runtime.stopWatchedOutbox();
await runtime.startWatchedOutbox('trakt-test-token'); await tick();
T.ok('401: Trakt oturum ortak yenileme girisini kullanir, kuyruk kaybolmaz', renewed === 1
  && JSON.parse(rtDisk.get('kaymak-watched-outbox-v1:A')).jobs.length === 1);
runtime.stopWatchedOutbox();

T.H('Baglanti denetimi: cikis kuyrugu korur, diger frozen dosyalar degismedi');
const auth = fs.readFileSync(path.join(root, 'context/AuthContext.tsx'), 'utf8');
// M517 · D8: kuyruk istisnasi kalkti (bkz. tests/arayuz/cikis-denetimi.test.mjs).
T.ok('Cikista kuyruk DAHIL tum anahtarlar temizlenir (D8)', /await cihazAnahtarlariniSil\(\);/.test(auth) && !/startsWith\(OUTBOX_PREFIX\)/.test(auth));
const main = fs.readFileSync(path.join(root, 'services/library/mutations/progress.ts'), 'utf8');
T.ok('progress.ts 400 satirin altinda', main.split(/\r?\n/).length <= 400);
T.H('M465 H7: ilk parca tek, kalanlar sinirli dalga, Trakt sirali, kill/replay');
{
  const parts = Array.from({ length: 7 }, (_, i) => ({ season: i + 1, episodes: [1, 2] }));
  let ucusta = 0, enCok = 0; const sira = [];
  const ilkBitti = { v: false }; let ilkBitmedenBasladi = false;
  const w = harness(undefined, undefined, undefined, {
    kaymak: async (j, p) => {
      if (p.season !== 1 && !ilkBitti.v) ilkBitmedenBasladi = true;
      ucusta++; enCok = Math.max(enCok, ucusta); sira.push(p.season);
      await new Promise((r) => setTimeout(r, 15));
      ucusta--; if (p.season === 1) ilkBitti.v = true;
    },
  });
  await w.engine.start(A); await w.engine.enqueue({ ...draft(), parts }); await w.engine.drain();
  T.ok('Ilk parca TEK basina, digerleri ondan sonra', sira[0] === 1 && !ilkBitmedenBasladi);
  T.ok('Kalanlar paralel ama en cok 4', enCok > 1 && enCok <= 4, `enCok=${enCok}`);
  T.ok('Yedi sezonun hepsi yazildi, kuyruk bos', sira.length === 7 && w.engine.pending().length === 0);

  // Kill/replay: 3. sezonda patla → yeniden baslayinca YALNIZ bitmeyenler.
  const disk = new Map(); const yazilan = [];
  let patlat = true;
  const k1 = harness(disk, undefined, undefined, {
    kaymak: async (j, p) => { if (patlat && p.season === 3) throw new Error('ag'); yazilan.push(p.season); },
  });
  await k1.engine.start(A); await k1.engine.enqueue({ ...draft(), parts }); await k1.engine.drain().catch(() => {});
  const ilkTur = new Set(yazilan); patlat = false; yazilan.length = 0;
  const k2 = harness(disk, undefined, undefined, { kaymak: async (j, p) => { yazilan.push(p.season); } });
  await k2.engine.start(A); await k2.engine.drain();
  T.ok('Replay yalniz bitmemis parcalari tekrarlar', yazilan.includes(3) && yazilan.every((s) => !ilkTur.has(s)), `ilk=${[...ilkTur]} replay=${yazilan}`);

  // Trakt hesabinda Trakt yazmalari SIRALI kalir.
  let tUcusta = 0, tEnCok = 0;
  const t = harness(undefined, undefined, undefined, {
    trakt: async () => { tUcusta++; tEnCok = Math.max(tEnCok, tUcusta); await new Promise((r) => setTimeout(r, 5)); tUcusta--; },
  });
  await t.engine.start({ owner: 'T', token: 't', trakt: true });
  await t.engine.enqueue({ ...draft(), parts: parts.slice(0, 4) }); await t.engine.drain();
  T.ok('Trakt yazmalari esanli DEGIL (idempotent degil)', tEnCok === 1);
}

const rootLayout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
const protectedLayout = fs.readFileSync(path.join(root, 'app/(protected)/_layout.tsx'), 'utf8');
T.ok('Soguk detay deep link dahil TEK kok kuyruk surucusu', /useWatchedOutbox\(\)/.test(rootLayout)
  && /<WatchedOutboxBanner/.test(rootLayout) && !/useWatchedOutbox\(\)/.test(protectedLayout));

T.bitir();

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('KALICI BIRAK / GERI AL (M447)', { kokOneki: 'hidden-outbox-' });
const load = tsLoader(root);
const { createHiddenOutbox } = load('services/library/hiddenOutbox/engine.ts');
const { HIDDEN_OUTBOX_PREFIX: prefix } = load('services/library/hiddenOutbox/types.ts');
const A = { owner: 'A', token: 'A-secret', trakt: false };
const B = { owner: 'B', token: 'B-secret', trakt: false };
const draft = (hidden = true, mediaType = 'movie', mediaId = 1044265) => ({ hidden, mediaType, mediaId });
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise((r) => setImmediate(r));
function harness(disk = new Map(), remote = { show: new Set(), movie: new Set() }, overrides = {}) {
  const events = [];
  const ports = {
    read: async (key) => disk.get(key) ?? null,
    write: async (key, value) => { disk.set(key, value); },
    send: async (job, s) => {
      events.push(['send', s.owner, job.hidden, s.token]);
      if (job.hidden) remote[job.mediaType].add(job.mediaId);
      else remote[job.mediaType].delete(job.mediaId);
    },
    snapshot: async () => ({ show: [...remote.show], movie: [...remote.movie] }),
    apply: (data) => { events.push(['apply', data]); },
    changed: (jobs, error) => { events.push(['changed', jobs.length, error]); },
    ...overrides,
  };
  return { engine: createHiddenOutbox(ports), disk, remote, events, ports };
}

T.H('Disk ACK, kill/replay ve idempotent SET');
const gate = deferred();
const first = harness(undefined, undefined, { write: async (key, value) => { await gate.promise; first.disk.set(key, value); } });
await first.engine.start(A);
let acknowledged = false;
const enqueued = first.engine.enqueue(draft()).then(() => { acknowledged = true; });
await tick(); await first.engine.drain();
T.ok('Disk bitmeden UI/HTTP/ACK yok', !acknowledged && !first.engine.pending().length && !first.events.some((e) => e[0] === 'send'));
gate.resolve(); await enqueued;
T.ok('Diskte sahipli intent var, token yok', JSON.parse(first.disk.get(prefix + 'A')).jobs.length === 1 && !first.disk.get(prefix + 'A').includes('secret'));
const cold = harness(first.disk, first.remote); await cold.engine.start(A); await cold.engine.drain();
T.ok('Kapanis sonrasi film gizlendi, sunucudan okundu ve kuyruk bosaldi', cold.remote.movie.has(1044265) && cold.engine.pending().length === 0);
const lost = harness();
lost.ports.send = async (j) => { lost.remote[j.mediaType].add(j.mediaId); throw new Error('200 yaniti kayip'); };
const uncertain = createHiddenOutbox(lost.ports); await uncertain.start(A); await uncertain.enqueue(draft());
await assert.rejects(uncertain.drain());
const replay = harness(lost.disk, lost.remote); await replay.engine.start(A); await replay.engine.drain();
T.ok('Belirsiz basari tekrarinda tek gizli kayit', replay.remote.movie.size === 1 && !replay.engine.pending().length);

T.H('Ters niyet ve ucusa sonradan eklenen is');
const order = harness(); await order.engine.start(A);
await Promise.all([order.engine.enqueue(draft()), order.engine.enqueue(draft(false)), order.engine.enqueue(draft(true, 'show', 33733))]);
await order.engine.drain();
T.ok('Film hide/unhide sirali, dizi ayri: son niyet kazanir', !order.remote.movie.size && order.remote.show.has(33733)
  && order.events.filter((e) => e[0] === 'send').map((e) => e[2]).join(',') === 'true,false,true');
const inflight = deferred(); let sends = 0;
const overlap = harness(undefined, undefined, { send: async (j) => {
  if (++sends === 1) await inflight.promise;
  if (j.hidden) overlap.remote.movie.add(j.mediaId); else overlap.remote.movie.delete(j.mediaId);
} });
await overlap.engine.start(A); await overlap.engine.enqueue(draft());
const f1 = overlap.engine.drain(), f2 = overlap.engine.drain();
T.ok('Tek ucus', f1 === f2);
await tick(); await overlap.engine.enqueue(draft(false)); inflight.resolve(); await f1;
T.ok('Eski ACK yeni geri al niyetini silemez', sends === 2 && !overlap.remote.movie.size && !overlap.engine.pending().length);

T.H('Sunucu dogrulamasi / disk hatasi / bozuk gunluk');
const stale = harness(undefined, undefined, { snapshot: async () => ({ show: [], movie: [] }) });
await stale.engine.start(A); await stale.engine.enqueue(draft()); await assert.rejects(stale.engine.drain());
T.ok('200 sonrasi eski snapshotta niyet silinmez', stale.engine.pending().length === 1 && stale.events.some((e) => e[0] === 'changed' && e[2]));
const partial = harness(undefined, undefined, { snapshot: async () => ({ movie: [1044265] }) });
await partial.engine.start(A); await partial.engine.enqueue(draft()); await assert.rejects(partial.engine.drain());
T.ok('Eksik snapshot gunlugu korur', partial.engine.pending().length === 1);
const diskFailure = harness(undefined, undefined, { write: async () => { throw new Error('disk dolu'); } });
await diskFailure.engine.start(A); await assert.rejects(diskFailure.engine.enqueue(draft()));
T.ok('Disk dolu: UI niyeti / HTTP yok', !diskFailure.engine.pending().length && !diskFailure.remote.movie.size);
const finalDisk = harness(); await finalDisk.engine.start(A); await finalDisk.engine.enqueue(draft());
finalDisk.ports.write = async () => { throw new Error('final disk hatasi'); };
await assert.rejects(finalDisk.engine.drain());
T.ok('Final checkpoint hatasinda niyet ve disk eski haliyle durur', finalDisk.engine.pending().length === 1
  && JSON.parse(finalDisk.disk.get(prefix + 'A')).jobs.length === 1);
for (const raw of ['{bozuk', JSON.stringify({ version: 2, jobs: [] }), JSON.stringify({ version: 1, jobs: [{ ...draft(), id: 'x', owner: 'B', trakt: false }] })]) {
  const corrupt = harness(new Map([[prefix + 'A', raw]])); await assert.rejects(corrupt.engine.start(A));
  await assert.rejects(corrupt.engine.enqueue(draft()));
  T.ok('Bozuk/yabanci gunluk overwrite edilmez', corrupt.disk.get(prefix + 'A') === raw);
}

T.H('Hesap izolasyonu, stop ve ayni hesapta devam');
const ownerGate = deferred();
const owner = harness(undefined, undefined, { send: async (j, s) => {
  owner.events.push(['captured', s.owner, s.token]); await ownerGate.promise;
} });
await owner.engine.start(A); await owner.engine.enqueue(draft());
const old = owner.engine.drain(); await tick(); owner.engine.stop();
const next = owner.engine.start(B); await tick();
ownerGate.resolve(); await old; await next;
T.ok('B bos, A diskte, eski yanit B UI sine uygulanmadi', !owner.engine.pending().length
  && JSON.parse(owner.disk.get(prefix + 'A')).jobs.length === 1 && !owner.events.some((e) => e[0] === 'apply'));
const same = harness(owner.disk); await same.engine.start(A); await same.engine.drain();
T.ok('A tekrar girince kendi intentini tamamlar', same.remote.movie.has(1044265));
const writeGate = deferred();
const switching = harness(undefined, undefined, { write: async (key, value) => { await writeGate.promise; switching.disk.set(key, value); } });
await switching.engine.start(A);
const pendingWrite = switching.engine.enqueue(draft()); await tick(); switching.engine.stop();
const switchStart = switching.engine.start(B); writeGate.resolve(); await assert.rejects(pendingWrite); await switchStart;
T.ok('Oturum disk yazarken degisirse A diski korunur, B UI bos', !switching.engine.pending().length && switching.disk.has(prefix + 'A'));

T.H('Gercek store dilimi: cache ve sunucu eski okumasi kuyrugu ezemez');
const projection = load('services/library/hiddenOutbox/projection.ts');
const { createHiddenShowsSlice } = load('store/slices/hiddenShowsSlice.ts');
let state = {};
state = createHiddenShowsSlice((patch) => { state = { ...state, ...patch }; });
projection.setHiddenProjection([{ ...draft(), id: 'one', owner: 'A', trakt: false },
  { ...draft(false, 'show', 33733), id: 'two', owner: 'A', trakt: false }]);
state.setHiddenMovieIds([]); state.setHiddenShowIds([33733, 42]);
T.ok('Eski cache hide ekler, eski server unhide geri alamaz', state.hiddenMovieIds.includes(1044265) && !state.hiddenShowIds.includes(33733) && state.hiddenShowIds.includes(42));
projection.setHiddenProjection([]); state.setHiddenMovieIds([]);
T.ok('Stop sonrasi eski hesap yamasinin izleri yok', !state.hiddenMovieIds.length);

T.H('Gercek transport: Google-only Worker, Trakt CORS koprusu ve yakalanmis token');
const calls = [];
let response = { data: { success: true, gizliDiziler: [], gizliFilmler: [1044265] }, headers: {} };
const axios = { post: async (...args) => { calls.push(['POST', ...args]); return response; },
  get: async (...args) => { calls.push(['GET', ...args]); return response; } };
const transport = tsLoader(root, { axios: { default: axios } })('services/library/hiddenOutbox/transport.ts');
await transport.sendHidden({ ...draft(), id: 'x', owner: 'A', trakt: false }, A);
await transport.readHiddenSnapshot(A, [{ trakt: false }]);
T.ok('Google token yalniz Worker a, watched/history yok', calls.every((c) => c[1].startsWith('https://worker.invalid/library/'))
  && calls[0][2].traktAccessToken === A.token && calls[0][2].op === 'ekle' && !calls.some((c) => /watched|history/.test(c[1])));
calls.length = 0;
const trakt = { ...A, trakt: true };
response = { data: {}, headers: {} };
await transport.sendHidden({ ...draft(false, 'show', 33733), id: 'x', owner: 'A', trakt: true }, trakt);
T.ok('Trakt remove dogru section ve token header da', calls[0][1] === '/api/trakt-proxy'
  && calls[0][3].params.endpoint === '/users/hidden/progress_watched/remove' && calls[0][3].headers.Authorization === 'Bearer A-secret');
await assert.rejects(transport.sendHidden({ ...draft(), trakt: true }, A));
response = { data: Array.from({ length: 100 }, () => ({ show: { ids: { trakt: 33733 } } })), headers: {} };
await assert.rejects(transport.readHiddenSnapshot(trakt, [{ trakt: true }]));
T.ok('Sayfa basligi olmayan 100 satir kismi basari sayilmaz', true);

T.H('Gercek runtime: 429 beklemesi, eski token iptali ve disk hatasi bandi');
let now = 100000, identity = 'A', online = false, count = 0;
const runtimeDisk = new Map();
const runtimeRemote = { show: new Set(), movie: new Set() };
const runtimeStatus = { ready: false, pendingCount: 0, hasError: false, saveError: false };
const statusStore = { getState: () => runtimeStatus, setState: (patch) => Object.assign(runtimeStatus, patch) };
const runtimeState = { hiddenShowIds: [], hiddenMovieIds: [],
  setHiddenShowIds(ids) { this.hiddenShowIds = ids; }, setHiddenMovieIds(ids) { this.hiddenMovieIds = ids; } };
const runtimeCalls = [];
const runtimeLoader = tsLoader(root, {
  '@react-native-async-storage/async-storage': { default: {
    getItem: async (key) => runtimeDisk.get(key) ?? null,
    setItem: async (key, value) => { runtimeDisk.set(key, value); },
  } },
  '../../../features/feed/services/userBlocks': { getMySupabaseUserId: async () => identity },
  '../../api/traktClient': { isKaymakSessionToken: () => true, refreshAccessToken: async () => {} },
  '../../../store/useLibraryStore': { useLibraryStore: { getState: () => runtimeState } },
  '../../../store/hiddenOutboxStore': { useHiddenOutboxStore: statusStore },
  '../utils': { CACHE_KEYS: { hiddenShowIds: 'shows', hiddenMovieIds: 'movies' }, safeStorageSet: async () => {} },
  '../../../utils/errorLog': { logError: () => {}, logWarning: () => {} },
  './transport': {
    sendHidden: async (job, s) => {
      count++; runtimeCalls.push([s.owner, s.token]);
      if (!online) throw { response: { status: 429, headers: { 'retry-after': '120' } } };
      if (job.hidden) runtimeRemote[job.mediaType].add(job.mediaId); else runtimeRemote[job.mediaType].delete(job.mediaId);
    },
    readHiddenSnapshot: async () => ({ show: [...runtimeRemote.show], movie: [...runtimeRemote.movie] }),
  },
}, { Date: class extends Date { static now() { return now; } } });
const runtime = runtimeLoader('services/library/hiddenOutbox/runtime.ts');
await runtime.startHiddenOutbox('captured-A'); await runtime.queueHidden(draft()); await tick();
T.ok('429 sonrasinda niyet korunur ve bant hata gosterir', runtimeStatus.pendingCount === 1 && runtimeStatus.hasError);
now += 119000; runtime.resumeHiddenOutbox(); await tick();
T.ok('Retry-After 120 sn dolmadan yeni POST yok', count === 1);
now += 1001; online = true; runtime.resumeHiddenOutbox(); await tick(); await tick();
T.ok('Sure dolunca bir gonderim; tamamlaninca bant kalkar', count === 2 && runtimeStatus.pendingCount === 0 && runtimeRemote.movie.has(1044265));
runtime.stopHiddenOutbox(); identity = 'B'; await runtime.startHiddenOutbox('captured-B');
T.ok('B oturumunda A journal gonderilmedi', runtimeCalls.every((c) => c[0] === 'A' && c[1] === 'captured-A'));
await assert.rejects(runtime.queueHidden(draft(true, 'movie', -1)));
T.ok('Yerel kabul hatasi gorunur saveError verir, pending yok', runtimeStatus.saveError && !runtimeStatus.pendingCount);
runtime.stopHiddenOutbox();

T.H('Kaynak entegrasyonu ve guvenlik sinirlari');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const auth = source('context/AuthContext.tsx');
const cleanup = auth.slice(auth.indexOf('const removeKeys'));
T.ok('Cikista hidden surucu token silinmeden once durur', cleanup.indexOf('stopHiddenOutbox()') < cleanup.indexOf("deleteItemAsync('traktAccessToken')"));
T.ok('Cikista iki journal oneki de korunur', cleanup.includes('!key.startsWith(OUTBOX_PREFIX) && !key.startsWith(HIDDEN_OUTBOX_PREFIX)'));
T.ok('Kok hook, UI bant ve iki dil bagli', source('app/_layout.tsx').includes('useHiddenOutbox();')
  && source('components/WatchedOutboxBanner.tsx').includes('hiddenQueued')
  && JSON.parse(source('locales/tr/common.json')).hiddenQueued && JSON.parse(source('locales/en/common.json')).hiddenQueued);
T.ok('Eski optimistic gizleme/rollback kopyasi kalkti', !source('services/library/mutations/collections.ts').includes('beginHiddenMutation')
  && source('services/library/mutations/collections.ts').includes('await queueHidden'));
T.ok('429 retry en az 30 sn; journalda token yok', source('services/library/hiddenOutbox/runtime.ts').includes('Math.max(30000')
  && !source('services/library/hiddenOutbox/types.ts').match(/HiddenJob.*token/));
for (const file of ['engine.ts', 'types.ts', 'projection.ts', 'transport.ts', 'runtime.ts']) {
  T.ok(`${file} 400 satirin altinda`, source('services/library/hiddenOutbox/' + file).split('\n').length < 400);
}
T.bitir();

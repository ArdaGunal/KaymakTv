import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMySupabaseUserId } from '../../../features/feed/services/userBlocks';
import { isKaymakSessionToken, refreshAccessToken } from '../../api/traktClient';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { useHiddenOutboxStore } from '../../../store/hiddenOutboxStore';
import { CACHE_KEYS, safeStorageSet } from '../utils';
import { logError, logWarning } from '../../../utils/errorLog';
import { createHiddenOutbox } from './engine';
import { setHiddenProjection } from './projection';
import { readHiddenSnapshot, sendHidden } from './transport';
import type { HiddenDraft } from './types';

let version = 0;
let retryAt = 0;
let starting: { token: string; version: number; promise: Promise<void> } | null = null;
function persistVisibleHidden() {
  const store = useLibraryStore.getState();
  void safeStorageSet(CACHE_KEYS.hiddenShowIds, JSON.stringify(store.hiddenShowIds));
  void safeStorageSet(CACHE_KEYS.hiddenMovieIds, JSON.stringify(store.hiddenMovieIds));
}
const engine = createHiddenOutbox({
  read: (key) => AsyncStorage.getItem(key), write: (key, value) => AsyncStorage.setItem(key, value),
  send: sendHidden, snapshot: readHiddenSnapshot,
  apply: (snapshot) => {
    const store = useLibraryStore.getState();
    store.setHiddenShowIds(snapshot.show);
    store.setHiddenMovieIds(snapshot.movie);
    persistVisibleHidden();
  },
  changed: (jobs, hasError) => {
    setHiddenProjection(jobs);
    useHiddenOutboxStore.setState({ pendingCount: jobs.length, hasError });
    if (!jobs.length) return;
    const store = useLibraryStore.getState();
    store.setHiddenShowIds(store.hiddenShowIds);
    store.setHiddenMovieIds(store.hiddenMovieIds);
    persistVisibleHidden();
  },
});
export function stopHiddenOutbox() {
  version++;
  retryAt = 0;
  starting = null;
  engine.stop();
  useHiddenOutboxStore.setState({ ready: false, saveError: false });
}
export function startHiddenOutbox(token: string): Promise<void> {
  if (starting?.token === token && starting.version === version) return starting.promise;
  if (engine.current()?.token === token && useHiddenOutboxStore.getState().ready) {
    resumeHiddenOutbox();
    return Promise.resolve();
  }
  stopHiddenOutbox();
  const expected = version;
  const promise = (async () => {
    const owner = await getMySupabaseUserId();
    if (expected !== version) return;
    if (!owner) throw new Error('Gizleme için hesap kimliği çözülemedi.');
    await engine.start({ owner, token, trakt: !isKaymakSessionToken(token) });
    if (expected !== version) return;
    useHiddenOutboxStore.setState({ ready: true });
    resumeHiddenOutbox();
  })().finally(() => { if (starting?.promise === promise) starting = null; });
  starting = { token, version: expected, promise };
  return promise;
}
export async function queueHidden(draft: HiddenDraft) {
  const expected = version;
  try {
    await starting?.promise;
    if (expected !== version) throw new Error('Gizleme oturumu değişti.');
    await engine.enqueue(draft);
    useHiddenOutboxStore.setState({ saveError: false });
    resumeHiddenOutbox();
  } catch (error) {
    if (expected === version) {
      useHiddenOutboxStore.setState({ saveError: true });
      logError('hiddenOutbox.save', new Error('Yerel gizleme ACK alınamadı; başarı gösterilmedi.'));
    }
    throw error;
  }
}
export function resumeHiddenOutbox() {
  if (Date.now() < retryAt) return;
  const expected = version;
  void engine.drain().then(() => {
    if (expected === version && useHiddenOutboxStore.getState().ready && engine.pending().length) resumeHiddenOutbox();
  }).catch((error) => {
    if (expected !== version) return;
    const status = error?.response?.status;
    const raw = error?.response?.headers?.['retry-after'];
    const seconds = Number(raw);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(raw) - Date.now();
    retryAt = Date.now() + (status === 429 ? Math.max(30000, Number.isFinite(delay) ? delay : 60000) : 5000);
    logWarning('hiddenOutbox.retry', new Error(status ? `Gizleme gönderimi bekliyor (${status}).` : 'Gizleme gönderimi bekliyor.'));
    if (status === 401 && engine.current()?.trakt) void refreshAccessToken().catch(() => {});
  });
}

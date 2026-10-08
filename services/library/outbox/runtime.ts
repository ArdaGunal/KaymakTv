import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMySupabaseUserId } from '../../../features/feed/services/userBlocks';
import { isKaymakSessionToken, refreshAccessToken } from '../../api/traktClient';
import { yanitiSekillendir } from '../kaymakSekil';
import { CACHE_KEYS, safeStorageSet, persistShowProgressMap } from '../utils';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { useWatchedOutboxStore } from '../../../store/watchedOutboxStore';
import { createWatchedOutbox } from './engine';
import { setWatchedProjection, clearSettledProjection } from './projection';
import { expandWatchedSeason, writeKaymakWatched, writeTraktWatched, publishWatched, readWatchedSnapshot } from './transport';
import { logWarning, logError } from '../../../utils/errorLog';
import type { WatchedDraft } from './types';

let version = 0;
let retryAt = 0;
let starting: { token: string; version: number; promise: Promise<void> } | null = null;
const engine = createWatchedOutbox({
  read: (key) => AsyncStorage.getItem(key),
  write: (key, value) => AsyncStorage.setItem(key, value),
  expand: expandWatchedSeason, kaymak: writeKaymakWatched,
  trakt: writeTraktWatched, publish: publishWatched,
  refresh: async (s) => {
    if (engine.current() !== s) return;
    const response = await readWatchedSnapshot(s);
    if (engine.current() !== s) return;
    if (!response.success || response.kirpildi) throw new Error('Sunucu okuması tamamlanamadı; günlük korunuyor.');
    const data = yanitiSekillendir(response);
    const store = useLibraryStore.getState();
    store.setShowProgressMap(data.showProgressMap);
    store.setWatchedShows(data.watchedShows);
    store.setWatchedMovies(data.watchedMovies);
    // Bekleyen daha yeni işlerin yaması dahil anlık görüntü diske yazılır.
    persistShowProgressMap(useLibraryStore.getState().showProgressMap);
    void safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(useLibraryStore.getState().watchedShows));
    void safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(useLibraryStore.getState().watchedMovies));
  },
  changed: (jobs, hasError) => {
    setWatchedProjection(jobs);
    // Sunucu okuması ve disk checkpoint'i bitene kadar kart nihai caughtUp
    // sayılmaz. Identiteler hesap değişiminde changed([]) ile temizlenir.
    const pendingShowIds = [...new Set(jobs.filter((j) => j.mediaType === 'show').map((j) => j.mediaId))];
    useWatchedOutboxStore.setState({ pendingCount: jobs.length, pendingShowIds, hasError });
    if (!jobs.length) return;
    const store = useLibraryStore.getState();
    store.setShowProgressMap(store.showProgressMap);
    store.setWatchedShows(store.watchedShows);
    store.setWatchedMovies(store.watchedMovies);
    store.setWatchlistShows(store.watchlistShows);
    store.setWatchlistMovies(store.watchlistMovies);
  },
});

export function stopWatchedOutbox() {
  version++;
  retryAt = 0;
  starting = null;
  setWatchedProjection([], true);
  engine.stop();
  useWatchedOutboxStore.setState({ ready: false, saveError: false });
}
export function startWatchedOutbox(token: string): Promise<void> {
  if (starting?.token === token && starting.version === version) return starting.promise;
  if (engine.current()?.token === token && useWatchedOutboxStore.getState().ready) {
    resumeWatchedOutbox();
    return Promise.resolve();
  }
  stopWatchedOutbox();
  const expected = version;
  const promise = (async () => {
    // Sabit users.id ağsız diskten okunur; token günlüğe yazılmaz.
    const owner = await getMySupabaseUserId();
    if (expected !== version) return;
    if (!owner) throw new Error('İşaretleme için hesap kimliği çözülemedi.');
    await engine.start({ owner, token, trakt: !isKaymakSessionToken(token) });
    if (expected !== version) return;
    useWatchedOutboxStore.setState({ ready: true });
    resumeWatchedOutbox();
  })().finally(() => { if (starting?.promise === promise) starting = null; });
  starting = { token, version: expected, promise };
  return promise;
}
export const queueWatched = async (draft: WatchedDraft) => {
  const expected = version;
  try {
    await starting?.promise;
    if (expected !== version) throw new Error('İşaretleme oturumu değişti.');
    const job = await engine.enqueue(draft);
    if (expected === version) useWatchedOutboxStore.setState({ saveError: false });
    return job;
  } catch (error) {
    if (expected === version) {
      useWatchedOutboxStore.setState({ saveError: true });
      logError('watchedOutbox.save', new Error('Yerel işaretleme ACK alınamadı; başarı gösterilmedi.'));
    }
    throw error;
  }
};
export function resumeWatchedOutbox() {
  if (Date.now() < retryAt) return;
  const expected = version;
  void engine.drain().then(() => {
    // Eski uçuş kapanırken diske eklenen yeni niyet 30sn zamanlayıcıyı beklemez.
    if (expected === version && useWatchedOutboxStore.getState().ready && engine.pending().length) resumeWatchedOutbox();
  }).catch((error) => {
    if (expected !== version) return;
    const status = error?.response?.status;
    const retryAfter = error?.response?.headers?.['retry-after'];
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
    retryAt = Date.now() + (status === 429 ? Math.max(30000, Number.isFinite(delay) ? delay : 60000) : 5000);
    // Token/gövde loglanmaz. Kayıt korunur; bant kullanıcıya durum bildirir.
    logWarning('watchedOutbox.retry', new Error(error?.response?.status
      ? `İşaretleme gönderimi bekliyor (${error.response.status}).` : 'İşaretleme gönderimi bekliyor.'));
    // Yakalanmış token eskidiyse ortak tek-uçuş yenilemeyi kullan. Auth'ın
    // token olayı kök sürücüyü yeniden başlatır; Google-only ASLA yenilemez.
    if (status === 401 && engine.current()?.trakt) void refreshAccessToken().catch(() => {});
  });
}
/** Geri alma/silme önceki bekleyen eklemeyi SOLLAMAZ. Ağ yoksa silme yapılmaz. */
export async function flushWatchedOutbox() {
  if (!engine.current()) throw new Error('İşaretleme oturumu hazır değil.');
  await engine.drain();
  if (engine.pending().length) throw new Error('Önce bekleyen işaretlemelerin gönderilmesi gerekiyor.');
  clearSettledProjection();
}

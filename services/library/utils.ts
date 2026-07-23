import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibraryStore } from '../../store/useLibraryStore';
import { filterUserLists } from '../../utils/listHelpers';

export const safeStorageSet = async (key: string, value: string) => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error(`AsyncStorage Kayıt Hatası (${key}):`, error);
    Alert.alert(
      "Depolama Alanı Dolu",
      "Cihazınızda yeterli alan olmadığı veya yerel depolama kotası aşıldığı için bazı veriler cihazınıza kaydedilemiyor."
    );
  }
};

export const safeStorageMultiSet = async (keyValuePairs: [string, string][]) => {
  try {
    await AsyncStorage.multiSet(keyValuePairs);
  } catch (error) {
    console.error('AsyncStorage Toplu Kayıt Hatası:', error);
    Alert.alert(
      "Depolama Alanı Dolu",
      "Cihazınızda yeterli alan olmadığı için çoklu veriler cihazınıza kaydedilemiyor."
    );
  }
};

// --- CHUNKED STORAGE (Android SQLite CursorWindow Koruması) ---
// showProgressMap gibi kütüphane büyüklüğüyle orantılı büyüyen haritalar (her
// dizi için TÜM sezon/bölüm completed durumları) TEK bir AsyncStorage satırı
// olarak saklanırsa, büyük kütüphanelerde (binlerce dizi) bu satır Android'in
// varsayılan SQLite CursorWindow limitini (~1-2MB) aşıp o anahtarın hem
// okunmasını hem yazılmasını patlatabilir. Bunun yerine harita sabit boyutlu
// (STORAGE_CHUNK_SIZE) parçalara bölünüp ayrı anahtarlara yazılır; her parça
// bağımsız okunduğu için biri bozulsa/aşırı büyürse bile yalnızca o parçadaki
// diziler kaybolur, tüm harita değil.
const STORAGE_CHUNK_SIZE = 100;

export const writeChunkedRecord = async (
  baseKey: string,
  record: Record<string, any>,
  options?: { silent?: boolean }
) => {
  const entries = Object.entries(record || {});
  const chunkKeys: string[] = [];
  const pairs: [string, string][] = [];

  for (let i = 0; i < entries.length; i += STORAGE_CHUNK_SIZE) {
    const chunkKey = `${baseKey}__c${chunkKeys.length}`;
    chunkKeys.push(chunkKey);
    pairs.push([chunkKey, JSON.stringify(Object.fromEntries(entries.slice(i, i + STORAGE_CHUNK_SIZE)))]);
  }
  pairs.push([`${baseKey}__meta`, JSON.stringify({ chunkKeys })]);

  // Parça sayısı önceki yazımdan azaldıysa (örn. onlarca dizi silindi) artık
  // kullanılmayan eski parçalar diskte öksüz kalmasın diye temizlenir.
  try {
    const prevMetaRaw = await AsyncStorage.getItem(`${baseKey}__meta`);
    if (prevMetaRaw) {
      const prevMeta = JSON.parse(prevMetaRaw);
      const orphanKeys = (prevMeta.chunkKeys || []).filter((k: string) => !chunkKeys.includes(k));
      if (orphanKeys.length > 0) await AsyncStorage.multiRemove(orphanKeys).catch(() => {});
    }
  } catch {
    // Eski meta okunamadıysa öksüz temizliği atlanır — bir sonraki başarılı
    // yazımda tekrar denenir, veri kaybı yok.
  }

  if (options?.silent) {
    // Arka planda sık sık tetiklenen ara (checkpoint) yazımlar için: hata
    // olursa sessizce loglanır, kullanıcıya art arda "Depolama Dolu" uyarısı
    // spam'lenmez (aşağıdaki final/mutation yazımları zaten uyarıyor).
    try {
      await AsyncStorage.multiSet(pairs);
    } catch (error) {
      console.error(`[Chunked Storage] Sessiz kayıt hatası (${baseKey}):`, error);
    }
  } else {
    await safeStorageMultiSet(pairs);
  }
};

export const readChunkedRecord = async (baseKey: string): Promise<Record<string, any>> => {
  try {
    const metaRaw = await AsyncStorage.getItem(`${baseKey}__meta`);
    if (!metaRaw) {
      // Geriye dönük uyumluluk: chunk mekanizmasından önce yazılmış eski
      // tek-parça (chunk'lanmamış) format.
      const legacyRaw = await AsyncStorage.getItem(baseKey);
      return legacyRaw && legacyRaw !== 'null' ? JSON.parse(legacyRaw) : {};
    }

    const { chunkKeys }: { chunkKeys: string[] } = JSON.parse(metaRaw);
    const merged: Record<string, any> = {};

    // Her parça BAĞIMSIZ okunur: biri bozuksa (parse hatası) yalnızca o parça
    // (en fazla 100 dizinin ilerlemesi) atlanır, geri kalan harita korunur —
    // safeMultiGet'teki "tek satır tüm batch'i patlatmasın" prensibiyle aynı.
    for (const key of chunkKeys) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) Object.assign(merged, JSON.parse(raw));
      } catch {
        // Bozuk parça atlanır.
      }
    }
    return merged;
  } catch {
    return {};
  }
};

export const persistShowProgressMap = (map: Record<string, any>) => {
  writeChunkedRecord(CACHE_KEYS.showProgressMap, map).catch(() => {});
};

export const CACHE_KEYS = {
  watchedShows: '@trakt_lib_watchedShows',
  watchedMovies: '@trakt_lib_watchedMovies',
  customLists: '@trakt_lib_customLists',
  favShows: '@trakt_lib_favShows',
  favMovies: '@trakt_lib_favMovies',
  watchlistShows: '@trakt_lib_watchlistShows',
  calendarShows: '@trakt_lib_calendarShows',
  watchlistMovies: '@trakt_lib_watchlistMovies',
  calendarMovies: '@trakt_lib_calendarMovies',
  userRatingsShows: '@trakt_lib_userRatingsShows',
  userRatingsMovies: '@trakt_lib_userRatingsMovies',
  userRatingsEpisodes: '@trakt_lib_userRatingsEpisodes',
  showProgressMap: '@trakt_lib_showProgressMap',
  calendarSeasonsMap: '@trakt_lib_calendarSeasonsMap',
  lastFetchTime: '@trakt_lib_lastFetchTime',
  userStats: '@trakt_lib_userStats',
  hiddenShowIds: '@trakt_lib_hiddenShowIds'
};

export let currentAccessToken: string | null = null;
export const setLibraryToken = (t: string | null) => { currentAccessToken = t; };

// Zustand State Setters — libraryService modülleri arasında paylaşılan tek kaynak.
export const setWatchedShows = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.watchedShows) : val;
  state.setWatchedShows(nextVal);
};
export const setWatchedMovies = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.watchedMovies) : val;
  state.setWatchedMovies(nextVal);
};
export const setCustomLists = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.customLists) : val;
  // TEK SÜZME NOKTASI: favori (liked) listesi kullanıcı listelerinden her yazımda
  // ayıklanır. Böylece profil, "listeye ekle", kütüphane vb. tüm tüketiciler
  // otomatik olarak temiz kalır ve "ikinci favoriler" karışıklığı ortadan kalkar.
  state.setCustomLists(filterUserLists(Array.isArray(nextVal) ? nextVal : []));
};
export const setFavShows = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.favShows) : val;
  state.setFavShows(nextVal);
};
export const setFavMovies = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.favMovies) : val;
  state.setFavMovies(nextVal);
};
export const setWatchlistShows = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.watchlistShows) : val;
  state.setWatchlistShows(nextVal);
};
export const setCalendarShows = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.calendarShows) : val;
  state.setCalendarShows(nextVal);
};
export const setWatchlistMovies = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.watchlistMovies) : val;
  state.setWatchlistMovies(nextVal);
};
export const setCalendarMovies = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.calendarMovies) : val;
  state.setCalendarMovies(nextVal);
};
export const setUserRatingsShows = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.userRatingsShows) : val;
  state.setUserRatingsShows(nextVal);
};
export const setUserRatingsMovies = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.userRatingsMovies) : val;
  state.setUserRatingsMovies(nextVal);
};
export const setUserRatingsEpisodes = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.userRatingsEpisodes) : val;
  state.setUserRatingsEpisodes(nextVal);
};
export const setShowProgressMap = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.showProgressMap) : val;
  state.setShowProgressMap(nextVal);
};
export const setCalendarSeasonsMap = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.calendarSeasonsMap) : val;
  state.setCalendarSeasonsMap(nextVal);
};
export const setUserStats = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.userStats) : val;
  state.setUserStats(nextVal);
};
export const setHiddenShowIds = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.hiddenShowIds) : val;
  state.setHiddenShowIds(nextVal);
};
export const setIsLoading = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.isLoading) : val;
  state.setIsLoading(nextVal);
};
export const setIsMoviesLoading = (val: any) => {
  const state = useLibraryStore.getState();
  const nextVal = typeof val === 'function' ? val(state.isMoviesLoading) : val;
  state.setIsMoviesLoading(nextVal);
};

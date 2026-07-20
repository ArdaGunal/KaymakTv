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
  lastFetchTime: '@trakt_lib_lastFetchTime'
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

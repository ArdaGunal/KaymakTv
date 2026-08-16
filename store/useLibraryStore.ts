import { create } from 'zustand';
import { createHistorySlice, HistorySlice } from './slices/historySlice';
import { createWatchlistSlice, WatchlistSlice } from './slices/watchlistSlice';
import { createFavoritesSlice, FavoritesSlice } from './slices/favoritesSlice';
import { createListsSlice, ListsSlice } from './slices/listsSlice';
import { createCalendarSlice, CalendarSlice } from './slices/calendarSlice';
import { createRatingsSlice, RatingsSlice } from './slices/ratingsSlice';
import { createStatsSlice, StatsSlice } from './slices/statsSlice';
import { createHiddenShowsSlice, HiddenShowsSlice } from './slices/hiddenShowsSlice';

export interface LibraryState extends
  HistorySlice,
  WatchlistSlice,
  FavoritesSlice,
  ListsSlice,
  CalendarSlice,
  RatingsSlice,
  StatsSlice,
  HiddenShowsSlice {
    isLoading: boolean;
    isMoviesLoading: boolean;
    /** Son `fetchFreshData` denemesinde TÜM kritik istekler (izleme geçmişi,
     *  izleme listesi, takvim) başarısız oldu mu — bkz. fetchers.ts. Yalnızca
     *  ağ/sunucu hatasında true olur; kullanıcının GERÇEKTEN hiç dizisi/filmi
     *  olmaması (boş ama başarılı yanıt) bunu tetiklemez. Ekranlar bunu
     *  "boş" ile "yüklenemedi" durumunu ayırt etmek için kullanır. */
    hasSyncError: boolean;
    setIsLoading: (val: boolean) => void;
    setIsMoviesLoading: (val: boolean) => void;
    setHasSyncError: (val: boolean) => void;
    clearAll: () => void;
}

export const useLibraryStore = create<LibraryState>((...a) => ({
  ...createHistorySlice(...a),
  ...createWatchlistSlice(...a),
  ...createFavoritesSlice(...a),
  ...createListsSlice(...a),
  ...createCalendarSlice(...a),
  ...createRatingsSlice(...a),
  ...createStatsSlice(...a),
  ...createHiddenShowsSlice(...a),

  isLoading: true,
  isMoviesLoading: true,
  hasSyncError: false,
  setIsLoading: (val) => a[0]({ isLoading: val }),
  setIsMoviesLoading: (val) => a[0]({ isMoviesLoading: val }),
  setHasSyncError: (val) => a[0]({ hasSyncError: val }),

  clearAll: () => a[0]({
    watchedShows: [],
    watchedMovies: [],
    showProgressMap: {},
    watchlistShows: [],
    watchlistMovies: [],
    favShows: [],
    favMovies: [],
    customLists: [],
    calendarShows: [],
    calendarMovies: [],
    calendarSeasonsMap: {},
    userRatingsShows: [],
    userRatingsMovies: [],
    userRatingsEpisodes: [],
    userStats: null,
    hiddenShowIds: [],
    hiddenMovieIds: [],
    isLoading: true,
    isMoviesLoading: true,
    hasSyncError: false,
  }),
}));

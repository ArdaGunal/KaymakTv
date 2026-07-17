import { create } from 'zustand';
import { createHistorySlice, HistorySlice } from './slices/historySlice';
import { createWatchlistSlice, WatchlistSlice } from './slices/watchlistSlice';
import { createFavoritesSlice, FavoritesSlice } from './slices/favoritesSlice';
import { createListsSlice, ListsSlice } from './slices/listsSlice';
import { createCalendarSlice, CalendarSlice } from './slices/calendarSlice';
import { createRatingsSlice, RatingsSlice } from './slices/ratingsSlice';

export interface LibraryState extends 
  HistorySlice, 
  WatchlistSlice, 
  FavoritesSlice, 
  ListsSlice, 
  CalendarSlice, 
  RatingsSlice {
    isLoading: boolean;
    isMoviesLoading: boolean;
    setIsLoading: (val: boolean) => void;
    setIsMoviesLoading: (val: boolean) => void;
    clearAll: () => void;
}

export const useLibraryStore = create<LibraryState>((...a) => ({
  ...createHistorySlice(...a),
  ...createWatchlistSlice(...a),
  ...createFavoritesSlice(...a),
  ...createListsSlice(...a),
  ...createCalendarSlice(...a),
  ...createRatingsSlice(...a),
  
  isLoading: true,
  isMoviesLoading: true,
  setIsLoading: (val) => a[0]({ isLoading: val }),
  setIsMoviesLoading: (val) => a[0]({ isMoviesLoading: val }),
  
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
    isLoading: true,
    isMoviesLoading: true,
  }),
}));

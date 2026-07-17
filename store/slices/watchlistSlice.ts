import { StateCreator } from 'zustand';

export interface WatchlistSlice {
  watchlistShows: any[];
  watchlistMovies: any[];
  setWatchlistShows: (shows: any[]) => void;
  setWatchlistMovies: (movies: any[]) => void;
}

export const createWatchlistSlice: StateCreator<WatchlistSlice> = (set) => ({
  watchlistShows: [],
  watchlistMovies: [],
  setWatchlistShows: (shows) => set({ watchlistShows: shows }),
  setWatchlistMovies: (movies) => set({ watchlistMovies: movies }),
});

import { StateCreator } from 'zustand';
import { projectWatchlist } from '../../services/library/outbox/projection';

export interface WatchlistSlice {
  watchlistShows: any[];
  watchlistMovies: any[];
  setWatchlistShows: (shows: any[]) => void;
  setWatchlistMovies: (movies: any[]) => void;
}

export const createWatchlistSlice: StateCreator<WatchlistSlice> = (set) => ({
  watchlistShows: [],
  watchlistMovies: [],
  setWatchlistShows: (shows) => set({ watchlistShows: projectWatchlist(shows, 'show') }),
  setWatchlistMovies: (movies) => set({ watchlistMovies: projectWatchlist(movies, 'movie') }),
});

import { StateCreator } from 'zustand';

export interface FavoritesSlice {
  favShows: any[];
  favMovies: any[];
  setFavShows: (shows: any[]) => void;
  setFavMovies: (movies: any[]) => void;
}

export const createFavoritesSlice: StateCreator<FavoritesSlice> = (set) => ({
  favShows: [],
  favMovies: [],
  setFavShows: (shows) => set({ favShows: shows }),
  setFavMovies: (movies) => set({ favMovies: movies }),
});

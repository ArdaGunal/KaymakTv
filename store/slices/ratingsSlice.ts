import { StateCreator } from 'zustand';

export interface RatingsSlice {
  userRatingsShows: any[];
  userRatingsMovies: any[];
  userRatingsEpisodes: any[];
  setUserRatingsShows: (ratings: any[]) => void;
  setUserRatingsMovies: (ratings: any[]) => void;
  setUserRatingsEpisodes: (ratings: any[]) => void;
}

export const createRatingsSlice: StateCreator<RatingsSlice> = (set) => ({
  userRatingsShows: [],
  userRatingsMovies: [],
  userRatingsEpisodes: [],
  setUserRatingsShows: (ratings) => set({ userRatingsShows: ratings }),
  setUserRatingsMovies: (ratings) => set({ userRatingsMovies: ratings }),
  setUserRatingsEpisodes: (ratings) => set({ userRatingsEpisodes: ratings }),
});

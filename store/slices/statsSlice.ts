import { StateCreator } from 'zustand';

export interface TraktStatsCategory {
  watched: number;
  minutes: number;
}

// Trakt /users/me/stats yanıtının yalnızca profil kartında kullandığımız dilimi.
export interface TraktStats {
  movies: TraktStatsCategory;
  episodes: TraktStatsCategory;
}

export interface StatsSlice {
  userStats: TraktStats | null;
  setUserStats: (stats: TraktStats | null) => void;
}

export const createStatsSlice: StateCreator<StatsSlice> = (set) => ({
  userStats: null,
  setUserStats: (stats) => set({ userStats: stats }),
});

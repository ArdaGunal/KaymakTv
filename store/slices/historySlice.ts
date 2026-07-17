import { StateCreator } from 'zustand';

export interface HistorySlice {
  watchedShows: any[];
  watchedMovies: any[];
  showProgressMap: Record<string, any>;
  setWatchedShows: (shows: any[]) => void;
  setWatchedMovies: (movies: any[]) => void;
  setShowProgressMap: (map: Record<string, any>) => void;
  updateShowProgress: (id: string, progress: any) => void;
}

export const createHistorySlice: StateCreator<HistorySlice> = (set) => ({
  watchedShows: [],
  watchedMovies: [],
  showProgressMap: {},
  setWatchedShows: (shows) => set({ watchedShows: shows }),
  setWatchedMovies: (movies) => set({ watchedMovies: movies }),
  setShowProgressMap: (map) => set({ showProgressMap: map }),
  updateShowProgress: (id, progress) => set((state) => ({
    showProgressMap: { ...state.showProgressMap, [id]: progress }
  })),
});

import { StateCreator } from 'zustand';
import { projectProgress, projectWatchedList } from '../../services/library/outbox/projection';

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
  setWatchedShows: (shows) => set({ watchedShows: projectWatchedList(shows, 'show') }),
  setWatchedMovies: (movies) => set({ watchedMovies: projectWatchedList(movies, 'movie') }),
  setShowProgressMap: (map) => set({ showProgressMap: projectProgress(map) }),
  updateShowProgress: (id, progress) => set((state) => ({
    showProgressMap: projectProgress({ ...state.showProgressMap, [id]: progress })
  })),
});

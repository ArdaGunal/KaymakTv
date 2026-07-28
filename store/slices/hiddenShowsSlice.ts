import { StateCreator } from 'zustand';

export interface HiddenShowsSlice {
  /** Trakt'ta "İlerlemeyi Gizle" ile gizlenmiş dizilerin trakt id'leri —
   * cihaza özel DEĞİL, Trakt'ın kendi `/users/hidden/progress_watched`
   * listesinden gelir (bkz. services/api/users.ts:getHiddenShows), bu yüzden
   * mobil/web arasında otomatik senkron kalır. Uygulamanın "Bırak" eylemi
   * hem diziler hem filmler için DOĞRUDAN bu Trakt gizleme uç noktasına
   * bağlıdır — ayrı bir yerel "bırakıldı" durumu YOKTUR (bkz.
   * store/tracking/trackingLogic.ts, store/tracking/movieTrackingLogic.ts). */
  hiddenShowIds: number[];
  setHiddenShowIds: (ids: number[]) => void;
  /** Filmler için aynı mekanizmanın karşılığı — Trakt'ta ilerlemesi olmayan
   * filmler `calendar` bölümünden gizlenir (bkz. getHiddenMovies). */
  hiddenMovieIds: number[];
  setHiddenMovieIds: (ids: number[]) => void;
}

export const createHiddenShowsSlice: StateCreator<HiddenShowsSlice> = (set) => ({
  hiddenShowIds: [],
  setHiddenShowIds: (ids) => set({ hiddenShowIds: ids }),
  hiddenMovieIds: [],
  setHiddenMovieIds: (ids) => set({ hiddenMovieIds: ids }),
});

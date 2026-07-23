import { StateCreator } from 'zustand';

export interface HiddenShowsSlice {
  /** Trakt'ta "İlerlemeyi Gizle" ile gizlenmiş dizilerin trakt id'leri —
   * droppedShowIds'in aksine bu, cihaza özel DEĞİL, Trakt'ın kendi
   * `/users/hidden/progress_watched` listesinden gelir (bkz.
   * services/api/users.ts:getHiddenShows), bu yüzden mobil/web arasında
   * otomatik senkron kalır. */
  hiddenShowIds: number[];
  setHiddenShowIds: (ids: number[]) => void;
}

export const createHiddenShowsSlice: StateCreator<HiddenShowsSlice> = (set) => ({
  hiddenShowIds: [],
  setHiddenShowIds: (ids) => set({ hiddenShowIds: ids }),
});

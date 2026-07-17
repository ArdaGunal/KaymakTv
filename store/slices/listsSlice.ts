import { StateCreator } from 'zustand';

export interface ListsSlice {
  customLists: any[];
  setCustomLists: (lists: any[]) => void;
}

export const createListsSlice: StateCreator<ListsSlice> = (set) => ({
  customLists: [],
  setCustomLists: (lists) => set({ customLists: lists }),
});

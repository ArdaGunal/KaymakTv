import { create } from 'zustand';

export const useHiddenOutboxStore = create<{
  ready: boolean; pendingCount: number; hasError: boolean; saveError: boolean;
}>(() => ({ ready: false, pendingCount: 0, hasError: false, saveError: false }));

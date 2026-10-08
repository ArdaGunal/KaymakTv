import { create } from 'zustand';

export const useWatchedOutboxStore = create<{
  ready: boolean; pendingCount: number; pendingShowIds: number[]; hasError: boolean; saveError: boolean;
}>(() => ({ ready: false, pendingCount: 0, pendingShowIds: [], hasError: false, saveError: false }));

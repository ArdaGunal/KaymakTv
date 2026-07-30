import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyFollowingSlugs } from '../services/api/social';
import { ConnectionState } from '../hooks/useFollowState';

interface FollowState {
  connectionStates: Record<string, ConnectionState>;
  isFetched: boolean;
  isLoading: boolean;
  fetchFollowingSlugs: (force?: boolean) => Promise<void>;
  setOptimisticState: (slug: string, state: ConnectionState) => void;
  reset: () => void;
}

export const useFollowStore = create<FollowState>()(
  persist(
    (set, get) => ({
      connectionStates: {},
      isFetched: false,
      isLoading: false,

      fetchFollowingSlugs: async (force = false) => {
        if ((get().isFetched && !force) || get().isLoading) return;
        
        set({ isLoading: true });
        try {
          const slugs = await getMyFollowingSlugs();
          
          set((state) => {
            const newState = { ...state.connectionStates };
            
            // Tüm 'following' olanları önce 'none'a çek (belki takipten çıkartılmışlardır, Trakt API gerçeği bu)
            // Ama 'pending' olanlara DOKUNMA, çünkü Trakt'tan 'pending' listesini alamıyoruz!
            Object.keys(newState).forEach(key => {
              if (newState[key] === 'following') {
                delete newState[key];
              }
            });

            // Şimdi Trakt'tan dönen 'following' listesini işle
            slugs.forEach(slug => {
              newState[slug] = 'following';
            });

            return { connectionStates: newState, isFetched: true };
          });
        } catch (error) {
          console.warn('[followStore] Takip durumu okunamadı:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      setOptimisticState: (slug, state) => {
        set((prev) => {
          const newState = { ...prev.connectionStates };
          if (state === 'none') {
            delete newState[slug];
          } else {
            newState[slug] = state;
          }
          return { connectionStates: newState };
        });
      },

      reset: () => {
        set({ connectionStates: {}, isFetched: false, isLoading: false });
      }
    }),
    {
      name: 'kaymak-follow-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Sadece connectionStates'i kaydet (isFetched ve isLoading her oturumda baştan başlasın)
      partialize: (state) => ({ connectionStates: state.connectionStates }),
    }
  )
);

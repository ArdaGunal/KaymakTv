import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFollowers, getUserProfile } from '../services/api/social';
import { useFollowStore } from './followStore';
import { logError } from '../utils/errorLog';

// Basit, tamamen istemci-tarafı "aktivite" bildirimleri — dış push YOK,
// backend/Supabase YOK (bkz. docs/notifications.md Faz 2, bilinçli olarak bu
// kapsamın dışında bırakıldı). `store/followStore.ts`'teki hydrate/persist
// deseninin BİREBİR aynısı: AsyncStorage'a yazılır, uygulama açılışında bir
// kez hidratlanır.
const STORAGE_KEY = 'kaymak-notification-storage';
const MAX_ITEMS = 50;

export type ActivityNotificationType = 'newFollower' | 'requestApproved';

export interface ActivityNotification {
  id: string;
  type: ActivityNotificationType;
  slug: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: number;
  read: boolean;
}

interface PersistedShape {
  items: ActivityNotification[];
  seenFollowerSlugs: string[] | null;
  pendingSentSlugs: string[];
}

interface NotificationState extends PersistedShape {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  clearUnread: () => void;
  /** `followTraktUser` `approvedAt: null` döndürdüğünde çağrılır — onay
   *  bekleyen bir istek gönderdiğimizi hatırlamak için (bkz. hooks/useFollowState.ts). */
  addPendingSentSlug: (slug: string) => void;
  refreshActivity: () => Promise<void>;
  markAllRead: () => void;
}

const persistState = (state: PersistedShape): void => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((error) => {
    logError('notificationStore.persistState', error);
  });
};

const hydrate = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const items: ActivityNotification[] = parsed?.items ?? [];
    useNotificationStore.setState({
      items,
      seenFollowerSlugs: parsed?.seenFollowerSlugs ?? null,
      pendingSentSlugs: parsed?.pendingSentSlugs ?? [],
      unreadCount: items.filter((i) => !i.read).length,
    });
  } catch (error) {
    logError('notificationStore.hydrate', error);
  }
};

let hydrationPromise: Promise<void> | null = null;
const ensureHydrated = (): Promise<void> => {
  if (!hydrationPromise) hydrationPromise = hydrate();
  return hydrationPromise;
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  items: [],
  seenFollowerSlugs: null,
  pendingSentSlugs: [],

  setUnreadCount: (count) => set({ unreadCount: count }),
  clearUnread: () => set({ unreadCount: 0 }),

  addPendingSentSlug: (slug) => {
    set((state) => {
      if (state.pendingSentSlugs.includes(slug)) return state;
      const pendingSentSlugs = [...state.pendingSentSlugs, slug];
      persistState({ items: state.items, seenFollowerSlugs: state.seenFollowerSlugs, pendingSentSlugs });
      return { pendingSentSlugs };
    });
  },

  refreshActivity: async () => {
    await ensureHydrated();
    try {
      const [followers] = await Promise.all([
        getFollowers('me').catch(() => []),
        useFollowStore.getState().fetchFollowingSlugs(),
      ]);

      const state = get();
      const currentFollowerSlugs = followers.map((f) => f.ids?.slug).filter((s): s is string => !!s);
      const newItems: ActivityNotification[] = [];

      // Yeni takipçi diff'i — ilk çalıştırmada (seenFollowerSlugs === null)
      // yalnızca taban alınır, MEVCUT tüm takipçiler "yeni" gibi bildirim
      // yağmuruna dönüşmesin diye bildirim ÜRETİLMEZ.
      if (state.seenFollowerSlugs !== null) {
        const seenSet = new Set(state.seenFollowerSlugs);
        for (const follower of followers) {
          const slug = follower.ids?.slug;
          if (!slug || seenSet.has(slug)) continue;
          newItems.push({
            id: `newFollower-${slug}-${Date.now()}`,
            type: 'newFollower',
            slug,
            username: follower.username,
            name: follower.name,
            avatarUrl: follower.images?.avatar?.full ?? null,
            createdAt: Date.now(),
            read: false,
          });
        }
      }

      // Onaylanan gönderilmiş takip istekleri diff'i — bir slug artık
      // `followStore`'un (Trakt'tan az önce yenilenen) following listesindeyse
      // demek ki gizli hesap isteğimizi onaylamış.
      const followingConnectionStates = useFollowStore.getState().connectionStates;
      const stillPending: string[] = [];
      for (const slug of state.pendingSentSlugs) {
        if (followingConnectionStates[slug] === 'following') {
          try {
            const profile = await getUserProfile(slug);
            newItems.push({
              id: `requestApproved-${slug}-${Date.now()}`,
              type: 'requestApproved',
              slug,
              username: profile.username,
              name: profile.name,
              avatarUrl: profile.images?.avatar?.full ?? null,
              createdAt: Date.now(),
              read: false,
            });
          } catch {
            stillPending.push(slug); // profil çekilemedi, sonraki denemede tekrar kontrol edilir
          }
        } else {
          stillPending.push(slug);
        }
      }

      const items = [...newItems, ...state.items].slice(0, MAX_ITEMS);
      const unreadCount = items.filter((i) => !i.read).length;

      persistState({ items, seenFollowerSlugs: currentFollowerSlugs, pendingSentSlugs: stillPending });
      set({ items, seenFollowerSlugs: currentFollowerSlugs, pendingSentSlugs: stillPending, unreadCount });
    } catch (error) {
      console.warn('[notificationStore] Aktivite güncellenemedi:', error);
      logError('notificationStore.refreshActivity', error);
    }
  },

  markAllRead: () => {
    set((state) => {
      if (state.unreadCount === 0) return state;
      const items = state.items.map((i) => ({ ...i, read: true }));
      persistState({ items, seenFollowerSlugs: state.seenFollowerSlugs, pendingSentSlugs: state.pendingSentSlugs });
      return { items, unreadCount: 0 };
    });
  },
}));

ensureHydrated();

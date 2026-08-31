import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeIntoInbox } from './sweep';
import type { LedgerEntry } from './sweep';

/**
 * Uygulama içi bildirim kutusu — DÜŞMÜŞ içerik bildirimlerinin listesi
 * (docs/design/notifications.md § 11).
 *
 * 🔴 `store/notificationStore.ts` İLE KARIŞTIRMA ve ONA EKLEME YAPMA.
 * O store SOSYAL aktiviteyi tutuyor (yeni takipçi / istek onayı) ve kayıtları
 * `slug`, `username`, `avatarUrl` gibi kişiye özgü alanlar taşıyor. İçerik
 * bildirimlerinin böyle alanları yok; aynı diziye tıkmak o tipi bozar ve
 * `notifications.tsx`'teki avatar/kullanıcı adı çizimini kırardı.
 * İki liste AYRI tutuluyor, ekranda İKİ BÖLÜM olarak gösteriliyor.
 */

const STORAGE_KEY = 'kaymak-notification-inbox';

/**
 * `store/notificationStore.ts`'teki `MAX_ITEMS` ile aynı tavan.
 * Store tek bir JSON dizesi yazdığı için tavanı YÜKSELTME — her yazmada
 * listenin tamamı yeniden serialize ediliyor.
 */
const MAX_ITEMS = 50;

export interface InboxItem extends LedgerEntry {
  read: boolean;
}

interface InboxState {
  items: InboxItem[];
  unreadCount: number;
  isHydrated: boolean;
  /** Süpürmede "düştü" denen kayıtları listeye ekler (tekilleştirerek). */
  ingest: (fired: readonly LedgerEntry[]) => void;
  markAllRead: () => void;
  clear: () => void;
}

const persist = (items: InboxItem[]): void => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch((error) => {
    console.warn('[inbox] yazilamadi:', error);
  });
};

const hydrate = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      useInboxStore.setState({ isHydrated: true });
      return;
    }
    const parsed = JSON.parse(raw);
    const items: InboxItem[] = Array.isArray(parsed) ? parsed : [];
    useInboxStore.setState({
      items,
      unreadCount: items.filter((item) => !item.read).length,
      isHydrated: true,
    });
  } catch (error) {
    // Bozuk depolama bildirim sistemini kilitlemesin.
    console.warn('[inbox] okunamadi:', error);
    useInboxStore.setState({ isHydrated: true });
  }
};

let hydrationPromise: Promise<void> | null = null;
export const ensureInboxHydrated = (): Promise<void> => {
  if (!hydrationPromise) hydrationPromise = hydrate();
  return hydrationPromise;
};

export const useInboxStore = create<InboxState>((set, get) => ({
  items: [],
  unreadCount: 0,
  isHydrated: false,

  ingest: (fired) => {
    if (fired.length === 0) return;
    const incoming: InboxItem[] = fired.map((entry) => ({ ...entry, read: false }));
    const items = mergeIntoInbox(get().items, incoming, MAX_ITEMS);
    // `mergeIntoInbox` tekilleştiriyor; hiçbir yeni kayıt eklenmediyse
    // gereksiz yazma ve render tetiklemeyelim.
    if (items.length === get().items.length && items[0]?.identifier === get().items[0]?.identifier) {
      return;
    }
    persist(items);
    set({ items, unreadCount: items.filter((item) => !item.read).length });
  },

  markAllRead: () => {
    set((state) => {
      if (state.unreadCount === 0) return state;
      const items = state.items.map((item) => ({ ...item, read: true }));
      persist(items);
      return { items, unreadCount: 0 };
    });
  },

  clear: () => {
    persist([]);
    set({ items: [], unreadCount: 0 });
  },
}));

ensureInboxHydrated();

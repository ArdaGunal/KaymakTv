import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFollowers, getUserProfile } from '../services/api/social';
import { useFollowStore } from './followStore';
import { logError } from '../utils/errorLog';
import {
  pruneByAge,
  budandiMi,
  INBOX_MAX_AGE_MS,
  PENDING_SLUG_MAX_AGE_MS,
  PENDING_SLUG_CAP,
} from '../features/notifications/inbox/retention';

// Basit, tamamen istemci-tarafı "aktivite" bildirimleri — dış push YOK,
// backend/Supabase YOK (bkz. docs/design/notifications.md Faz 2, bilinçli olarak bu
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

/**
 * Onay bekleyen GÖNDERİLMİŞ takip isteği — artık ZAMAN DAMGALI.
 *
 * 🔴 NEDEN DEĞİŞTİ: eskiden düz `string[]`ti ve bir kayıt yalnızca istek
 * ONAYLANINCA siliniyordu. Gizli bir hesap isteği hiç onaylamazsa slug
 * **sonsuza kadar** kalıyordu — bu store'daki tek gerçekten SINIRSIZ büyüyen
 * alandı (diğer her şeyin adet tavanı var). Damga olmadan "ne zaman
 * vazgeçelim?" sorusu cevaplanamıyordu.
 */
export interface PendingSentRequest {
  slug: string;
  /** İsteğin gönderildiği an (epoch ms). */
  at: number;
}

interface PersistedShape {
  items: ActivityNotification[];
  seenFollowerSlugs: string[] | null;
  pendingSentSlugs: PendingSentRequest[];
}

/**
 * Depodan okunanı bugünkü şekle çevirir.
 *
 * ⚠️ GERİYE DÖNÜK: eski sürüm düz `string[]` yazıyordu. O kayıtlar damgasız
 * olduğu için "şimdi" damgalanıyor — yani mevcut bekleyen istekler bir
 * kereliğine 30 günlük saatlerini SIFIRDAN başlatıyor. Alternatifi onları
 * atmaktı; bekleyen bir isteği sırf damgası yok diye unutmak daha kötü.
 */
const normalizePending = (raw: unknown, now: number): PendingSentRequest[] => {
  if (!Array.isArray(raw)) return [];
  const cikti: PendingSentRequest[] = [];
  const gorulen = new Set<string>();
  for (const item of raw) {
    let kayit: PendingSentRequest | null = null;
    if (typeof item === 'string' && item) kayit = { slug: item, at: now };
    else if (item && typeof item === 'object') {
      const o = item as { slug?: unknown; at?: unknown };
      if (typeof o.slug === 'string' && o.slug) {
        kayit = { slug: o.slug, at: typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : now };
      }
    }
    if (!kayit || gorulen.has(kayit.slug)) continue;
    gorulen.add(kayit.slug);
    cikti.push(kayit);
  }
  return cikti;
};

/** Yaş budaması + son savunma hattı olarak adet tavanı. */
const trimPending = (liste: readonly PendingSentRequest[], now: number): PendingSentRequest[] =>
  pruneByAge(liste, now, (p) => p.at, PENDING_SLUG_MAX_AGE_MS).slice(0, PENDING_SLUG_CAP);

interface NotificationState extends PersistedShape {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  clearUnread: () => void;
  /** `followTraktUser` `approvedAt: null` döndürdüğünde çağrılır — onay
   *  bekleyen bir istek gönderdiğimizi hatırlamak için (bkz. hooks/useFollowState.ts). */
  addPendingSentSlug: (slug: string) => void;
  refreshActivity: () => Promise<void>;
  markAllRead: () => void;
  /** Tek bir aktivite kaydını listeden kaldırır. */
  remove: (id: string) => void;
  /** Listenin tamamını boşaltır ("Tümünü temizle"). */
  clearAll: () => void;
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
    const now = Date.now();
    const okunan: ActivityNotification[] = Array.isArray(parsed?.items) ? parsed.items : [];

    // 🔴 YAŞ BUDAMASI AÇILIŞTA — `MAX_ITEMS` yalnızca ADEDE bakıyor. Nadiren
    // takipçi kazanan bir kullanıcı 50'ye hiç ulaşmaz ve yıllar önceki kayıt
    // listede sonsuza kadar durur. Gerekçe/süre: `notifications/inbox/retention.ts`.
    const items = pruneByAge(okunan, now, (i) => i.createdAt, INBOX_MAX_AGE_MS);

    const okunanPending = normalizePending(parsed?.pendingSentSlugs, now);
    const pendingSentSlugs = trimPending(okunanPending, now);
    const seenFollowerSlugs = parsed?.seenFollowerSlugs ?? null;

    // Yalnızca gerçekten değiştiyse yaz (şekil göçü de bir değişikliktir).
    if (
      budandiMi(okunan, items) ||
      budandiMi(okunanPending, pendingSentSlugs) ||
      !Array.isArray(parsed?.pendingSentSlugs) ||
      parsed.pendingSentSlugs.some((x: unknown) => typeof x === 'string')
    ) {
      persistState({ items, seenFollowerSlugs, pendingSentSlugs });
    }

    useNotificationStore.setState({
      items,
      seenFollowerSlugs,
      pendingSentSlugs,
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
      if (state.pendingSentSlugs.some((p) => p.slug === slug)) return state;
      const now = Date.now();
      // Ekleme anında da budanıyor: bu liste yalnızca burada büyüyor, yani
      // budamanın en doğal yeri burası. Açılıştaki budama, uygulamayı
      // günlerce açık tutan kullanıcı için ikinci hat.
      const pendingSentSlugs = trimPending([...state.pendingSentSlugs, { slug, at: now }], now);
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
      const stillPending: PendingSentRequest[] = [];
      for (const bekleyen of state.pendingSentSlugs) {
        const slug = bekleyen.slug;
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
            // Profil çekilemedi; damga KORUNUYOR (tazelenmiyor) — aksi halde
            // her yenilemede saat sıfırlanır ve kayıt hiç yaşlanmazdı.
            stillPending.push(bekleyen);
          }
        } else {
          stillPending.push(bekleyen);
        }
      }

      // Yenileme turu da buduyor: uygulama günlerce açık kalabilir ve
      // yalnızca açılışta budamak o oturumlarda eskileri biriktirirdi
      // (`useInboxStore.ingest`'teki aynı gerekçe).
      const now = Date.now();
      const eskiler = pruneByAge(state.items, now, (i) => i.createdAt, INBOX_MAX_AGE_MS);
      const items = [...newItems, ...eskiler].slice(0, MAX_ITEMS);
      const unreadCount = items.filter((i) => !i.read).length;
      const pendingSentSlugs = trimPending(stillPending, now);

      persistState({ items, seenFollowerSlugs: currentFollowerSlugs, pendingSentSlugs });
      set({ items, seenFollowerSlugs: currentFollowerSlugs, pendingSentSlugs, unreadCount });
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

  // 🔴 AŞAĞIDAKİ İKİ EYLEM `seenFollowerSlugs`e DOKUNMAZ — kritik.
  // O alan "hangi takipçileri daha önce gördük" tabanıdır; bildirimi silmek
  // onu SIFIRLASAYDI, bir sonraki `refreshActivity` MEVCUT tüm takipçileri
  // "yeni" sayar ve kullanıcı sildiği bildirimlerin hepsini bir anda geri
  // alırdı (satır 107'deki taban alma dalı tam bunun için var).
  // `pendingSentSlugs` de aynı sebeple korunuyor: bekleyen istek takibi
  // bildirim listesinden bağımsız bir defterdir.

  remove: (id) => {
    set((state) => {
      const items = state.items.filter((i) => i.id !== id);
      if (items.length === state.items.length) return state;
      persistState({ items, seenFollowerSlugs: state.seenFollowerSlugs, pendingSentSlugs: state.pendingSentSlugs });
      return { items, unreadCount: items.filter((i) => !i.read).length };
    });
  },

  clearAll: () => {
    set((state) => {
      if (state.items.length === 0) return state;
      persistState({ items: [], seenFollowerSlugs: state.seenFollowerSlugs, pendingSentSlugs: state.pendingSentSlugs });
      return { items: [], unreadCount: 0 };
    });
  },
}));

ensureHydrated();

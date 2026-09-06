import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeIntoInbox } from './sweep';
import type { LedgerEntry } from './sweep';
import { pruneByAge, budandiMi, INBOX_MAX_AGE_MS } from './retention';

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
  /**
   * Tek bir kaydı listeden kaldırır.
   *
   * 🔴 KALICI, GERİ GELMEZ — ve bunun sebebi tesadüf değil: düşmüş kayıtlar
   * süpürmeden hemen sonra defterden ÇIKARILIYOR
   * (`useNotificationSetup` → `saveLedger(pending)`), sonraki planlama turu
   * ise defteri yalnızca HENÜZ DÜŞMEMİŞ planlardan yeniden kuruyor. Yani
   * silinen kaydın geri sızacağı bir kaynak yok.
   */
  remove: (identifier: string) => void;
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
    const okunan: InboxItem[] = Array.isArray(parsed) ? parsed : [];

    // 🔴 YAŞ BUDAMASI AÇILIŞTA. Adet tavanı (`MAX_ITEMS`) bir kaydın YAŞINA
    // bakmıyor: ayda birkaç bildirim alan kullanıcı 50'ye hiç ulaşmaz ve
    // yıllar önceki kayıt listede sonsuza kadar durur. Gerekçe ve süre
    // `retention.ts`'te.
    const items = pruneByAge(okunan, Date.now(), (item) => item.fireAt, INBOX_MAX_AGE_MS);
    // Yalnızca gerçekten budandıysa yaz — aksi halde her açılışta listenin
    // tamamı boşuna yeniden serialize edilirdi.
    if (budandiMi(okunan, items)) persist(items);

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
    // Uygulama günlerce açık kalabilir; budama yalnızca açılışta yapılsaydı
    // uzun oturumlarda eskiler birikirdi.
    const mevcut = pruneByAge(get().items, Date.now(), (item) => item.fireAt, INBOX_MAX_AGE_MS);
    const items = mergeIntoInbox(mevcut, incoming, MAX_ITEMS);
    // `mergeIntoInbox` tekilleştiriyor; hiçbir yeni kayıt eklenmediyse
    // gereksiz yazma ve render tetiklemeyelim.
    //
    // ⚠️ KISA DEVRE BUDAMAYI DA HESABA KATIYOR: yalnızca uzunluk+ilk kayıt
    // karşılaştırılsaydı, "yeni kayıt yok ama eski bir kayıt budandı"
    // durumunda buradan çıkılır ve budama diske YAZILMAZDI.
    if (
      !budandiMi(get().items, mevcut) &&
      items.length === get().items.length &&
      items[0]?.identifier === get().items[0]?.identifier
    ) {
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

  remove: (identifier) => {
    set((state) => {
      const items = state.items.filter((item) => item.identifier !== identifier);
      // Eşleşme yoksa yazma ve render tetikleme.
      if (items.length === state.items.length) return state;
      persist(items);
      return { items, unreadCount: items.filter((item) => !item.read).length };
    });
  },

  clear: () => {
    persist([]);
    set({ items: [], unreadCount: 0 });
  },
}));

/**
 * Çıkışta çağrılır (bkz. `features/notifications/reset.ts`).
 *
 * 🔴 GİZLİLİK: temizlenmezse, aynı cihazda hesap değiştiren kullanıcı ÖNCEKİ
 * hesabın bildirim geçmişini (hangi diziyi takip ettiği dahil) görür.
 */
export function resetInboxState(): void {
  hydrationPromise = null;
  useInboxStore.setState({ items: [], unreadCount: 0, isHydrated: true });
}

ensureInboxHydrated();

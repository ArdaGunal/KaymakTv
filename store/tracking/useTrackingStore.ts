import { create } from 'zustand';
import * as SecureStore from '../../utils/secureStorage';

export type TrackingCategoryKey = 'upNext' | 'paused' | 'notStarted' | 'dropped';

export type CollapsedMap = Record<TrackingCategoryKey, boolean>;

interface TrackingUIState {
  collapsed: CollapsedMap;
  /** Kullanıcının manuel olarak "Bırakıldı" işaretlediği dizilerin trakt id'leri. */
  droppedIds: number[];
  hydrated: boolean;
  toggle: (key: TrackingCategoryKey) => void;
  toggleDroppedStatus: (id: number) => void;
  /** Dizi manuel "Bırakıldı" değilse no-op. Yeni bölüm izlenince otomatik çağrılır. */
  clearDroppedStatus: (id: number) => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'kaymak_tracking_collapsed_v2';
const DROPPED_STORAGE_KEY = 'kaymak_tracking_dropped_v1';

// Varsayılan: "Aktif İzlenenler" açık, diğerleri kapalı — kullanıcı en çok ona bakar.
const DEFAULT_COLLAPSED: CollapsedMap = {
  upNext: false,
  paused: true,
  notStarted: true,
  dropped: true,
};

/**
 * Arayüz (accordion aç/kapa) durumunu VE kullanıcının manuel "Bırakıldı"
 * işaretlemelerini tutan izole Zustand store. Kategorizasyonun geri kalanı
 * (ilerleme durumu vs.) hâlâ ham kütüphane dilimlerinden `useTrackingShows`
 * hook'unda türetilir — bu ayrım veri kategorizasyonuyla UI durumunu birbirine
 * karıştırmayıp "loading state bug'da kalıyor" sınıfı hataları önler.
 */
export const useTrackingStore = create<TrackingUIState>((set, get) => ({
  collapsed: DEFAULT_COLLAPSED,
  droppedIds: [],
  hydrated: false,

  toggle: (key) => {
    const next = { ...get().collapsed, [key]: !get().collapsed[key] };
    set({ collapsed: next });
    // Yaz-ve-unut: kalıcılık başarısız olsa bile UI çalışmaya devam eder.
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },

  toggleDroppedStatus: (id) => {
    const current = get().droppedIds;
    const next = current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id];
    set({ droppedIds: next });
    SecureStore.setItemAsync(DROPPED_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },

  clearDroppedStatus: (id) => {
    const current = get().droppedIds;
    if (!current.includes(id)) return;
    const next = current.filter((existing) => existing !== id);
    set({ droppedIds: next });
    SecureStore.setItemAsync(DROPPED_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },

  hydrate: async () => {
    // Tek sefer: tekrar tekrar çağrılsa bile sonsuz döngüye/gereksiz okumaya
    // girmez.
    if (get().hydrated) return;
    set({ hydrated: true });
    try {
      const [savedCollapsed, savedDropped] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEY),
        SecureStore.getItemAsync(DROPPED_STORAGE_KEY),
      ]);
      if (savedCollapsed) {
        set({ collapsed: { ...DEFAULT_COLLAPSED, ...JSON.parse(savedCollapsed) } });
      }
      if (savedDropped) {
        set({ droppedIds: JSON.parse(savedDropped) });
      }
    } catch {
      // Bozuk/okunamayan kayıt → varsayılanla devam.
    }
  },
}));

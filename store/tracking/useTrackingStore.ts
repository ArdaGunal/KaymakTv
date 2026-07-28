import { create } from 'zustand';
import * as SecureStore from '../../utils/secureStorage';

export type TrackingCategoryKey = 'upNext' | 'paused' | 'notStarted';

export type CollapsedMap = Record<TrackingCategoryKey, boolean>;

interface TrackingUIState {
  collapsed: CollapsedMap;
  hydrated: boolean;
  toggle: (key: TrackingCategoryKey) => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'kaymak_tracking_collapsed_v2';

// "Bırak" Trakt gizlemesine taşınmadan ÖNCE bu store, manuel "Bırakıldı"
// işaretlerini cihaza yazıyordu. Kod artık bu anahtarları hiç okumuyor ama
// güncelleme yapan mevcut kullanıcıların cihazlarında öksüz kalıyorlar —
// hydrate sırasında bir kez sessizce silinirler.
const LEGACY_DROPPED_KEYS = ['kaymak_tracking_dropped_v1', 'kaymak_tracking_dropped_movies_v1'];

// Varsayılan: "Aktif İzlenenler" açık, diğerleri kapalı — kullanıcı en çok ona bakar.
const DEFAULT_COLLAPSED: CollapsedMap = {
  upNext: false,
  paused: true,
  notStarted: true,
};

/**
 * Arayüz (accordion aç/kapa) durumunu tutan izole Zustand store. Kategorizasyonun
 * geri kalanı (ilerleme durumu, "Bırak"/gizlenme durumu vs.) hâlâ ham kütüphane
 * dilimlerinden `useTrackingShows` / `categorizeMovies` ile türetilir — bu ayrım
 * veri kategorizasyonuyla UI durumunu birbirine karıştırmayıp "loading state
 * bug'da kalıyor" sınıfı hataları önler.
 *
 * NOT: Bu store eskiden kullanıcının manuel "Bırakıldı" işaretlemelerini
 * (droppedShowIds/droppedMovieIds) cihaza özel olarak da tutuyordu. "Bırak"
 * eylemi artık doğrudan Trakt'ın "İlerlemeyi Gizle" uç noktasına bağlı olduğu
 * için (bkz. services/library/mutations/collections.ts:toggleHiddenFromProgress,
 * store/useLibraryStore.ts:hiddenShowIds/hiddenMovieIds) o yerel durum tamamen
 * kaldırıldı — Trakt hesabı artık tüm cihazlarda tek gerçek kaynak.
 */
export const useTrackingStore = create<TrackingUIState>((set, get) => ({
  collapsed: DEFAULT_COLLAPSED,
  hydrated: false,

  toggle: (key) => {
    const next = { ...get().collapsed, [key]: !get().collapsed[key] };
    set({ collapsed: next });
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },

  hydrate: async () => {
    // Tek sefer: tekrar tekrar çağrılsa bile sonsuz döngüye/gereksiz okumaya
    // girmez.
    if (get().hydrated) return;
    set({ hydrated: true });
    try {
      const savedCollapsed = await SecureStore.getItemAsync(STORAGE_KEY);
      if (savedCollapsed) {
        set({ collapsed: { ...DEFAULT_COLLAPSED, ...JSON.parse(savedCollapsed) } });
      }
    } catch {
      // Bozuk/okunamayan kayıt → varsayılanla devam.
    }
    // Ateşle-ve-unut: başarısız olsa bile hiçbir şeyi etkilemez (yalnızca ölü veri).
    LEGACY_DROPPED_KEYS.forEach((key) => {
      SecureStore.deleteItemAsync(key).catch(() => {});
    });
  },
}));

import { create } from 'zustand';
import * as SecureStore from '../../utils/secureStorage';

export type TrackingCategoryKey = 'upNext' | 'paused' | 'notStarted' | 'dropped';

export type CollapsedMap = Record<TrackingCategoryKey, boolean>;

interface TrackingUIState {
  collapsed: CollapsedMap;
  /**
   * Kullanıcının manuel olarak "Bırakıldı" işaretlediği DİZİLERİN trakt id'leri.
   *
   * DİKKAT: Buraya ASLA film id'si yazılmamalı. Trakt'ta dizi ve film id'leri
   * ayrı uzaylardadır ama ikisi de düz sayıdır — aynı listede tutulurlarsa
   * id'si çakışan bir film ile bir dizi birbirini sessizce "bırakılmış"
   * gösterirdi. Filmler için ayrı `droppedMovieIds` listesi vardır.
   */
  droppedShowIds: number[];
  /** Kullanıcının manuel olarak "Bırakıldı" işaretlediği FİLMLERİN trakt id'leri. */
  droppedMovieIds: number[];
  hydrated: boolean;
  toggle: (key: TrackingCategoryKey) => void;
  toggleDroppedShowStatus: (id: number) => void;
  /** Dizi manuel "Bırakıldı" değilse no-op. Yeni bölüm izlenince otomatik çağrılır. */
  clearDroppedShowStatus: (id: number) => void;
  toggleDroppedMovieStatus: (id: number) => void;
  /** Film manuel "Bırakıldı" değilse no-op. Film izlendi işaretlenince otomatik çağrılır. */
  clearDroppedMovieStatus: (id: number) => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'kaymak_tracking_collapsed_v2';
const DROPPED_SHOWS_STORAGE_KEY = 'kaymak_tracking_dropped_v1';
const DROPPED_MOVIES_STORAGE_KEY = 'kaymak_tracking_dropped_movies_v1';

// Varsayılan: "Aktif İzlenenler" açık, diğerleri kapalı — kullanıcı en çok ona bakar.
const DEFAULT_COLLAPSED: CollapsedMap = {
  upNext: false,
  paused: true,
  notStarted: true,
  dropped: true,
};

/** Yalnızca sayı dizisi kabul eder: bozuk/eski bir kayıt tüm store'u çökertmesin. */
const parseIdList = (raw: string | null): number[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  } catch {
    return null;
  }
};

/**
 * Arayüz (accordion aç/kapa) durumunu VE kullanıcının manuel "Bırakıldı"
 * işaretlemelerini tutan izole Zustand store. Kategorizasyonun geri kalanı
 * (ilerleme durumu vs.) hâlâ ham kütüphane dilimlerinden `useTrackingShows` /
 * `categorizeMovies` ile türetilir — bu ayrım veri kategorizasyonuyla UI
 * durumunu birbirine karıştırmayıp "loading state bug'da kalıyor" sınıfı
 * hataları önler.
 */
export const useTrackingStore = create<TrackingUIState>((set, get) => {
  // Dizi ve film "bırakıldı" listeleri BİRBİRİNİN AYNISI davranır, yalnızca
  // hangi alana/anahtara yazdıkları değişir. Mantığı tek yerde tutmak, ileride
  // eklenecek bir kuralın yalnızca birine uygulanıp diğerinde unutulmasını
  // yapısal olarak engelliyor.
  const writeIds = (field: 'droppedShowIds' | 'droppedMovieIds', storageKey: string, next: number[]) => {
    set({ [field]: next } as Pick<TrackingUIState, typeof field>);
    // Yaz-ve-unut: kalıcılık başarısız olsa bile UI çalışmaya devam eder.
    SecureStore.setItemAsync(storageKey, JSON.stringify(next)).catch(() => {});
  };

  const toggleId = (field: 'droppedShowIds' | 'droppedMovieIds', storageKey: string, id: number) => {
    const current = get()[field];
    writeIds(field, storageKey, current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id]);
  };

  const clearId = (field: 'droppedShowIds' | 'droppedMovieIds', storageKey: string, id: number) => {
    const current = get()[field];
    if (!current.includes(id)) return;
    writeIds(field, storageKey, current.filter((existing) => existing !== id));
  };

  return {
    collapsed: DEFAULT_COLLAPSED,
    droppedShowIds: [],
    droppedMovieIds: [],
    hydrated: false,

    toggle: (key) => {
      const next = { ...get().collapsed, [key]: !get().collapsed[key] };
      set({ collapsed: next });
      SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    },

    toggleDroppedShowStatus: (id) => toggleId('droppedShowIds', DROPPED_SHOWS_STORAGE_KEY, id),
    clearDroppedShowStatus: (id) => clearId('droppedShowIds', DROPPED_SHOWS_STORAGE_KEY, id),

    toggleDroppedMovieStatus: (id) => toggleId('droppedMovieIds', DROPPED_MOVIES_STORAGE_KEY, id),
    clearDroppedMovieStatus: (id) => clearId('droppedMovieIds', DROPPED_MOVIES_STORAGE_KEY, id),

    hydrate: async () => {
      // Tek sefer: tekrar tekrar çağrılsa bile sonsuz döngüye/gereksiz okumaya
      // girmez.
      if (get().hydrated) return;
      set({ hydrated: true });
      try {
        const [savedCollapsed, savedDropped, savedDroppedMovies] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEY),
          SecureStore.getItemAsync(DROPPED_SHOWS_STORAGE_KEY),
          SecureStore.getItemAsync(DROPPED_MOVIES_STORAGE_KEY),
        ]);
        if (savedCollapsed) {
          set({ collapsed: { ...DEFAULT_COLLAPSED, ...JSON.parse(savedCollapsed) } });
        }
        const droppedShowIds = parseIdList(savedDropped);
        if (droppedShowIds) set({ droppedShowIds });
        const droppedMovieIds = parseIdList(savedDroppedMovies);
        if (droppedMovieIds) set({ droppedMovieIds });
      } catch {
        // Bozuk/okunamayan kayıt → varsayılanla devam.
      }
    },
  };
});

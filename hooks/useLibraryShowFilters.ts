import { useEffect, useMemo } from 'react';
import { useLibrarySelector } from '../context/LibraryContext';
import { useTrackingStore } from '../store/tracking/useTrackingStore';
import { categorizeShows } from '../store/tracking/trackingLogic';
import type { LibraryItem } from './useLibraryTypeData';
import {
  emptyStatusIndex,
  useFilterResult,
  useMediaFilterState,
  type MediaStatusIndex,
  type UseLibraryFiltersResult,
} from './libraryFilterCore';

/**
 * Kütüphane "Diziler" ekranının lokal süzme hook'u.
 *
 * Arama/taslak seçim/süzme algoritmasının tamamı `libraryFilterCore`'da (filmlerle
 * ORTAK). Buradaki tek iş, dizilere özgü kategori indeksini üretmek — o da takip
 * modülünün tek gerçek kaynağı `categorizeShows`'tan türetilir, böylece "Aktif
 * İzlenenler" burada ve takip ekranında ASLA farklı anlama gelmez.
 */
export type ShowStatusKey = 'upNext' | 'paused' | 'dropped' | 'notStarted' | 'hidden';

/** Filtre menüsündeki sıra da budur (Aktif / Ara Verilen / Bırakılan / Başlanmadı / Gizlenen).
 * "Gizlenenler" bilinçli olarak EN SONDA — takip panosunun ana vitrininden çıkarılan
 * bu diziler, kullanıcı bilinçli olarak arayana kadar göz önünde olmamalı. */
export const SHOW_STATUS_KEYS: readonly ShowStatusKey[] = ['upNext', 'paused', 'dropped', 'notStarted', 'hidden'] as const;

// `categorizeShows` etiketleri yalnızca kart ÜZERİNDEKİ metinler için kullanılır;
// burada sadece kategori üyeliği okunduğundan sabit boş değerler yeterli. Çeviri
// fonksiyonunu bağımlılığa almamak, dil değişiminde bu ağır memo'nun boşuna
// yeniden hesaplanmasını da önler.
const STATIC_LABELS = { unnamedShow: '', notStarted: '', caughtUp: '' };

const EMPTY_INDEX = emptyStatusIndex<ShowStatusKey>();

/**
 * Kategori indeksi. `enabled` false iken (kullanıcı hiç kategori seçmemişse)
 * kategorizasyon HİÇ çalıştırılmaz — 600+ öğelik kütüphanelerde bedava bir kazanç.
 */
function useShowStatusIndex(enabled: boolean): MediaStatusIndex<ShowStatusKey> {
  const { watchedShows, watchlistShows, showProgressMap, hiddenShowIds } = useLibrarySelector((s) => ({
    watchedShows: s.watchedShows,
    watchlistShows: s.watchlistShows,
    showProgressMap: s.showProgressMap,
    hiddenShowIds: s.hiddenShowIds,
  }));

  const droppedShowIds = useTrackingStore((s) => s.droppedShowIds);
  const hydrate = useTrackingStore((s) => s.hydrate);

  // "Bırakılanlar" filtresinin doğru çalışması için manuel işaretlemelerin
  // diskten okunmuş olması şart; hydrate idempotent (tek sefer çalışır).
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return useMemo(() => {
    if (!enabled) return EMPTY_INDEX;

    const categories = categorizeShows({
      watchedShows: watchedShows || [],
      watchlistShows: watchlistShows || [],
      showProgressMap: showProgressMap || {},
      droppedShowIds,
      hiddenShowIds,
      labels: STATIC_LABELS,
    });

    const statusOf = new Map<number, ShowStatusKey>();
    for (const key of SHOW_STATUS_KEYS) {
      for (const card of categories[key]) statusOf.set(card.id, key);
    }

    // Ekran `watchedShows` tabanlı; yalnızca izleme listesinde olan diziler orada
    // HİÇ bulunmaz. Havuza katılmasalardı "Henüz Başlanmadı" seçeneği hiçbir
    // zaman sonuç döndüremezdi.
    const watchedIds = new Set<number>();
    for (const item of watchedShows || []) {
      const id = item?.show?.ids?.trakt;
      if (id != null) watchedIds.add(id);
    }

    const seen = new Set<number>();
    const extraPool: LibraryItem[] = [];
    for (const item of watchlistShows || []) {
      const show = item?.show;
      const id = show?.ids?.trakt;
      if (id == null || watchedIds.has(id) || seen.has(id)) continue;
      seen.add(id);
      // Anahtar öneki kütüphane öğeleriyle ÇAKIŞMAMALI ('show-…' onların).
      extraPool.push({ key: `wlist-${id}`, id, title: show?.title, tmdbId: show?.ids?.tmdb });
    }

    return { statusOf, extraPool };
  }, [enabled, watchedShows, watchlistShows, showProgressMap, droppedShowIds, hiddenShowIds]);
}

export type UseLibraryShowFiltersResult = UseLibraryFiltersResult<ShowStatusKey>;

export function useLibraryShowFilters(
  data: LibraryItem[],
  enabled: boolean
): UseLibraryShowFiltersResult {
  const state = useMediaFilterState(SHOW_STATUS_KEYS, enabled);
  const index = useShowStatusIndex(enabled && state.activeStatuses.length > 0);
  return useFilterResult(data, enabled, state, index);
}

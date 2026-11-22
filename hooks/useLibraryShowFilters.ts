import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibrarySelector } from '../context/LibraryContext';
import { loadShowFilterMetadata, normalizeShowStatus } from '../services/library/showFilterMetadata';
import { categorizeShows } from '../store/tracking/trackingLogic';
import { gorunenBaslik } from '../utils/gorunenBaslik';
import { useKaymakYetenekleri } from './useKaymakYetenekleri';
import type { LibraryItem } from './useLibraryTypeData';
import {
  emptyStatusIndex,
  useFilterResult,
  useMediaFilterState,
  type MediaStatusIndex,
  type UseLibraryFiltersResult,
} from './libraryFilterCore';

export const SHOW_STATUS_KEYS = ['upNext', 'paused', 'upToDate', 'notStarted', 'finished', 'hidden'] as const;
export type ShowStatusKey = typeof SHOW_STATUS_KEYS[number];

const TRACKING_KEYS = ['upNext', 'paused', 'notStarted', 'hidden'] as const;
const STATIC_LABELS = { dil: '', unnamedShow: '', notStarted: '', caughtUp: '' };
const EMPTY_INDEX = emptyStatusIndex<ShowStatusKey>();
const METADATA_BATCH_SIZE = 3;
type ShowFilterMetadata = Awaited<ReturnType<typeof loadShowFilterMetadata>>;

function useShowStatusIndex(enabled: boolean, shouldResolveStatus: boolean): MediaStatusIndex<ShowStatusKey> {
  const { watchedShows, watchlistShows, showProgressMap, hiddenShowIds } = useLibrarySelector((s) => ({
    watchedShows: s.watchedShows,
    watchlistShows: s.watchlistShows,
    showProgressMap: s.showProgressMap,
    hiddenShowIds: s.hiddenShowIds,
  }));

  const { i18n } = useTranslation();
  const { kaymakHesabi } = useKaymakYetenekleri();
  const [metadataById, setMetadataById] = useState(() => new Map<number, ShowFilterMetadata>());

  const tracking = useMemo(() => {
    if (!enabled) return null;

    const categories = categorizeShows({
      watchedShows: watchedShows || [],
      watchlistShows: watchlistShows || [],
      showProgressMap: showProgressMap || {},
      hiddenShowIds,
      labels: STATIC_LABELS,
    });

    const statusById = new Map<number, string | undefined>();
    for (const item of watchedShows || []) {
      const id = item?.show?.ids?.trakt;
      if (id != null && !statusById.has(id)) statusById.set(id, normalizeShowStatus(item.show.status));
    }

    // Yalnızca izleme listesinde bulunan dizileri filtre havuzuna ekle.
    const extraPool: LibraryItem[] = [];
    for (const item of watchlistShows || []) {
      const show = item?.show;
      const id = show?.ids?.trakt;
      if (id == null || statusById.has(id)) continue;
      statusById.set(id, normalizeShowStatus(show.status));
      extraPool.push({ key: `wlist-${id}`, id, title: gorunenBaslik(show, i18n.language), tmdbId: show.ids.tmdb });
    }

    return { categories, statusById, extraPool };
  }, [enabled, watchedShows, watchlistShows, showProgressMap, hiddenShowIds, i18n.language]);

  useEffect(() => {
    if (!kaymakHesabi || !shouldResolveStatus || !tracking) return;
    const candidates = tracking.categories.caughtUp.filter(({ id }) =>
      !tracking.statusById.get(id) && !showProgressMap?.[id]?.next_episode
    );
    let cancelled = false;
    const resolveStatuses = async () => {
      for (let i = 0; i < candidates.length && !cancelled; i += METADATA_BATCH_SIZE) {
        const batch = candidates.slice(i, i + METADATA_BATCH_SIZE);
        const results = await Promise.all(batch.map(async ({ id, tmdbId }) =>
          [id, await loadShowFilterMetadata(id, tmdbId)] as const
        ));
        if (!cancelled) setMetadataById((previous) => new Map([...previous, ...results]));
      }
    };
    void resolveStatuses();
    return () => { cancelled = true; };
  }, [kaymakHesabi, shouldResolveStatus, tracking, showProgressMap]);

  return useMemo(() => {
    if (!tracking) return EMPTY_INDEX;

    const { categories, statusById, extraPool } = tracking;
    const statusOf = new Map<number, ShowStatusKey>();
    for (const key of TRACKING_KEYS) {
      for (const card of categories[key]) statusOf.set(card.id, key);
    }

    const now = Date.now();
    for (const { id } of categories.caughtUp) {
      const metadata = kaymakHesabi ? metadataById.get(id) : null;
      const status = statusById.get(id) ?? metadata?.status;
      const terminal = status === 'ended' || status === 'canceled' || status === 'cancelled';
      // caughtUp üyeliği, ilerlemedeki sıradaki bölümün henüz izlenemediğini gösterir.
      const nextAirDate = metadata?.nextAirDate;
      const announced = showProgressMap?.[id]?.next_episode
        || nextAirDate === null
        || (nextAirDate !== undefined && Date.parse(nextAirDate) > now);
      statusOf.set(id, terminal && !announced ? 'finished' : 'upToDate');
    }

    return { statusOf, extraPool };
  }, [tracking, showProgressMap, kaymakHesabi, metadataById]);
}

export type UseLibraryShowFiltersResult = UseLibraryFiltersResult<ShowStatusKey>;

export function useLibraryShowFilters(
  data: LibraryItem[],
  enabled: boolean,
  initialStatuses?: readonly string[]
): UseLibraryShowFiltersResult {
  // Eski URL önseçimi iki yeni filtreyi birlikte açar.
  const initial = initialStatuses?.includes('caughtUp')
    ? [...initialStatuses, 'upToDate', 'finished']
    : initialStatuses;
  const state = useMediaFilterState(SHOW_STATUS_KEYS, enabled, initial);
  const shouldResolveStatus = state.activeStatuses.includes('upToDate') || state.activeStatuses.includes('finished');
  const index = useShowStatusIndex(enabled && state.activeStatuses.length > 0, shouldResolveStatus);
  return useFilterResult(data, enabled, state, index);
}

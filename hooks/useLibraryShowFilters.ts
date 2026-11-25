import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibrarySelector } from '../context/LibraryContext';
import { fetchDiziYayinBilgileri } from '../services/api/library';
import { categorizeShows } from '../store/tracking/trackingLogic';
import { guncelEtiketi, type DiziYayinBilgisi } from '../utils/diziYayinDurumu';
import { gorunenBaslik } from '../utils/gorunenBaslik';
import type { LibraryItem } from './useLibraryTypeData';
import {
  emptyStatusIndex,
  useFilterResult,
  useMediaFilterState,
  type UseLibraryFiltersResult,
} from './libraryFilterCore';

export const SHOW_STATUS_KEYS = ['upNext', 'paused', 'upToDate', 'notStarted', 'finished', 'hidden'] as const;
export type ShowStatusKey = typeof SHOW_STATUS_KEYS[number];

const STATIC_LABELS = { dil: '', unnamedShow: '', notStarted: '', caughtUp: '' };
const EMPTY_INDEX = { ...emptyStatusIndex<ShowStatusKey>(), guncelTarihleri: new Map<number, string | null>(), simdi: 0 };

function useShowStatusIndex(enabled: boolean, shouldResolveStatus: boolean) {
  const { watchedShows, watchlistShows, showProgressMap, hiddenShowIds } = useLibrarySelector((s) => ({
    watchedShows: s.watchedShows,
    watchlistShows: s.watchlistShows,
    showProgressMap: s.showProgressMap,
    hiddenShowIds: s.hiddenShowIds,
  }));

  const { i18n } = useTranslation();
  const [simdi, setSimdi] = useState(Date.now);
  const [yayinBilgileri, setYayinBilgileri] = useState(() => new Map<number, DiziYayinBilgisi>());
  const categories = useMemo(() => {
    if (!enabled) return null;
    return categorizeShows({
      watchedShows: watchedShows || [],
      watchlistShows: watchlistShows || [],
      showProgressMap: showProgressMap || {},
      hiddenShowIds,
      labels: STATIC_LABELS,
      yayinBilgileri,
      now: simdi,
    });
  }, [enabled, watchedShows, watchlistShows, showProgressMap, hiddenShowIds, yayinBilgileri, simdi]);

  const enYakinYayin = categories?.upToDate.reduce(
    (enYakin, kart) => kart.sonrakiYayinAt ? Math.min(enYakin, Date.parse(kart.sonrakiYayinAt)) : enYakin,
    Infinity,
  );
  useEffect(() => {
    if (enabled) setSimdi(Date.now());
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !Number.isFinite(enYakinYayin)) return;
    const geceYarisi = new Date(simdi);
    geceYarisi.setHours(24, 0, 0, 0);
    const gecikme = Math.min(enYakinYayin ?? Infinity, geceYarisi.getTime()) - Date.now();
    const sayac = setTimeout(() => setSimdi(Date.now()), Math.max(0, gecikme));
    return () => clearTimeout(sayac);
  }, [enabled, simdi, enYakinYayin]);

  const aranan = shouldResolveStatus
    ? categories?.caughtUp.filter((card) => !card.yayinBilgisiVar).map((card) => card.id).join(',')
    : '';
  useEffect(() => {
    if (!aranan) return;
    let cancelled = false;
    const ids = aranan.split(',').map(Number);
    void fetchDiziYayinBilgileri(ids).then((satirlar) => {
      if (cancelled) return;
      const gelen = new Map(satirlar.map((satir) => [satir.traktId, satir]));
      setYayinBilgileri((onceki) => {
        const yeni = new Map(onceki);
        for (const id of ids) {
          yeni.set(id, gelen.get(id) ?? { yayin_durumu: null, sonraki_yayin_at: null });
        }
        return yeni;
      });
    }).catch(() => {
      // Katalog geçici olarak okunamazsa ilerleme verisinden gelen kovalar kalır.
    });
    return () => { cancelled = true; };
  }, [aranan]);

  return useMemo(() => {
    if (!categories) return EMPTY_INDEX;
    const statusOf = new Map<number, ShowStatusKey>();
    for (const key of SHOW_STATUS_KEYS) {
      for (const card of categories[key]) statusOf.set(card.id, key);
    }
    const watchedIds = new Set((watchedShows || []).map(({ show }) => show?.ids?.trakt));
    const extraPool: LibraryItem[] = [];
    for (const { show } of watchlistShows || []) {
      const id = show?.ids?.trakt;
      if (id == null || watchedIds.has(id)) continue;
      watchedIds.add(id);
      extraPool.push({ key: `wlist-${id}`, id, title: gorunenBaslik(show, i18n.language), tmdbId: show.ids.tmdb });
    }
    const guncelTarihleri = new Map(categories.upToDate.map((card) => [card.id, card.sonrakiYayinAt ?? null]));
    return { statusOf, extraPool, guncelTarihleri, simdi };
  }, [categories, watchlistShows, watchedShows, i18n.language, simdi]);
}

export type UseLibraryShowFiltersResult = UseLibraryFiltersResult<ShowStatusKey>;

export function useLibraryShowFilters(
  data: LibraryItem[],
  enabled: boolean,
  initialStatuses?: readonly string[]
): UseLibraryShowFiltersResult {
  const { t, i18n } = useTranslation('media');
  // Eski URL önseçimi iki yeni filtreyi birlikte açar.
  const initial = initialStatuses?.includes('caughtUp')
    ? [...initialStatuses, 'upToDate', 'finished']
    : initialStatuses;
  const state = useMediaFilterState(SHOW_STATUS_KEYS, enabled, initial);
  const guncel = state.activeStatuses.includes('upToDate');
  const index = useShowStatusIndex(enabled && state.activeStatuses.length > 0, guncel || state.activeStatuses.includes('finished'));
  const result = useFilterResult(data, enabled, state, index);

  const filteredData = useMemo(() => {
    if (!guncel) return result.filteredData;
    return result.filteredData.map((item) => {
      if (item.id == null || !index.guncelTarihleri.has(item.id)) return item;
      const etiket = guncelEtiketi(index.guncelTarihleri.get(item.id) ?? null, index.simdi, i18n.language);
      if (etiket.tur === 'tarih') return { ...item, yayinEtiketi: etiket.metin };
      if (etiket.tur === 'gun') return { ...item, yayinEtiketi: t('media:yayinGunKaldi', { count: etiket.gun }) };
      const anahtar = { bugun: 'yayinBugun', yarin: 'yayinYarin', bekleniyor: 'yayinYeniSezon' }[etiket.tur];
      return { ...item, yayinEtiketi: t(`media:${anahtar}`) };
    });
  }, [guncel, index.guncelTarihleri, index.simdi, result.filteredData, i18n.language, t]);
  return { ...result, filteredData };
}

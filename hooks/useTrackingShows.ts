import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibrarySelector } from '../context/LibraryContext';
import { categorizeShows, ShowCategories } from '../store/tracking/trackingLogic';
import { useTrackingStore } from '../store/tracking/useTrackingStore';

export interface UseTrackingShowsResult {
  categories: ShowCategories;
  /** Hiç veri yokken ve kütüphane hâlâ yüklenirken true — asla takılmaz. */
  isLoading: boolean;
  /** Dört kategori de boş mu? */
  isEmpty: boolean;
  totalCount: number;
  /** Bir diziyi manuel olarak "Bırakıldı" yap / geri al. */
  toggleDroppedShowStatus: (id: number) => void;
}

/**
 * Dizi takip ekranının TEK veri kaynağı. Ham kütüphane dilimlerini okuyup
 * `categorizeShows` (saf, tek gerçek kaynak) ile 4 kategoriye ayırır.
 *
 * Loading mantığı türetilmiştir (ayrı bir state + effect değil): veri geldiği
 * an isLoading kendiliğinden false olur, bu yüzden "yükleniyor state'inde
 * kalma" hatası yapısal olarak imkânsızdır.
 */
export function useTrackingShows(): UseTrackingShowsResult {
  const { t } = useTranslation('media');

  const { watchedShows, watchlistShows, showProgressMap, isLibraryLoading } = useLibrarySelector((s) => ({
    watchedShows: s.watchedShows,
    watchlistShows: s.watchlistShows,
    showProgressMap: s.showProgressMap,
    isLibraryLoading: s.isLoading,
  }));

  const droppedShowIds = useTrackingStore((s) => s.droppedShowIds);
  const toggleDroppedShowStatus = useTrackingStore((s) => s.toggleDroppedShowStatus);
  const hydrate = useTrackingStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const categories = useMemo(
    () =>
      categorizeShows({
        watchedShows: watchedShows || [],
        watchlistShows: watchlistShows || [],
        showProgressMap: showProgressMap || {},
        droppedShowIds,
        labels: {
          unnamedShow: t('unnamedShow', 'İsimsiz Dizi'),
          notStarted: t('notStarted', 'Henüz Başlanmadı'),
          caughtUp: t('caughtUp', 'Yeni bölüm bekleniyor'),
        },
      }),
    // showProgressMap referansı store setter'larında yenilendiği için güvenli.
    [watchedShows, watchlistShows, showProgressMap, droppedShowIds, t]
  );

  const totalCount =
    categories.upNext.length + categories.paused.length + categories.notStarted.length + categories.dropped.length;
  const isEmpty = totalCount === 0;
  const isLoading = isEmpty && isLibraryLoading;

  return { categories, isLoading, isEmpty, totalCount, toggleDroppedShowStatus };
}

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibrarySelector, useLibraryActions } from '../context/LibraryContext';
import { categorizeShows, ShowCategories } from '../store/tracking/trackingLogic';

export interface UseTrackingShowsResult {
  categories: ShowCategories;
  /** Hiç veri yokken ve kütüphane hâlâ yüklenirken true — asla takılmaz. */
  isLoading: boolean;
  /** Üç ana kategori de (upNext/paused/notStarted) boş mu? */
  isEmpty: boolean;
  totalCount: number;
  /** Bir diziyi "Bırak" — Trakt'ta ilerlemesini gizler. Takip panosundaki
   * kartlar tanım gereği hiçbir zaman zaten gizli bir diziyi göstermez (bkz.
   * trackingLogic.ts), bu yüzden bu eylem her zaman "gizle" yönünde çalışır.
   * Trakt'a giden asenkron isteği BİLİNÇLİ OLARAK burada yutmaz/loglamaz —
   * çağıran taraf (`TrackingCardMenu`) bunu bekleyip reddedilirse kullanıcıya
   * görünür bir hata gösterir (bkz. Madde 99). */
  dropShow: (id: number) => Promise<void>;
}

/**
 * Dizi takip ekranının TEK veri kaynağı. Ham kütüphane dilimlerini okuyup
 * `categorizeShows` (saf, tek gerçek kaynak) ile kategorilere ayırır.
 *
 * Loading mantığı türetilmiştir (ayrı bir state + effect değil): veri geldiği
 * an isLoading kendiliğinden false olur, bu yüzden "yükleniyor state'inde
 * kalma" hatası yapısal olarak imkânsızdır.
 */
export function useTrackingShows(): UseTrackingShowsResult {
  const { t } = useTranslation('media');

  const { watchedShows, watchlistShows, showProgressMap, hiddenShowIds, isLibraryLoading } = useLibrarySelector((s) => ({
    watchedShows: s.watchedShows,
    watchlistShows: s.watchlistShows,
    showProgressMap: s.showProgressMap,
    hiddenShowIds: s.hiddenShowIds,
    isLibraryLoading: s.isLoading,
  }));

  const { toggleHiddenFromProgress } = useLibraryActions();

  const categories = useMemo(
    () =>
      categorizeShows({
        watchedShows: watchedShows || [],
        watchlistShows: watchlistShows || [],
        showProgressMap: showProgressMap || {},
        hiddenShowIds,
        labels: {
          unnamedShow: t('unnamedShow', 'İsimsiz Dizi'),
          notStarted: t('notStarted', 'Henüz Başlanmadı'),
          caughtUp: t('caughtUp', 'Yeni bölüm bekleniyor'),
        },
      }),
    // showProgressMap referansı store setter'larında yenilendiği için güvenli.
    [watchedShows, watchlistShows, showProgressMap, hiddenShowIds, t]
  );

  const totalCount = categories.upNext.length + categories.paused.length + categories.notStarted.length;
  const isEmpty = totalCount === 0;
  const isLoading = isEmpty && isLibraryLoading;

  const dropShow = useCallback(
    (id: number) => toggleHiddenFromProgress(id, 'show', false),
    [toggleHiddenFromProgress]
  );

  return { categories, isLoading, isEmpty, totalCount, dropShow };
}

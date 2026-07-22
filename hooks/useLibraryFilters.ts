import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryItem } from './useLibraryTypeData';
import { useLibraryShowFilters, SHOW_STATUS_KEYS, type ShowStatusKey } from './useLibraryShowFilters';
import { useLibraryMovieFilters, MOVIE_CATEGORY_KEYS, type MovieCategoryKey } from './useLibraryMovieFilters';
import type { FilterOption } from '../components/library/LibraryFilterModal';

/**
 * Kütüphane ekranlarının (mobil + web) TEK giriş noktası.
 *
 * `/library/[type]` rotası hem dizileri hem filmleri sunduğu için ekran, hangi
 * süzme mantığının çalışacağını render sırasında öğrenir — ama hook'lar koşullu
 * çağrılamaz. Bu yüzden iki hook da her zaman çağrılır, yalnızca BİRİ etkin olur;
 * etkin olmayan hook hiçbir kategorizasyon yapmaz ve listeyi olduğu gibi geri
 * verir (bkz. `enabled` kontrolleri). Ekranlar bu ayrımı hiç bilmez.
 *
 * Süzme yalnızca 'shows' ve 'movies' için açıktır; favoriler ve listeler
 * ekranları bilinçli olarak eski davranışlarını sürdürür.
 */

/** Etiketler takip modülüyle ORTAK anahtarlardan gelir; ekranlarda yeni metin uydurulmaz. */
const SHOW_LABEL_KEYS: Record<ShowStatusKey, string> = {
  upNext: 'upNext',
  paused: 'paused',
  dropped: 'inactive',
  notStarted: 'notStarted',
};

const MOVIE_LABEL_KEYS: Record<MovieCategoryKey, string> = {
  watched: 'filterWatched',
  watchlist: 'filterWatchlist',
  dropped: 'inactive',
};

export interface UseLibraryFiltersResult {
  /** Bu ekran tipi süzmeyi destekliyor mu (üst bar gösterilsin mi)? */
  enabled: boolean;
  filteredData: LibraryItem[];
  searchInput: string;
  setSearchInput: (value: string) => void;
  clearSearch: () => void;
  activeStatuses: string[];
  applyStatuses: (next: string[]) => void;
  isFiltering: boolean;
  /** Filtre menüsüne verilecek, etiketleri çözülmüş kategori listesi. */
  options: ReadonlyArray<FilterOption<string>>;
  /** Filtre menüsünün başlığı ("Dizileri Filtrele" / "Filmleri Filtrele"). */
  filterTitle: string;
}

export function useLibraryFilters(
  data: LibraryItem[],
  type: string | string[] | undefined
): UseLibraryFiltersResult {
  const { t } = useTranslation(['navigation', 'media']);

  const isShows = type === 'shows';
  const isMovies = type === 'movies';

  const showFilters = useLibraryShowFilters(data, isShows);
  const movieFilters = useLibraryMovieFilters(data, isMovies);

  const active = isMovies ? movieFilters : showFilters;

  const options = useMemo<ReadonlyArray<FilterOption<string>>>(() => {
    if (isMovies) {
      return MOVIE_CATEGORY_KEYS.map((key) => ({ key, label: t(`media:${MOVIE_LABEL_KEYS[key]}`) }));
    }
    return SHOW_STATUS_KEYS.map((key) => ({ key, label: t(`media:${SHOW_LABEL_KEYS[key]}`) }));
  }, [isMovies, t]);

  // Modal `string` anahtarlarla çalışır (medya tipinden bağımsız olsun diye);
  // alttaki hook ise kendi dar tipini bekler. Sarmalayıcı yalnızca bu tip
  // köprüsünü kurar — bilinmeyen bir anahtar gelse bile alttaki hook onu
  // kendi sabit listesine göre zaten eliyor.
  const applyStatuses = useCallback(
    (next: string[]) => (active.applyStatuses as (value: string[]) => void)(next),
    [active]
  );

  return {
    enabled: isShows || isMovies,
    filteredData: active.filteredData,
    searchInput: active.searchInput,
    setSearchInput: active.setSearchInput,
    clearSearch: active.clearSearch,
    activeStatuses: active.activeStatuses,
    applyStatuses,
    isFiltering: active.isFiltering,
    options,
    filterTitle: isMovies
      ? t('navigation:filterTitleMovies', 'Filmleri Filtrele')
      : t('navigation:filterTitleShows', 'Dizileri Filtrele'),
  };
}

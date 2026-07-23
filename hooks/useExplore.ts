import { useEffect, useState, useRef } from 'react';
import { getTrendingShows, getTrendingMovies, searchTrakt } from '../services/traktApi';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { SearchTabType } from '../components/SearchTabs';

const PAGE_SIZE = 7;

export interface ExploreState {
  trendingShows: any[];
  trendingMovies: any[];
  searchShows: any[];
  searchMovies: any[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
}

export interface ExploreActions {
  setSearchQuery: (q: string) => void;
  setActiveTab: (t: SearchTabType) => void;
  onRefresh: () => void;
  fetchMore: () => void;
  searchQuery: string;
  activeTab: SearchTabType;
  currentData: any[];
  isSearching: boolean;
}

export function useExplore(): ExploreState & ExploreActions {
  const { t, i18n } = useTranslation(['media', 'common']);
  const { accessToken, isGuest } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTabType>('show');

  const [trendingShows, setTrendingShows] = useState<any[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<any[]>([]);
  const [showPage, setShowPage] = useState(1);
  const [moviePage, setMoviePage] = useState(1);

  const [searchShows, setSearchShows] = useState<any[]>([]);
  const [searchMovies, setSearchMovies] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSearchRef = useRef<string>('');

  const fetchTrending = async (reset = true, force = false) => {
    if (!accessToken && !isGuest) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (reset) {
        setError(null);
        setLoading(true);
        setShowPage(1);
        setMoviePage(1);
      }

      const [shows, movies] = await Promise.all([
        getTrendingShows(1, PAGE_SIZE, force),
        getTrendingMovies(1, PAGE_SIZE, force),
      ]);
      setTrendingShows(shows);
      setTrendingMovies(movies);
    } catch (err: any) {
      console.error('Error fetching trending data:', err);
      setError(t('trendLoadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMore = async () => {
    if (searchQuery.trim().length > 2 || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      if (activeTab === 'show') {
        const nextPage = showPage + 1;
        const newShows = await getTrendingShows(nextPage, PAGE_SIZE);
        if (newShows.length > 0) {
          setTrendingShows(prev => [...prev, ...newShows]);
          setShowPage(nextPage);
        }
      } else {
        const nextPage = moviePage + 1;
        const newMovies = await getTrendingMovies(nextPage, PAGE_SIZE);
        if (newMovies.length > 0) {
          setTrendingMovies(prev => [...prev, ...newMovies]);
          setMoviePage(nextPage);
        }
      }
    } catch (err) {
      console.error(t('fetchMoreError'), err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchSearch = async (query: string) => {
    if (!accessToken && !isGuest) return;

    activeSearchRef.current = query;
    const currentSearch = query;

    try {
      setError(null);
      setLoading(true);
      const [shows, movies] = await Promise.all([
        searchTrakt(query, 'show'),
        searchTrakt(query, 'movie'),
      ]);

      if (activeSearchRef.current !== currentSearch) return;
      setSearchShows(shows);
      setSearchMovies(movies);
    } catch (err: any) {
      if (activeSearchRef.current !== currentSearch) return;
      console.error('Error searching:', err);
      setError(t('searchError'));
    } finally {
      if (activeSearchRef.current === currentSearch) {
        setLoading(false);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (searchQuery.trim().length > 2) {
      fetchSearch(searchQuery);
    } else {
      fetchTrending(true, true);
    }
  };

  // Arama: `searchQuery` zaten `SearchBar`'ın kendi 500ms debounce'ından SONRA
  // değişiyor (bkz. components/SearchBar.tsx) — burada İKİNCİ bir debounce
  // eklemek son tuş vuruşundan gerçek isteğin gitmesine kadar 500+500=1000ms'lik
  // saf (ağ gecikmesi HARİÇ) bir bekleme yaratıyordu, "Keşfet"in trend
  // listesine kıyasla donuk/yavaş hissettirmesinin asıl sebebi buydu. `loading`
  // ve eski sonuçların temizlenmesi de artık İSTEK BAŞLAMADAN ÖNCE yapılıyor —
  // eskiden bunlar yalnızca debounce dolup `fetchSearch` çalışınca tetiklendiği
  // için o pencerede ekran ya bomboş ya da bir ÖNCEKİ aramanın sonuçlarıyla
  // donmuş görünüyordu.
  useEffect(() => {
    if (!accessToken && !isGuest) return;

    if (searchQuery.trim().length > 2) {
      setLoading(true);
      setSearchShows([]);
      setSearchMovies([]);
      fetchSearch(searchQuery);
    } else if (searchQuery.trim().length === 0) {
      setSearchShows([]);
      setSearchMovies([]);
      if (trendingShows.length === 0 || trendingMovies.length === 0) {
        fetchTrending();
      }
    }
  }, [searchQuery, accessToken, isGuest]);

  // Language change → re-fetch
  useEffect(() => {
    if ((accessToken || isGuest) && (trendingShows.length > 0 || trendingMovies.length > 0)) {
      if (searchQuery.trim().length > 2) {
        fetchSearch(searchQuery);
      } else {
        fetchTrending(true, true);
      }
    }
  }, [i18n.language]);

  const isSearching = searchQuery.trim().length > 2;
  const currentData = isSearching
    ? (activeTab === 'show' ? searchShows : searchMovies)
    : (activeTab === 'show' ? trendingShows : trendingMovies);

  return {
    trendingShows,
    trendingMovies,
    searchShows,
    searchMovies,
    loading,
    loadingMore,
    refreshing,
    error,
    searchQuery,
    activeTab,
    isSearching,
    currentData,
    setSearchQuery,
    setActiveTab,
    onRefresh,
    fetchMore,
  };
}

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
  /** Aktif sekmenin ("show"/"movie") son `fetchMore` denemesi başarısız oldu mu. */
  loadMoreFailed: boolean;
  /** `fetchMore`'un aksine `loadMoreFailed` kapısını BYPASS eder — yalnızca
   * kullanıcının açık "Tekrar Dene" eylemi için. */
  retryLoadMore: () => void;
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

  // 🔴 2026-08-22 — Keşfet'in "sonsuz istek döngüsü" kusuru (kullanıcı canlıda
  // bulup bildirdi, konsolda `/shows/trending`'e ONLARCA ard arda 401/CORS/
  // Network Error tekrarı gözlendi, devre kesici sonunda devreye girene kadar).
  //
  // KÖK NEDEN: eski `fetchMore`'da bir sayfa BAŞARISIZ olduğunda `showPage`/
  // `moviePage` İLERLEMİYOR ve hiçbir "artık deneme" bayrağı SET EDİLMİYORDU.
  // React Native'in FlatList'i `onEndReached`'i yalnızca kullanıcı kaydırınca
  // DEĞİL, içerik/layout her yeniden hesaplandığında (`_maybeCallOnEdgeReached`)
  // tetikleyebiliyor — `PAGE_SIZE=7` gibi kısa bir liste ekranı doldurmadığında
  // bu SÜREKLİ oluyor. Sonuç: `loadingMore` `finally`'de `false`'a dönüyor,
  // bir sonraki layout turu `fetchMore`'u TEKRAR çağırıyor, o da aynı sayfada
  // aynı şekilde başarısız oluyor — kullanıcı hiçbir şey yapmadan saniyede
  // onlarca istek. Trakt ücretli olduğu için bu doğrudan bir fatura riskiydi.
  //
  // ÇÖZÜM: Y21'in (`features/feed/hooks/useFeed.ts`, akış için aynı sınıf
  // hatayı kapatan) desenİ — bir sayfa başarısız olunca kalıcı bir bayrak
  // set edilir, `fetchMore` bu bayrak açıkken KOŞULSUZ erken döner. Yalnızca
  // açık bir kullanıcı eylemi (`retryLoadMore`, aşağıda) veya taze bir
  // `fetchTrending(reset=true)` bayrağı temizler. Diziler/filmler AYRI
  // sayfalama akışları olduğu için (`showPage`/`moviePage` de ayrı) bayrak da
  // sekme başına ayrı — bir sekmedeki hata diğerini kilitlemez.
  const [showLoadMoreFailed, setShowLoadMoreFailed] = useState(false);
  const [movieLoadMoreFailed, setMovieLoadMoreFailed] = useState(false);

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
        // Taze bir liste başlıyor — önceki sayfalama hatası artık ilgisiz.
        setShowLoadMoreFailed(false);
        setMovieLoadMoreFailed(false);
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

  // Gerçek sayfa çekme mantığı — KAPISIZ. `fetchMore` (onEndReached, otomatik)
  // ve `retryLoadMore` (kullanıcı eylemi, bayrağı bypass eder) ikisi de bunu
  // çağırır; farkları yalnızca ÇAĞRILMADAN ÖNCEKİ kapıda.
  const doFetchMore = async () => {
    setLoadingMore(true);
    try {
      if (activeTab === 'show') {
        const nextPage = showPage + 1;
        const newShows = await getTrendingShows(nextPage, PAGE_SIZE);
        setShowLoadMoreFailed(false);
        if (newShows.length > 0) {
          setTrendingShows(prev => [...prev, ...newShows]);
          setShowPage(nextPage);
        }
      } else {
        const nextPage = moviePage + 1;
        const newMovies = await getTrendingMovies(nextPage, PAGE_SIZE);
        setMovieLoadMoreFailed(false);
        if (newMovies.length > 0) {
          setTrendingMovies(prev => [...prev, ...newMovies]);
          setMoviePage(nextPage);
        }
      }
    } catch (err) {
      console.error(t('fetchMoreError'), err);
      // Bkz. `showLoadMoreFailed`'in başlığı — bu bayrak olmadan onEndReached
      // aynı başarısız sayfayı sonsuza dek yeniden dener.
      if (activeTab === 'show') setShowLoadMoreFailed(true);
      else setMovieLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreFailed = activeTab === 'show' ? showLoadMoreFailed : movieLoadMoreFailed;

  const fetchMore = () => {
    if (searchQuery.trim().length > 2 || loadingMore || loading || loadMoreFailed) return;
    void doFetchMore();
  };

  /** Yalnızca kullanıcının açık "Tekrar Dene" dokunuşu için — `loadMoreFailed`
   * kapısını BYPASS eder (aksi hâlde bayrağı temizlemeden çağırmak aynı
   * render turunda hâlâ eski/stale değeri görüp hiçbir şey yapmazdı). */
  const retryLoadMore = () => {
    if (loadingMore || loading) return;
    void doFetchMore();
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
    loadMoreFailed,
    retryLoadMore,
  };
}

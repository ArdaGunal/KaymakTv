import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import LoadingIndicator from '../../../components/LoadingIndicator';

import { getTrendingShows, getTrendingMovies, searchTrakt } from '../../../services/traktApi';
import ShowCard from '../../../components/ShowCard';
import SearchBar from '../../../components/SearchBar';
import SearchTabs, { SearchTabType } from '../../../components/SearchTabs';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTabType>('show');
  const { t, i18n } = useTranslation(['media', 'navigation', 'common']);

  const [trendingShows, setTrendingShows] = useState<any[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<any[]>([]);
  
  const [showPage, setShowPage] = useState(1);
  const [moviePage, setMoviePage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [searchShows, setSearchShows] = useState<any[]>([]);
  const [searchMovies, setSearchMovies] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { accessToken, isGuest } = useAuth();
  const router = useRouter();
  const activeSearchRef = React.useRef<string>('');

  const fetchTrending = async (reset = true) => {
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
        getTrendingShows(1, 7),
        getTrendingMovies(1, 7)
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
    // Arama modundayken veya zaten yükleniyorken iptal et
    if (searchQuery.trim().length > 2 || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      if (activeTab === 'show') {
        const nextPage = showPage + 1;
        const newShows = await getTrendingShows(nextPage, 7);
        if (newShows.length > 0) {
          setTrendingShows(prev => [...prev, ...newShows]);
          setShowPage(nextPage);
        }
      } else {
        const nextPage = moviePage + 1;
        const newMovies = await getTrendingMovies(nextPage, 7);
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
        searchTrakt(query, 'movie')
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

  useEffect(() => {
    if (!accessToken && !isGuest) return;

    if (searchQuery.trim().length > 2) {
      const delayDebounceFn = setTimeout(() => {
        fetchSearch(searchQuery);
      }, 500);

      return () => clearTimeout(delayDebounceFn);
    } else if (searchQuery.trim().length === 0) {
      setSearchShows([]);
      setSearchMovies([]);
      if (trendingShows.length === 0 || trendingMovies.length === 0) {
        fetchTrending();
      }
    }
  }, [searchQuery, accessToken, isGuest]);

  // Dil değiştiğinde trend olan içeriklerin çevirilerini güncelle
  useEffect(() => {
    if ((accessToken || isGuest) && (trendingShows.length > 0 || trendingMovies.length > 0)) {
      if (searchQuery.trim().length > 2) {
        fetchSearch(searchQuery);
      } else {
        fetchTrending(true);
      }
    }
  }, [i18n.language]);

  const onRefresh = () => {
    setRefreshing(true);
    if (searchQuery.trim().length > 2) {
      fetchSearch(searchQuery);
    } else {
      fetchTrending();
    }
  };

  if (!accessToken && !isGuest) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{t('exploreLoginReq')}</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => router.push('/(protected)/account')}
        >
          <Text style={styles.settingsButtonText}>{t('common:goToSettings')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isSearching = searchQuery.trim().length > 2;
  const currentData = isSearching
    ? (activeTab === 'show' ? searchShows : searchMovies)
    : (activeTab === 'show' ? trendingShows : trendingMovies);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>{t('navigation:explore')}</Text>
      <SearchBar 
        value={searchQuery} 
        onChangeText={setSearchQuery} 
        placeholder={t('exploreSearchPH')} 
      />
      <SearchTabs activeTab={activeTab} onTabChange={setActiveTab} />
      
      {!isSearching && (
        <Text style={styles.sectionTitle}>
          {activeTab === 'show' ? t('trendShows') : t('trendMovies')}
        </Text>
      )}
      
      {isSearching && !loading && currentData.length === 0 && (
        <Text style={styles.emptyText}>{t('common:noResults')}</Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        showsVerticalScrollIndicator={false}
        data={currentData}
        keyExtractor={(item, index) => {
          const media = item.show || item.movie;
          return media?.ids?.trakt ? `${media.ids.trakt}-${index}` : index.toString();
        }}
        renderItem={({ item }) => <ShowCard data={item} />}
        contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={renderHeader()}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20 }}>
              <LoadingIndicator size="small" color="#3b82f6" />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <LoadingIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>{t('common:loading')}</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                <Text style={styles.retryButtonText}>{t('common:retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    paddingBottom: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  loadingText: {
    color: '#a3a3a3',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  emptyText: {
    color: '#a3a3a3',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 24,
  },
  settingsButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  settingsButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#172033',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A364F',
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

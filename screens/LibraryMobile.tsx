import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native';
import LoadingIndicator from '../components/LoadingIndicator';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { 
  getWatchedShows, 
  getWatchedMovies, 
  getCustomLists, 
  getLikedShows, 
  getLikedMovies 
} from '../services/traktApi';
import MediaPoster from '../components/MediaPoster';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { generateMediaSlug } from '../utils/slugHelper';

const { width } = Dimensions.get('window');
const SPACING = 8;
const NUM_COLUMNS = 3;
const CARD_WIDTH = (width - (SPACING * (NUM_COLUMNS + 1))) / NUM_COLUMNS;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { t } = useTranslation('navigation');
  
  const [data, setData] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const getTitle = () => {
    switch (type) {
      case 'shows': return t('shows');
      case 'movies': return t('movies');
      case 'favShows': return t('favShows');
      case 'favMovies': return t('favMovies');
      case 'lists': return t('lists');
      default: return t('library');
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchData(1);
    }
  }, [accessToken, type]);

  const mapData = (items: any[], itemType: 'show' | 'movie') => {
    return items.map((item: any) => ({
      id: itemType === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
      title: itemType === 'show' ? item.show?.title : item.movie?.title,
      tmdbId: itemType === 'show' ? item.show?.ids?.tmdb : item.movie?.ids?.tmdb,
    }));
  };

  const fetchData = async (pageNumber: number) => {
    if (loading || loadingMore || !hasMore) return;

    if (pageNumber === 1) setLoading(true);
    else setLoadingMore(true);

    const LIMIT = 30; // Her sayfada 30 içerik çekilecek
    let newItems: any[] = [];
    
    try {
      if (type === 'shows') {
        const res = await getWatchedShows();
        const sorted = res.sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime());
        newItems = mapData(sorted, 'show');
        setHasMore(false);
      } 
      else if (type === 'movies') {
        const res = await getWatchedMovies();
        const sorted = res.sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime());
        newItems = mapData(sorted, 'movie');
        setHasMore(false);
      }
      else if (type === 'favShows') {
        const res = await getLikedShows();
        newItems = mapData(res, 'show');
        setHasMore(false);
      }
      else if (type === 'favMovies') {
        const res = await getLikedMovies();
        newItems = mapData(res, 'movie');
        setHasMore(false);
      }
      else if (type === 'lists') {
        const res = await getCustomLists();
        newItems = res.map((item: any) => ({
          id: item.ids?.trakt,
          title: item.name,
          tmdbId: null,
        }));
        setHasMore(false);
      }

      setData(prev => pageNumber === 1 ? newItems : [...prev, ...newItems]);
      setPage(pageNumber);
    } catch (error) {
      console.log('Veri çekme hatası:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loadingMore && !loading) {
      fetchData(page + 1);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => {
      if (item.id) {
        if (type === 'lists') {
          router.push(`/list/${item.id}?name=${encodeURIComponent(item.title)}`);
        } else {
          const routeType = type === 'shows' || type === 'favShows' ? 'show' : 'movie';
          const slug = generateMediaSlug(item.id, item.slug, item.title);
          router.push(`/${routeType}/${slug}?tmdbId=${item.tmdbId || ''}`);
        }
      }
    }}>
      {type === 'lists' ? (
        <View style={[styles.poster, { backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: '#334155' }]}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>{item.title}</Text>
        </View>
      ) : (
        <MediaPoster 
          tmdbId={item.tmdbId} 
          type={type === 'shows' || type === 'favShows' ? 'show' : 'movie'} 
          title={item.title} 
          style={styles.poster} 
        />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getTitle()}</Text>
        <View style={{ width: 28 }} />
      </View>

      {!loading && data.length > 0 ? (
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>{t('totalCount', { count: data.length, title: getTitle() })}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <LoadingIndicator size="large" color="#ffffff" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContainer}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => 
            loadingMore ? (
              <View style={styles.footerLoader}>
                <LoadingIndicator size="small" color="#a3a3a3" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#171717',
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  statsText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    padding: SPACING,
    paddingBottom: 40,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    margin: SPACING / 2,
    backgroundColor: '#262626',
    borderRadius: 6,
    overflow: 'hidden',
    borderBottomWidth: 4,
    borderBottomColor: '#8b5cf6', // TV Time mor çizgisi (Vurgu)
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#404040',
  },
  placeholderText: {
    color: '#a3a3a3',
    fontSize: 12,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

import React, { useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import MediaPoster from '../MediaPoster';
import { Star, Plus, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useLibrarySelector, useLibraryActions } from '../../context/LibraryContext';
import { generateMediaSlug } from '../../utils/slugHelper';
import { useTranslation } from 'react-i18next';
import LoadingIndicator from '../LoadingIndicator';

// ─── Poster Grid Card ───────────────────────────────────────────────────────

interface GridCardProps {
  data: any;
  cardWidth: number;
}

const GridCard = memo(({ data, cardWidth }: GridCardProps) => {
  const { t } = useTranslation(['media', 'common']);
  const router = useRouter();
  // Katı seçici: ilgisiz store dilimleri (progress, ratings vb.) değiştiğinde
  // grid'deki kartlar yeniden çizilmesin.
  const { watchlistShows, watchlistMovies, watchedShows, watchedMovies } = useLibrarySelector(s => ({
    watchlistShows: s.watchlistShows,
    watchlistMovies: s.watchlistMovies,
    watchedShows: s.watchedShows,
    watchedMovies: s.watchedMovies,
  }));
  const { toggleWatchlistStatus } = useLibraryActions();

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shadowAnim = useRef(new Animated.Value(0)).current;

  const media = data?.show || data?.movie;
  if (!data || !media) return null;

  const type = data.movie ? 'movie' : 'show';
  const traktId = media?.ids?.trakt;
  const tmdbId = media?.ids?.tmdb || '';

  const isWatchlisted =
    type === 'movie'
      ? watchlistMovies.some(m => m.movie?.ids?.trakt === traktId)
      : watchlistShows.some(s => s.show?.ids?.trakt === traktId);

  const isWatched =
    type === 'movie'
      ? watchedMovies.some(m => m.movie?.ids?.trakt === traktId)
      : watchedShows.some(s => s.show?.ids?.trakt === traktId);

  const isAdded = isWatchlisted || isWatched;

  const handleHoverIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1.04, useNativeDriver: Platform.OS !== 'web', friction: 7, tension: 200 }),
      Animated.timing(shadowAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const handleHoverOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: Platform.OS !== 'web', friction: 7, tension: 200 }),
      Animated.timing(shadowAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const handlePress = () => {
    if (traktId) {
      const slug = generateMediaSlug(traktId, media?.ids?.slug, media?.title);
      router.push(`/${type}/${slug}?tmdbId=${tmdbId}`);
    }
  };

  const handleWatchlist = (e: any) => {
    e.stopPropagation?.();
    if (!traktId || isWatched) return;
    toggleWatchlistStatus(traktId, type, isWatchlisted, media);
  };

  return (
    <Pressable
      // @ts-ignore web hover
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPressIn={handleHoverIn}
      onPressOut={handleHoverOut}
      onPress={handlePress}
      style={[styles.gridCard, { width: cardWidth }]}
    >
      <Animated.View style={[styles.cardInner, { transform: [{ scale: scaleAnim }] }]}>
        {/* Poster */}
        <View style={styles.posterWrapper}>
          <MediaPoster
            tmdbId={tmdbId}
            type={type}
            title={media?.title}
            style={styles.poster}
          />

          {/* Watchlist badge */}
          <TouchableOpacity
            style={[styles.watchlistBadge, isAdded && styles.watchlistBadgeActive]}
            onPress={handleWatchlist}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isAdded ? (
              <Check size={14} color="#10b981" strokeWidth={3} />
            ) : (
              <Plus size={14} color="#a3a3a3" strokeWidth={2.5} />
            )}
          </TouchableOpacity>

          {/* Rating chip */}
          {media?.rating ? (
            <View style={styles.ratingChip}>
              <Star size={10} color="#facc15" fill="#facc15" />
              <Text style={styles.ratingChipText}>{(media.rating / 2).toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {media?.title}
          </Text>
          <Text style={styles.cardYear}>{media?.year || ''}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
});

// ─── Web Grid ────────────────────────────────────────────────────────────────

interface ExploreWebGridProps {
  data: any[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  onEndReached: () => void;
  header: React.ReactElement;
  refreshControl: React.ReactElement<any>;
  screenWidth: number;
  onScroll?: (offsetY: number) => void;
}

const COLUMN_COUNT = 5;
const CARD_GAP = 16;

// "Yukarı Çık" butonunun tetiklenebilmesi için üst bileşenin (explore.tsx)
// alttaki FlatList'e `scrollToOffset` çağırabilmesi gerekiyor — bu yüzden
// forwardRef ile FlatList referansı dışarı açılıyor.
const ExploreWebGrid = React.forwardRef<FlatList<any>, ExploreWebGridProps>(function ExploreWebGrid({
  data,
  loading,
  loadingMore,
  error,
  onEndReached,
  header,
  refreshControl,
  screenWidth,
  onScroll,
}, ref) {
  const { t } = useTranslation('common');

  const containerPadding = 32;
  const totalGapWidth = CARD_GAP * (COLUMN_COUNT - 1);
  const availableWidth = Math.min(screenWidth, 1280) - containerPadding * 2;
  const cardWidth = Math.floor((availableWidth - totalGapWidth) / COLUMN_COUNT);

  return (
    <FlatList
      ref={ref}
      data={data}
      numColumns={COLUMN_COUNT}
      key={`grid-${COLUMN_COUNT}`}
      keyExtractor={(item, index) => {
        const media = item.show || item.movie;
        return media?.ids?.trakt ? `${media.ids.trakt}-${index}` : index.toString();
      }}
      renderItem={({ item }) => <GridCard data={item} cardWidth={cardWidth} />}
      contentContainerStyle={[styles.gridContainer, { paddingHorizontal: containerPadding }]}
      columnWrapperStyle={styles.columnWrapper}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={header}
      onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={16}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={refreshControl}
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerLoader}>
            <LoadingIndicator size="small" />
          </View>
        ) : null
      }
      ListEmptyComponent={
        loading ? (
          <View style={styles.centerState}>
            <LoadingIndicator size="large" />
            <Text style={styles.stateText}>{t('loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null
      }
    />
  );
});

export default ExploreWebGrid;

const styles = StyleSheet.create({
  // Grid card
  gridCard: {
    marginBottom: CARD_GAP,
  },
  cardInner: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#172033',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    } as any),
  },
  posterWrapper: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: '#1e293b',
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#1e293b',
  },
  posterFallbackText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
  watchlistBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(11,17,32,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  watchlistBadgeActive: {
    backgroundColor: 'rgba(6,78,59,0.85)',
    borderColor: '#10b981',
  },
  ratingChip: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingChipText: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '700',
  },
  cardMeta: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardTitle: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardYear: {
    color: '#64748b',
    fontSize: 11,
  },
  // Grid list
  gridContainer: {
    paddingBottom: 120,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
  },
  columnWrapper: {
    gap: CARD_GAP,
  },
  centerState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 16,
  },
  stateText: {
    color: '#64748b',
    fontSize: 15,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});

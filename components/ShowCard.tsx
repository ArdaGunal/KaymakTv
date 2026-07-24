import React, { useState, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Star, Plus, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import MediaPoster from './MediaPoster';
import ProgressBar from './ProgressBar';
import { useLibrarySelector, useLibraryActions } from '../context/LibraryContext';
import { useTrackingStore } from '../store/tracking/useTrackingStore';
import { generateMediaSlug } from '../utils/slugHelper';
import { getProgressBarColor } from '../utils/progressBarColor';
import { useTranslation } from 'react-i18next';
import { formatRating } from '../utils/formatRating';

const ShowCard = memo(({ data }: { data: any }) => {
  const { t } = useTranslation(['media', 'common']);
  const router = useRouter();
  // Katı seçici: tam context aboneliği listedeki HER kartı her store
  // değişiminde yeniden çiziyordu — keşfet kaydırmasındaki takılmanın kaynağı.
  const { watchlistShows, watchlistMovies, watchedShows, watchedMovies, showProgressMap } = useLibrarySelector(s => ({
    watchlistShows: s.watchlistShows,
    watchlistMovies: s.watchlistMovies,
    watchedShows: s.watchedShows,
    watchedMovies: s.watchedMovies,
    showProgressMap: s.showProgressMap,
  }));
  const { toggleWatchlistStatus } = useLibraryActions();
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);
  const droppedShowIds = useTrackingStore((s) => s.droppedShowIds);
  const hydrateTracking = useTrackingStore((s) => s.hydrate);

  // İzleme sekmesine hiç uğramadan doğrudan Keşfet'e gelinmiş olabilir — bu
  // durumda `droppedShowIds` boş kalır ve daha önce bırakılmış bir dizi burada
  // yanlışlıkla "aktif" (mavi) görünürdü. `hydrate()` idempotent olduğu için
  // her kart örneğinden çağrılması güvenli (ilk çağrıdan sonra no-op).
  useEffect(() => {
    hydrateTracking();
  }, [hydrateTracking]);

  const media = data?.show || data?.movie;
  
  // Eğer data hiç yoksa sessizce render etme, çökme!
  if (!data || !media) {
    console.error('[UI ÇÖKME ÖNLENDİ] ShowCard eksik data aldı:', data);
    return null; 
  }

  const type = data.movie ? 'movie' : 'show';
  const traktId = media?.ids?.trakt;
  const tmdbId = media?.ids?.tmdb || '';

  const isWatchlisted = type === 'movie' 
    ? watchlistMovies.some(m => m.movie?.ids?.trakt === traktId)
    : watchlistShows.some(s => s.show?.ids?.trakt === traktId);

  const isWatched = type === 'movie'
    ? watchedMovies.some(m => m.movie?.ids?.trakt === traktId)
    : watchedShows.some(s => s.show?.ids?.trakt === traktId);

  const isAdded = isWatchlisted || isWatched;

  const progress = type === 'show' && traktId ? showProgressMap[traktId] : null;
  const hasProgress = progress && progress.aired > 0 && progress.completed > 0;
  const progressPercentage = hasProgress ? (progress.completed / progress.aired) * 100 : 0;
  const isDropped = type === 'show' && droppedShowIds.includes(traktId);
  const isFinished = !!hasProgress && progress.completed >= progress.aired;
  const progressColor = getProgressBarColor(isDropped, isFinished);

  const handleToggleWatchlist = async (e: any) => {
    e.stopPropagation();
    if (!traktId || isWatchlistLoading) return;
    
    setIsWatchlistLoading(true);
    try {
      await toggleWatchlistStatus(traktId, type, isWatchlisted, media);
    } catch (error) {
      Alert.alert(t('common:error'), t('listAddError'));
    } finally {
      setIsWatchlistLoading(false);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.8}
      onPress={() => {
        if (traktId) {
          const slug = generateMediaSlug(traktId, media?.ids?.slug, media?.title);
          router.push(`/${type}/${slug}?tmdbId=${tmdbId}`);
        }
      }}
    >
      <View style={styles.posterContainer}>
        <MediaPoster 
          tmdbId={media?.ids?.tmdb} 
          type={data.movie ? 'movie' : 'show'} 
          title={media?.title} 
          style={styles.posterImage} 
        />
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.titleHeader}>
          <Text style={styles.titleText} numberOfLines={1}>{media?.title}</Text>
          <TouchableOpacity 
            style={[styles.watchlistButton, isAdded && styles.watchlistButtonActive]} 
            onPress={handleToggleWatchlist}
            disabled={isWatchlistLoading || isWatched}
          >
            {isWatchlistLoading ? (
            <ActivityIndicator size="small" />
            ) : isAdded ? (
              <Check size={18} color="#10b981" strokeWidth={3} />
            ) : (
              <Plus size={18} color="#a3a3a3" strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.yearText}>{media?.year || t('unknown')}</Text>
          <View style={styles.separator} />
          <View style={styles.ratingContainer}>
            <Star size={14} color="#facc15" fill="#facc15" />
            <Text style={styles.ratingText}>
              {formatRating(media?.rating)}
            </Text>
          </View>
          {data.watchers !== undefined && (
            <>
              <View style={styles.separator} />
              <Text style={styles.watchersText}>{data.watchers} {t('watching')}</Text>
            </>
          )}
        </View>
        
        {media?.overview ? (
          <Text style={styles.overviewText} numberOfLines={3}>{media.overview}</Text>
        ) : (
          <Text style={styles.noOverviewText}>{t('noOverview')}</Text>
        )}
      </View>
      {hasProgress && (
        <ProgressBar
          percentage={progressPercentage}
          fillColor={progressColor}
          style={styles.progressBar}
        />
      )}
    </TouchableOpacity>
  );
});

export default ShowCard;

const styles = StyleSheet.create({
  // Dizi/film kartlarıyla aynı tasarım dili: slate yüzey + ince kenarlık + yumuşak köşe
  card: {
    flexDirection: 'row',
    backgroundColor: '#172033',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    height: 144,
    borderWidth: 1,
    borderColor: '#22304A',
    position: 'relative',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  posterContainer: {
    width: 96,
    backgroundColor: '#1e293b',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0B1120',
  },
  contentContainer: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  titleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  watchlistButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  watchlistButtonActive: {
    backgroundColor: 'rgba(6, 78, 59, 0.6)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  yearText: {
    color: '#a3a3a3',
    fontSize: 12,
  },
  separator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#525252',
    marginHorizontal: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: 'bold',
  },
  watchersText: {
    color: '#a3a3a3',
    fontSize: 12,
  },
  overviewText: {
    color: '#d4d4d4',
    fontSize: 12,
    lineHeight: 18,
  },
  noOverviewText: {
    color: '#737373',
    fontSize: 12,
    fontStyle: 'italic',
  },
});

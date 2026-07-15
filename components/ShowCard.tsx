import React, { useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Star, Plus, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import MediaPoster from './MediaPoster';
import { useLibrary } from '../context/LibraryContext';
import { useTranslation } from 'react-i18next';

const ShowCard = memo(({ data }: { data: any }) => {
  const { t } = useTranslation(['media', 'common']);
  const router = useRouter();
  const { watchlistShows, watchlistMovies, watchedShows, watchedMovies, toggleWatchlistStatus } = useLibrary();
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);

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
          router.push(`/${type}/${traktId}?tmdbId=${tmdbId}`);
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
              <ActivityIndicator size="small" color="#10b981" />
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
              {media?.rating ? (media.rating / 2).toFixed(1) : '-'}
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
    </TouchableOpacity>
  );
});

export default ShowCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#0B1120',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    height: 144,
    borderWidth: 1,
    borderColor: '#172033',
  },
  posterContainer: {
    width: 96,
    backgroundColor: '#0B1120',
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
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  watchlistButtonActive: {
    backgroundColor: '#064e3b',
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

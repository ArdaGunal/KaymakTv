import React, { useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { useLibrary } from '../../context/LibraryContext';
import { useRouter } from 'expo-router';
import { useAirCountdown } from '../../hooks/useAirCountdown';
import { useTranslation } from 'react-i18next';
import MediaPoster from '../MediaPoster';
import { generateMediaSlug } from '../../utils/slugHelper';

const MovieCard = memo(({ data, onMovieFinished }: { data: any, onMovieFinished?: (title: string) => void }) => {
  const { t } = useTranslation(['media', 'common']);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { markMovieAsWatched } = useLibrary();
  const airStatus = useAirCountdown(data.rawDate);

  const handleCheckIn = async () => {
    if (isLoading || isSuccess) return;
    
    setIsLoading(true);
    try {
      await markMovieAsWatched(data.id);
      setIsSuccess(true);
      
      setTimeout(() => {
        if (onMovieFinished) {
          onMovieFinished(data.title);
        }
      }, 1000);
      
    } catch (error) {
      Alert.alert(t('common:error'), t('movieMarkError'));
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.card, isSuccess && styles.cardSuccess]} 
      activeOpacity={0.8}
      onPress={() => {
        if (data?.id) {
          const slug = generateMediaSlug(data.id, data.slug, data.title);
          router.push(`/movie/${slug}?tmdbId=${data.tmdbId || ''}`);
        }
      }}
    >
      {/* Poster */}
      <View style={styles.posterContainer}>
        <MediaPoster 
          tmdbId={data.tmdbId} 
          type="movie" 
          title={data.title} 
          style={styles.posterImage} 
        />
      </View>
      
      {/* Content */}
      <View style={styles.contentContainer}>
        
        {/* Movie Title */}
        <Text style={styles.movieTitleText} numberOfLines={2}>
          {isSuccess ? t('addedToHistory') : data.title}
        </Text>
        
        {/* Release Year / Date */}
        {!isSuccess && (
          <Text style={styles.yearText}>
            {data.releaseDate || data.year || ''}
          </Text>
        )}
        
        {/* Tags */}
        {data.tags && data.tags.length > 0 && !isSuccess && (
          <View style={styles.tagsContainer}>
            {data.tags.map((tag: string, index: number) => (
              <View key={index} style={[styles.tag, styles.tagWhite]}>
                <Text style={styles.tagTextBlack}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      
      {/* Check Button or Countdown */}
      <View style={styles.checkButtonContainer}>
        {data.rawDate !== undefined && !airStatus.isAired ? (
          <View style={styles.countdownContainer}>
            {airStatus.text.includes(t('day')) ? (
              <>
                <Text style={styles.countdownNumber}>{airStatus.text.replace(` ${t('day')}`, '')}</Text>
                <Text style={styles.countdownText}>{t('day')}</Text>
              </>
            ) : (
              <Text style={[styles.countdownText, { color: '#10b981', fontSize: 11, textAlign: 'center' }]}>
                {airStatus.text}
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.checkButton, isSuccess && styles.checkButtonSuccess]} 
            onPress={handleCheckIn}
            disabled={isLoading || isSuccess}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Check size={20} color={isSuccess ? "#fff" : "#000"} strokeWidth={3} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default MovieCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    height: 144,
  },
  posterContainer: {
    width: 96,
    backgroundColor: '#262626',
    position: 'relative',
  },
  posterImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#262626',
  },
  contentContainer: {
    flex: 1,
    padding: 12,
    paddingLeft: 16,
    justifyContent: 'center',
  },
  movieTitleText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  yearText: {
    color: '#a3a3a3',
    fontSize: 14,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tagWhite: {
    backgroundColor: '#ffffff',
  },
  tagTextBlack: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  checkButtonContainer: {
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  checkButton: {
    width: 40,
    height: 40,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSuccess: {
    backgroundColor: '#064e3b',
  },
  checkButtonSuccess: {
    backgroundColor: '#10b981',
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
  },
  countdownNumber: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  countdownText: {
    color: '#a3a3a3',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

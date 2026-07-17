import React, { useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import EpisodeCheckButton from './EpisodeCheckButton';
import MediaPoster from './MediaPoster';
import InlineRater from './InlineRater';
import { addRating } from '../services/traktApi';
import { useAirCountdown } from '../hooks/useAirCountdown';
import { useTranslation } from 'react-i18next';
import { generateMediaSlug, generateEpisodeSlug } from '../utils/slugHelper';

interface EpisodeCardProps {
  data: any;
  onShowFinished?: (showName: string, showId: number) => void;
}

const EpisodeCard = memo(({ data, onShowFinished }: EpisodeCardProps) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();
  const { t } = useTranslation('media');
  
  // Eğer rawDate (yayın tarihi) varsa dinamik sayacı başlat
  const airStatus = useAirCountdown(data?.rawDate);

  if (!data) {
    console.error('[UI ÇÖKME ÖNLENDİ] EpisodeCard eksik data aldı.');
    return null;
  }

  const handleCardPress = () => {
    const showTraktId = data?.showId || data?.rawTraktId || data?.id; // If showId is not provided, this might be flawed. Let's see. Wait, in episode card, showId is the show.
    const epTraktId = data?.rawTraktId || data?.id;
    if (!epTraktId) {
      console.error('[UI ÇÖKME ÖNLENDİ] EpisodeCard tıklanamaz, sId bulunamadı!');
      return;
    }
    
    const slug = generateEpisodeSlug(showTraktId || epTraktId, data?.slug, data?.showName, data?.season || 1, data?.episode || 1, epTraktId);
    
    router.push(`/episode/${slug}${data?.tmdbId ? `?showTmdbId=${data.tmdbId}` : ''}`);
  };

  return (
    <TouchableOpacity 
      style={[styles.card, isSuccess && styles.cardSuccess]}
      activeOpacity={0.8}
      onPress={handleCardPress}
    >
      {/* Poster */}
      <View style={styles.posterContainer}>
        <MediaPoster 
          tmdbId={data.tmdbId} 
          type="show" 
          title={data.showName} 
          style={styles.posterImage} 
        />
      </View>
      
      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Show Name Pill */}
        <TouchableOpacity 
          style={styles.showNamePill}
          onPress={() => {
            const showTraktId = data?.showId || data?.rawTraktId || data?.id;
            if (showTraktId) {
              const showSlug = generateMediaSlug(showTraktId, data?.slug, data?.showName);
              router.push(`/show/${showSlug}?tmdbId=${data?.tmdbId || ''}`);
            }
          }}
        >
          <Text style={styles.showNameText}>{data.showName}</Text>
          <ChevronRight size={12} color="#fff" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
        
        {/* Episode Number */}
        <View style={styles.episodeNumberContainer}>
          <Text style={styles.episodeNumberText}>
            {isSuccess ? t('episodeWatched') : `S${String(data.season).padStart(2, '0')} | E${String(data.episode).padStart(2, '0')}`}
          </Text>
          {data.remaining && !isSuccess && !data.isCalculating && (
            <Text style={styles.remainingText}>+{data.remaining}</Text>
          )}
        </View>
        
        {/* Episode Title */}
        <Text style={styles.episodeTitleText} numberOfLines={1}>
          {isSuccess ? t('addedToHistory') : (data.isCalculating ? t('lastWatchedSearching') : data.title)}
        </Text>
        
        {/* İzlenen Toplam Bölüm Sayısı */}
        {!isSuccess && !data.isCalculating && data.completedCount !== null && data.completedCount !== undefined && (
          <Text style={styles.completedCountText}>{data.completedCount} {t('episodesWatched')}</Text>
        )}
        
        {/* Tags */}
        {data.tags && data.tags.length > 0 && !isSuccess && (
          <View style={styles.tagsContainer}>
            {data.tags.includes('PREMIERE') && (
              <View style={[styles.tag, styles.tagWhite]}>
                <Text style={styles.tagTextBlack}>{t('premiere')}</Text>
              </View>
            )}
            {data.tags.includes('BIRAKILDI') && (
              <View style={[styles.tag, styles.tagYellow]}>
                <Text style={styles.tagTextBlack}>{t('dropped')}</Text>
              </View>
            )}
            {data.tags.includes('YENİ') && (
              <View style={[styles.tag, styles.tagYellow]}>
                <Text style={styles.tagTextBlack}>{t('new')}</Text>
              </View>
            )}
            {data.tags.includes('EN SON') && (
              <View style={[styles.tag, styles.tagGhost]}>
                <Text style={styles.tagTextGhost}>{t('last')}</Text>
              </View>
            )}
            {data.tags.includes('TAMAMLANDI') && (
              <View style={[styles.tag, styles.tagWhite]}>
                <Text style={styles.tagTextBlack}>{t('completed')}</Text>
              </View>
            )}
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
        ) : data.isCalculating ? (
          <ActivityIndicator size="small" color="#a3a3a3" />
        ) : (
          <>
            <EpisodeCheckButton 
              traktId={data.rawTraktId || data.id}
              season={data.season}
              episode={data.episode}
              showName={data.showName}
              onShowFinished={onShowFinished}
              onSuccessStateChange={setIsSuccess}
            />
            {isSuccess && (
              <InlineRater 
                onRate={async (val) => {
                  await addRating(data.rawTraktId || data.id, 'episode', val, data.season, data.episode);
                }} 
              />
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default EpisodeCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#172033', // Midnight Slate uyumlu ton
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    height: 144,
  },
  posterContainer: {
    width: 112,
    backgroundColor: '#172033',
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
    backgroundColor: '#172033',
  },
  contentContainer: {
    flex: 1,
    padding: 12,
    paddingLeft: 16,
    justifyContent: 'center',
  },
  showNamePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a3a3a3',
    borderRadius: 9999,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 8,
  },
  showNameText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  episodeNumberContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  episodeNumberText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 1,
  },
  remainingText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  episodeTitleText: {
    color: '#d4d4d4',
    fontSize: 14,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
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
  tagYellow: {
    backgroundColor: '#facc15',
  },
  tagTextBlack: {
    color: '#0B1120',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tagGhost: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 0,
    shadowOpacity: 0,
  },
  tagTextGhost: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  checkButtonContainer: {
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: 'bold',
  },
  countdownText: {
    color: '#a3a3a3',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
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
  completedCountText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});

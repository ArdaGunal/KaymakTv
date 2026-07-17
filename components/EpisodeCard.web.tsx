import React, { useState, memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayCircle, Info } from 'lucide-react-native';
import MediaPoster from './MediaPoster';
import { useTranslation } from 'react-i18next';
import { useAirCountdown } from '../hooks/useAirCountdown';
import { useResponsive } from '../hooks/useResponsive';
import EpisodeCardMobile from './EpisodeCardMobile';
import EpisodeCheckButton from './EpisodeCheckButton';
import { generateMediaSlug, generateEpisodeSlug } from '../utils/slugHelper';

interface EpisodeCardProps {
  data: any;
  onShowFinished?: (showName: string, showId: number) => void;
}

const EpisodeCard = memo(({ data, onShowFinished }: EpisodeCardProps) => {
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const { t } = useTranslation(['media', 'common']);
  const airStatus = useAirCountdown(data?.rawDate);
  
  const [isHovered, setIsHovered] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: isHovered ? 1.05 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isHovered]);

  if (!data) return null;

  if (!isDesktop) {
    return <EpisodeCardMobile data={data} onShowFinished={onShowFinished} />;
  }

  const handleCardPress = () => {
    const showTraktId = data?.showId || data?.rawTraktId || data?.id; 
    const epTraktId = data?.rawTraktId || data?.id;
    if (!epTraktId) {
      console.error('[UI ÇÖKME ÖNLENDİ] EpisodeCard tıklanamaz, sId bulunamadı!');
      return;
    }
    
    const slug = generateEpisodeSlug(showTraktId || epTraktId, data?.slug, data?.showName, data?.season || 1, data?.episode || 1, epTraktId);
    
    router.push(`/episode/${slug}`);
  };

  const handleShowInfoPress = (e: any) => {
    e.stopPropagation();
    const showTraktId = data?.showId || data?.rawTraktId || data?.id;
    if (showTraktId) {
      const showSlug = generateMediaSlug(showTraktId, data?.slug, data?.showName);
      router.push(`/show/${showSlug}?tmdbId=${data?.tmdbId || ''}`);
    }
  };

  const isFuture = data.rawDate !== undefined && !airStatus.isAired;

  return (
    <View 
      // @ts-ignore - Web specific
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={styles.container}
    >
      <Pressable onPress={handleCardPress}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }, isHovered && styles.cardHovered]}>
        <MediaPoster 
          tmdbId={data.tmdbId} 
          type="show" 
          title={data.showName} 
          style={styles.posterImage} 
        />
        
        {/* Countdown Badge for Upcoming Shows */}
        {isFuture && (
          <View style={styles.countdownBadge}>
             <Text style={styles.countdownText}>{airStatus.text}</Text>
          </View>
        )}
        
        {/* Tags */}
        {data.tags && data.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {data.tags.map((tag: string) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag === 'WATCHLIST' ? t('watchlistTab') : tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Hover Overlay */}
        {isHovered && (
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,1)']}
            style={styles.hoverOverlay}
          >
            <View style={styles.topActions}>
              <Pressable 
                style={styles.infoButton}
                onPress={handleShowInfoPress}
              >
                <Info size={18} color="#fff" strokeWidth={2} />
              </Pressable>
            </View>

            <View style={styles.playIconContainer}>
              <PlayCircle color="#ffffff" size={48} strokeWidth={1.5} style={styles.playIcon} />
            </View>
            <View style={styles.hoverContent}>
              <View style={styles.hoverContentLeft}>
                <Text style={styles.showName} numberOfLines={1}>{data.showName || data.title}</Text>
                <Text style={styles.episodeText}>
                  {data.season !== undefined && data.episode !== undefined ? 
                    `S${String(data.season).padStart(2, '0')} | E${String(data.episode).padStart(2, '0')}` : 
                    t('season')}
                </Text>
                <Text style={styles.episodeTitle} numberOfLines={1}>
                  {data.isCalculating ? t('lastWatchedSearching') : data.title}
                </Text>
              </View>
              {(data.rawTraktId || data.id) && data.season !== undefined && data.episode !== undefined && (
                <View style={styles.hoverContentRight}>
                  <EpisodeCheckButton 
                    traktId={data.rawTraktId || data.id} 
                    season={data.season} 
                    episode={data.episode} 
                    showName={data.showName}
                    onShowFinished={onShowFinished}
                    onSuccessStateChange={setIsSuccess}
                  />
                </View>
              )}
            </View>
          </LinearGradient>
        )}
      </Animated.View>
      </Pressable>
    </View>
  );
});

export default EpisodeCard;

const styles = StyleSheet.create({
  container: {
    marginRight: 16,
    paddingVertical: 16, // Hover esnasında büyüme için margin bırakıyoruz
    paddingHorizontal: 8,
  },
  card: {
    width: 180,
    height: 270,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#172033',
    cursor: 'pointer',
    transition: 'box-shadow 0.3s ease',
  } as any,
  cardHovered: {
    // @ts-ignore
    boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
    zIndex: 10,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  countdownBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  countdownText: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 12,
  },
  tagsContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
  },
  tag: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 16,
  },
  topActions: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    ...( { cursor: 'pointer', transition: 'all 0.2s ease' } as any)
  },
  playIconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    opacity: 0.9,
    filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))' as any,
  },
  hoverContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
  },
  hoverContentLeft: {
    flex: 1,
    paddingRight: 8,
  },
  hoverContentRight: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 4,
  },
  showName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  episodeText: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 2,
  },
  episodeTitle: {
    color: '#94a3b8',
    fontSize: 11,
  },
});

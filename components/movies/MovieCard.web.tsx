import React, { useState, memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayCircle } from '../icons';
import { useTranslation } from 'react-i18next';
import { useAirCountdown } from '../../hooks/useAirCountdown';
import MediaPoster from '../MediaPoster';
import { useResponsive } from '../../hooks/useResponsive';
import MovieCardMobile from './MovieCardMobile';
import TrackingCardMenu from '../tracking/TrackingCardMenu';
import BitisIcerigi, { BITIS_RENK } from '../tracking/BitisIcerigi';
import { useFilmIzle } from '../../hooks/useFilmIzle';
import { Check } from '../icons';
import { generateMediaSlug } from '../../utils/slugHelper';
import { getMediaTagLabel } from '../../utils/mediaTagLabel';
import { MOBILE_PALETTE } from '../../constants/mobilePalette';

interface MovieCardProps {
  data: any;
  /** Verilirse afişin üzerinde 3-nokta menüsü (Bırak/Listeye Ekle/Favorile/Paylaş) gösterilir. */
  onToggleDropped?: (id: number) => void;
}

const MovieCard = memo(({ data, onToggleDropped }: MovieCardProps) => {
  // KRİTİK: Tüm hook'lar koşullu return'lerden ÖNCE çağrılmalı (Rules of Hooks).
  // Eskiden `if (!isDesktop) return <MovieCardMobile/>` hook'ların üstündeydi;
  // pencere 768px eşiğini geçince hook sayısı değişiyor ve ekran çöküyordu.
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const { t } = useTranslation(['media', 'common']);
  const airStatus = useAirCountdown(data?.rawDate);
  // Mobil kartla ORTAK «izledim» akışı (BITIS-01).
  const izle = useFilmIzle(data);

  const [isHovered, setIsHovered] = useState(false);
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
    return (
      <MovieCardMobile
        data={data}
        onToggleDropped={onToggleDropped}
      />
    );
  }

  const handleCardPress = () => {
    if (data?.id) {
      const slug = generateMediaSlug(data.id, data.slug, data.title);
      router.push(`/movie/${slug}?tmdbId=${data.tmdbId || ''}`);
    }
  };

  // BITIS-01: film az önce izlendi — afişin altında mavi «bitti» paneli,
  // birkaç saniye sonra kart listeden kayar.
  if (data.bitti) {
    return (
      <View style={styles.container}>
        <View style={[styles.card, styles.cardBitti]}>
          <MediaPoster tmdbId={data.tmdbId} type="movie" title={data.title} style={styles.posterImage} />
          <View style={styles.bitisPaneli}>
            <BitisIcerigi tur="movie" id={data.id} ad={data.title} film={data.raw} yerlesim="afis" />
          </View>
        </View>
      </View>
    );
  }

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
          type="movie" 
          title={data.title} 
          style={styles.posterImage} 
        />
        
        {/* Countdown Badge for Upcoming Movies */}
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
                <Text style={styles.tagText}>{getMediaTagLabel(tag, t)}</Text>
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
            {onToggleDropped && (
              <View style={styles.overlayTop}>
                <TrackingCardMenu
                  id={data.id}
                  title={data.title}
                  mediaType="movie"
                  tmdbId={data.tmdbId}
                  slug={data.slug}
                  onToggleDropped={() => onToggleDropped(data.id)}
                />
              </View>
            )}

            <View style={styles.playIconContainer}>
              <PlayCircle color="#ffffff" size={48} strokeWidth={1.5} style={styles.playIcon} />
            </View>
            <View style={styles.hoverContent}>
              <View style={styles.hoverContentLeft}>
                <Text style={styles.movieTitle} numberOfLines={2}>{data.title}</Text>
                <Text style={styles.yearText}>{data.releaseDate || data.year || ''}</Text>
              </View>
              {data.id && (
                <View style={styles.hoverContentRight}>
                  <Pressable style={styles.checkButton} onPress={izle}>
                    <Check size={20} color="#9ca3af" strokeWidth={3} />
                  </Pressable>
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

export default MovieCard;

const styles = StyleSheet.create({
  container: {
    marginRight: 16,
    paddingVertical: 16, // Hover esnasında büyüme için margin
    paddingHorizontal: 8,
  },
  card: {
    width: 180,
    height: 270,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: MOBILE_PALETTE.surface,
    cursor: 'pointer',
    position: 'relative',
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
  cardBitti: { borderWidth: 1, borderColor: BITIS_RENK.kenar, cursor: 'default' } as any,
  bitisPaneli: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: 'rgba(21, 34, 46, 0.96)',
    borderTopWidth: 1,
    borderTopColor: BITIS_RENK.kenar,
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
    color: MOBILE_PALETTE.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 16,
  },
  overlayTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  checkButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...( { cursor: 'pointer', transition: 'all 0.2s ease' } as any)
  },
  movieTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  yearText: {
    color: MOBILE_PALETTE.body,
    fontWeight: 'bold',
    fontSize: 12,
  },
});

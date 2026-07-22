import React, { useState, memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayCircle, Info } from 'lucide-react-native';
import MediaPoster from './MediaPoster';
import ProgressBar from './ProgressBar';
import { useTranslation } from 'react-i18next';
import { useAirCountdown } from '../hooks/useAirCountdown';
import { useResponsive } from '../hooks/useResponsive';
import EpisodeCardMobile from './EpisodeCardMobile';
import EpisodeCheckButton from './EpisodeCheckButton';
import TrackingCardMenu from './tracking/TrackingCardMenu';
import { generateMediaSlug, generateEpisodeSlug } from '../utils/slugHelper';
import { getProgressBarColor } from '../utils/progressBarColor';

interface EpisodeCardProps {
  data: any;
  onShowFinished?: (showName: string, showId: number) => void;
  /** Verilirse posterin üzerinde 3-nokta menüsü (Bırakılanlara Ekle/Çıkar) gösterilir. */
  onToggleDropped?: (id: number) => void;
}

// Ham etiket kodları (BIRAKILDI, EN SON, ...) her zaman Türkçe üretiliyordu ve
// burada çevrilmeden doğrudan basılıyordu — İngilizce arayüzde de Türkçe metin
// görünüyordu. Bilinen kodlar artık i18n üzerinden çevriliyor.
function getTagLabel(tag: string, t: (key: string) => string): string {
  switch (tag) {
    case 'WATCHLIST':
      return t('watchlistTab');
    case 'BIRAKILDI':
      return t('dropped');
    case 'EN SON':
      return t('last');
    default:
      return tag;
  }
}

// Progress percentage is computed here, ready-to-use for ProgressBar
function getProgressPct(data: any): number | null {
  if (
    data?.completedCount !== null &&
    data?.completedCount !== undefined &&
    data?.totalCount &&
    data.totalCount > 0
  ) {
    return Math.min(100, (data.completedCount / data.totalCount) * 100);
  }
  return null;
}

const CARD_WIDTH = 180;
const CARD_HEIGHT = 270;

const EpisodeCard = memo(({ data, onShowFinished, onToggleDropped }: EpisodeCardProps) => {
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const { t } = useTranslation(['media', 'common']);
  const airStatus = useAirCountdown(data?.rawDate);

  const [isHovered, setIsHovered] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isHovered ? 1.05 : 1,
        useNativeDriver: Platform.OS !== 'web',
        friction: 6,
        tension: 200,
      }),
      Animated.timing(overlayAnim, {
        toValue: isHovered ? 1 : 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [isHovered]);

  if (!data) return null;

  if (!isDesktop) {
    return <EpisodeCardMobile data={data} onShowFinished={onShowFinished} onToggleDropped={onToggleDropped} />;
  }

  const handleCardPress = () => {
    const showTraktId = data?.showId || data?.rawTraktId || data?.id;
    const epTraktId = data?.rawTraktId || data?.id;
    if (!epTraktId) return;
    const slug = generateEpisodeSlug(
      showTraktId || epTraktId,
      data?.slug,
      data?.showName,
      data?.season || 1,
      data?.episode || 1,
      epTraktId
    );
    router.push(`/episode/${slug}${data?.tmdbId ? `?showTmdbId=${data.tmdbId}` : ''}`);
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
  const progressPct = getProgressPct(data);
  const isDropped = !!data.tags?.includes('BIRAKILDI');
  const progressColor = getProgressBarColor(isDropped, !!data.tags?.includes('TAMAMLANDI'));

  const episodeCode =
    data.season !== undefined && data.episode !== undefined
      ? `S${String(data.season).padStart(2, '0')} | E${String(data.episode).padStart(2, '0')}`
      : t('season');

  return (
    <View
      // @ts-ignore web hover
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={styles.container}
    >
      <Pressable onPress={handleCardPress}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
              ...(Platform.OS === 'web' && isHovered
                ? { boxShadow: '0 12px 30px rgba(0,0,0,0.65)' }
                : {}),
            },
          ]}
        >
          {/* Poster */}
          <MediaPoster
            tmdbId={data.tmdbId}
            type="show"
            title={data.showName}
            style={styles.posterImage}
          />

          {/* ── Always-visible bottom strip (tags) ─────── */}
          {!isFuture && data.tags && data.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {data.tags.map((tag: string) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{getTagLabel(tag, t)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Countdown badge (future episodes) */}
          {isFuture && (
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownText}>{airStatus.text}</Text>
            </View>
          )}

          {/* Progress bar pinned to bottom of poster */}
          {progressPct !== null && (
            <ProgressBar
              percentage={progressPct}
              height={3}
              fillColor={progressColor}
              trackColor="rgba(255,255,255,0.12)"
              style={styles.progressBar}
            />
          )}

          {/* ── Hover overlay ───────────────────────────── */}
          <Animated.View
            style={[styles.hoverOverlay, { opacity: overlayAnim }]}
            pointerEvents={isHovered ? 'box-none' : 'none'}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.95)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />

            {/* Top row: Info button + Tags moved here for no clash */}
            <View style={styles.overlayTop}>
              <Pressable style={styles.infoButton} onPress={handleShowInfoPress}>
                <Info size={16} color="#fff" strokeWidth={2} />
              </Pressable>
              {onToggleDropped && (
                <TrackingCardMenu
                  id={data.id}
                  showName={data.showName}
                  tmdbId={data.tmdbId}
                  slug={data.slug}
                  isDropped={!!data.tags?.includes('BIRAKILDI')}
                  onToggleDropped={() => onToggleDropped(data.id)}
                />
              )}
            </View>

            {/* Center play icon */}
            <View style={styles.playIconContainer}>
              <PlayCircle color="#ffffff" size={44} strokeWidth={1.5} />
            </View>

            {/* Bottom: show name + episode code + title + check button */}
            <View style={styles.overlayBottom}>
              <View style={styles.overlayCopy}>
                <Text style={styles.showName} numberOfLines={1}>
                  {data.showName || data.title}
                </Text>
                <Text style={styles.episodeCode}>{episodeCode}</Text>
                <Text style={styles.episodeTitle} numberOfLines={2}>
                  {data.isCalculating ? t('lastWatchedSearching') : data.title}
                </Text>
              </View>

              {(data.rawTraktId || data.id) &&
                data.season !== undefined &&
                data.episode !== undefined && (
                  <View style={styles.checkBtnWrapper}>
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
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
});

export default EpisodeCard;

const styles = StyleSheet.create({
  container: {
    marginRight: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#172033',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'box-shadow 0.25s ease',
    } as any),
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  // Tags — always-visible, bottom-left of poster
  tagsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
    zIndex: 2,
  },
  tag: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagText: {
    color: '#e2e8f0',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Countdown
  countdownBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  countdownText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  // Progress bar
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 3,
  },
  // Hover overlay
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 12,
    zIndex: 10,
  },
  overlayTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  infoButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    ...(Platform.OS === 'web' && { cursor: 'pointer' } as any),
  },
  playIconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  overlayCopy: {
    flex: 1,
    gap: 2,
  },
  showName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  episodeCode: {
    color: '#60a5fa',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  episodeTitle: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 15,
  },
  checkBtnWrapper: {
    flexShrink: 0,
    paddingBottom: 2,
  },
});

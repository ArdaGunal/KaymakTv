import React, { useState, memo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { ChevronRight, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import MediaPoster from './MediaPoster';
import ProgressBar from './ProgressBar';
import EpisodeCardActions from './EpisodeCardActions';
import TrackingCardMenu from './tracking/TrackingCardMenu';
import { useTranslation } from 'react-i18next';
import { generateMediaSlug, generateEpisodeSlug } from '../utils/slugHelper';
import { getProgressBarColor } from '../utils/progressBarColor';

interface EpisodeCardProps {
  data: any;
  onShowFinished?: (showName: string, showId: number) => void;
  /** Verilirse posterin üzerinde 3-nokta menüsü (Bırakılanlara Ekle/Çıkar) gösterilir. */
  onToggleDropped?: (id: number) => void;
}

// Progress percentage — pure calculation, no side effects
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

const EpisodeCard = memo(({ data, onShowFinished, onToggleDropped }: EpisodeCardProps) => {
  const [isSuccess, setIsSuccess] = useState(false);
  // Başarı ekranında gösterilecek bölüm kodu — basılma anında yakalanır,
  // çünkü store güncellenince `data` çoktan sıradaki bölüme kaymış olur.
  const [successInfo, setSuccessInfo] = useState<{ code: string | null } | null>(null);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { t } = useTranslation('media');

  // Akış: içerik kısa bir fade-out ile kaybolur → "SxxEyy izlendi" fade-in →
  // (buton ~0.5 sn bekletir, ağ isteği artık bunu bloklamıyor) → tekrar
  // fade-out → sıradaki bölüm fade-in. Kartta hiçbir şey "pat" diye değişmez
  // ama toplam geçiş de art arda bölüm işaretlerken oyalamayacak kadar hızlı.
  const handleSuccessChange = useCallback((val: boolean, info?: { season: number; episode: number }) => {
    setIsSuccess(val);
    if (val) {
      const code = info
        ? `S${String(info.season).padStart(2, '0')} | E${String(info.episode).padStart(2, '0')}`
        : null;
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 0, duration: 90, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      ]).start(() => {
        setSuccessInfo({ code });
        Animated.timing(contentOpacity, { toValue: 1, duration: 140, useNativeDriver: Platform.OS !== 'web' }).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 0, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 240, useNativeDriver: Platform.OS !== 'web' }),
      ]).start(() => {
        setSuccessInfo(null);
        Animated.timing(contentOpacity, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }).start();
      });
    }
  }, [contentOpacity, overlayOpacity]);

  if (!data) {
    console.error('[UI ÇÖKME ÖNLENDİ] EpisodeCard eksik data aldı.');
    return null;
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

  const progressPct = getProgressPct(data);
  const isDropped = !!data.tags?.includes('BIRAKILDI');
  const progressColor = getProgressBarColor(isDropped, !!data.tags?.includes('TAMAMLANDI'));

  const episodeCode = !data.isCalculating && data.season !== undefined
    ? `S${String(data.season).padStart(2, '0')} | E${String(data.episode).padStart(2, '0')}`
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={handleCardPress}
    >
      {/* Başarı arka planı: yeşile ani sıçramak yerine yumuşakça belirir/söner */}
      <Animated.View
        pointerEvents="none"
        style={[styles.successOverlay, { opacity: overlayOpacity }]}
      />

      {/* Poster */}
      <View style={styles.posterContainer}>
        <MediaPoster
          tmdbId={data.tmdbId}
          type="show"
          title={data.showName}
          style={styles.posterImage}
        />

        {/* Progress bar pinned to bottom of poster */}
        {progressPct !== null && !isSuccess && (
          <ProgressBar
            percentage={progressPct}
            height={3}
            fillColor={progressColor}
            trackColor="rgba(255,255,255,0.12)"
            style={styles.progressBar}
          />
        )}

        {onToggleDropped && (
          <TrackingCardMenu
            style={styles.menuOverlay}
            id={data.id}
            title={data.showName}
            mediaType="show"
            tmdbId={data.tmdbId}
            slug={data.slug}
            isDropped={!!data.tags?.includes('BIRAKILDI')}
            onToggleDropped={() => onToggleDropped(data.id)}
          />
        )}
      </View>

      {/* Content — crossfade: normal içerik ↔ "bölüm izlendi" mesajı */}
      <Animated.View style={[styles.contentContainer, { opacity: contentOpacity }]}>
        {/* Show Name */}
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
          <Text style={styles.showNameText} numberOfLines={1}>
            {data.showName}
          </Text>
          <ChevronRight size={10} color="#94a3b8" style={{ marginLeft: 2 }} />
        </TouchableOpacity>

        {successInfo ? (
          <>
            {/* Başarı görünümü: hangi bölümün izlendiği net yazar */}
            <View style={styles.successRow}>
              <View style={styles.successCheckBadge}>
                <Check size={12} color="#10b981" strokeWidth={3.5} />
              </View>
              <Text style={styles.episodeNumberText}>
                {successInfo.code ?? t('episodeWatched')}
              </Text>
            </View>
            <Text style={styles.successTitleText}>
              {successInfo.code ? t('episodeWatched') : t('addedToHistory')}
            </Text>
            {successInfo.code ? (
              <Text style={styles.successSubText}>{t('addedToHistory')}</Text>
            ) : null}
          </>
        ) : (
          <>
            {/* Episode Code */}
            {episodeCode ? (
              <View style={styles.episodeNumberContainer}>
                <Text style={styles.episodeNumberText}>{episodeCode}</Text>
                {data.remaining && !data.isCalculating && (
                  <Text style={styles.remainingText}>+{data.remaining}</Text>
                )}
              </View>
            ) : null}

            {/* Episode Title */}
            <Text style={styles.episodeTitleText} numberOfLines={2}>
              {data.isCalculating ? t('lastWatchedSearching') : data.title}
            </Text>

            {/* Progress text */}
            {!data.isCalculating && progressPct !== null && (
              <Text style={styles.progressText}>
                {Math.round(progressPct)}% izlendi
              </Text>
            )}

            {/* Tags */}
            {data.tags && data.tags.length > 0 && (
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
          </>
        )}
      </Animated.View>

      {/* Right: Check Button or Countdown — timer bu izole bileşenin içinde yaşar */}
      <EpisodeCardActions
        data={data}
        onSuccessStateChange={handleSuccessChange}
        onShowFinished={onShowFinished}
      />
    </TouchableOpacity>
  );
});

export default EpisodeCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#172033',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#22304A',
    overflow: 'hidden',
    marginBottom: 12,
    minHeight: 120,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#064e3b',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  successCheckBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitleText: {
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  successSubText: {
    color: 'rgba(209, 250, 229, 0.65)',
    fontSize: 11,
    fontWeight: '500',
  },
  // Poster
  posterContainer: {
    width: 84,
    backgroundColor: '#172033',
    position: 'relative',
  },
  posterImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  menuOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  // Content
  contentContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 3,
  },
  showNamePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  showNameText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    maxWidth: 140,
  },
  episodeNumberContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  episodeNumberText: {
    color: '#f1f5f9',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  remainingText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  episodeTitleText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  progressText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagWhite: { backgroundColor: '#ffffff' },
  tagYellow: { backgroundColor: '#facc15' },
  tagTextBlack: {
    color: '#0B1120',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagGhost: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tagTextGhost: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

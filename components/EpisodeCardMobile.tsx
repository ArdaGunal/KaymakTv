import React, { useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import EpisodeCheckButton from './EpisodeCheckButton';
import MediaPoster from './MediaPoster';
import InlineRater from './InlineRater';
import ProgressBar from './ProgressBar';
import { addRating } from '../services/traktApi';
import { useAirCountdown } from '../hooks/useAirCountdown';
import { useTranslation } from 'react-i18next';
import { generateMediaSlug, generateEpisodeSlug } from '../utils/slugHelper';

interface EpisodeCardProps {
  data: any;
  onShowFinished?: (showName: string, showId: number) => void;
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

const EpisodeCard = memo(({ data, onShowFinished }: EpisodeCardProps) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();
  const { t } = useTranslation('media');

  const airStatus = useAirCountdown(data?.rawDate);

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

  const episodeCode = !isSuccess && !data.isCalculating && data.season !== undefined
    ? `S${String(data.season).padStart(2, '0')} | E${String(data.episode).padStart(2, '0')}`
    : null;

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

        {/* Progress bar pinned to bottom of poster */}
        {progressPct !== null && !isSuccess && (
          <ProgressBar
            percentage={progressPct}
            height={3}
            fillColor="#10b981"
            trackColor="rgba(255,255,255,0.12)"
            style={styles.progressBar}
          />
        )}
      </View>

      {/* Content — always visible on mobile */}
      <View style={styles.contentContainer}>
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

        {/* Episode Code — always visible */}
        {episodeCode ? (
          <View style={styles.episodeNumberContainer}>
            <Text style={styles.episodeNumberText}>{episodeCode}</Text>
            {data.remaining && !isSuccess && !data.isCalculating && (
              <Text style={styles.remainingText}>+{data.remaining}</Text>
            )}
          </View>
        ) : isSuccess ? (
          <Text style={styles.episodeNumberText}>{t('episodeWatched')}</Text>
        ) : null}

        {/* Episode Title — always visible */}
        <Text style={styles.episodeTitleText} numberOfLines={2}>
          {isSuccess
            ? t('addedToHistory')
            : data.isCalculating
            ? t('lastWatchedSearching')
            : data.title}
        </Text>

        {/* Progress text */}
        {!isSuccess && !data.isCalculating && progressPct !== null && (
          <Text style={styles.progressText}>
            {Math.round(progressPct)}% izlendi
          </Text>
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

      {/* Right: Check Button or Countdown */}
      <View style={styles.checkButtonContainer}>
        {data.rawDate !== undefined && !airStatus.isAired ? (
          <View style={styles.countdownContainer}>
            {airStatus.text.includes(t('day')) ? (
              <>
                <Text style={styles.countdownNumber}>
                  {airStatus.text.replace(` ${t('day')}`, '')}
                </Text>
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
    backgroundColor: '#172033',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    minHeight: 120,
  },
  cardSuccess: {
    backgroundColor: '#064e3b',
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
  // Right panel
  checkButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    minWidth: 56,
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '800',
  },
  countdownText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});

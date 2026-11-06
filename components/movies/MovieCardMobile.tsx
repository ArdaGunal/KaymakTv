import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from '../icons';
import { useRouter } from 'expo-router';
import { useAirCountdown } from '../../hooks/useAirCountdown';
import { useFilmIzle } from '../../hooks/useFilmIzle';
import { useTranslation } from 'react-i18next';
import MediaPoster from '../MediaPoster';
import TrackingCardMenu from '../tracking/TrackingCardMenu';
import BitisIcerigi, { BITIS_RENK } from '../tracking/BitisIcerigi';
import { generateMediaSlug } from '../../utils/slugHelper';
import { getMediaTagLabel } from '../../utils/mediaTagLabel';

// Sağ panel: geri sayım / işaretleme butonu. useAirCountdown timer'ı BURADA yaşar —
// her tick'te yalnızca bu panel yeniden çizilir, kart gövdesi (poster/başlık) etkilenmez.
// Çift dokunuş koruması `useFilmIzle`'deki ref'te.
const MovieCardActions = memo(({ data, onCheckIn }: {
  data: any;
  onCheckIn: () => void;
}) => {
  const { t } = useTranslation(['media', 'common']);
  const airStatus = useAirCountdown(data.rawDate);

  return (
    <View style={styles.checkButtonContainer}>
      {data.rawDate !== undefined && !airStatus.isAired ? (
        <View style={styles.countdownContainer}>
          {airStatus.text.includes(t('day')) ? (
            <>
              <Text style={styles.countdownNumber}>{airStatus.text.replace(` ${t('day')}`, '')}</Text>
              <Text style={styles.countdownText}>{t('day')}</Text>
            </>
          ) : (
            <Text style={[styles.countdownText, styles.countdownTextLive]}>
              {airStatus.text}
            </Text>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.checkButton}
          onPress={onCheckIn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Check size={20} color="#ffffff" strokeWidth={3} />
        </TouchableOpacity>
      )}
    </View>
  );
});

interface MovieCardMobileProps {
  data: any;
  /** Verilirse posterin üzerinde 3-nokta menüsü (Bırak/Listeye Ekle/Favorile/Paylaş) gösterilir. */
  onToggleDropped?: (id: number) => void;
}

const MovieCard = memo(({ data, onToggleDropped }: MovieCardMobileProps) => {
  const { t } = useTranslation(['media', 'common']);
  const router = useRouter();
  const izle = useFilmIzle(data);
  // BITIS-01: film az önce izlendi — kart yerinde mavi «bitti» görünümünde,
  // birkaç saniye sonra listeden yumuşakça çıkar (bkz. store/bitisAniStore.ts).
  const bitti = !!data.bitti;

  return (
    <TouchableOpacity
      style={[styles.card, bitti && styles.cardBitti]}
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

        {onToggleDropped && !bitti && (
          <TrackingCardMenu
            style={styles.menuOverlay}
            id={data.id}
            title={data.title}
            mediaType="movie"
            tmdbId={data.tmdbId}
            slug={data.slug}
            onToggleDropped={() => onToggleDropped(data.id)}
          />
        )}
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.movieTitleText} numberOfLines={2}>
          {data.title}
        </Text>
        {bitti ? (
          <BitisIcerigi tur="movie" id={data.id} ad={data.title} film={data.raw} />
        ) : (
          <>
            <Text style={styles.yearText}>
              {data.releaseDate || data.year || ''}
            </Text>

            {data.tags && data.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {data.tags.map((tag: string) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{getMediaTagLabel(tag, t)}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      {!bitti && <MovieCardActions data={data} onCheckIn={izle} />}
    </TouchableOpacity>
  );
});

export default MovieCard;

const styles = StyleSheet.create({
  // EpisodeCard ile aynı gece-lacivert tasarım dili: slate yüzey + ince kenarlık
  card: {
    flexDirection: 'row',
    backgroundColor: '#172033',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#22304A',
    overflow: 'hidden',
    marginBottom: 12,
    height: 144,
  },
  cardBitti: {
    backgroundColor: BITIS_RENK.zemin,
    borderColor: BITIS_RENK.kenar,
  },
  posterContainer: {
    width: 96,
    backgroundColor: '#1e293b',
    position: 'relative',
  },
  posterImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  menuOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  contentContainer: {
    flex: 1,
    padding: 12,
    paddingLeft: 16,
    justifyContent: 'center',
  },
  movieTitleText: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 5,
  },
  yearText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tagText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  checkButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    minWidth: 56,
  },
  checkButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
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
  countdownTextLive: {
    color: '#10b981',
    fontSize: 11,
    textAlign: 'center',
  },
});

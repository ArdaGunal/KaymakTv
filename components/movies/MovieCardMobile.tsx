import React, { useState, memo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Check } from 'lucide-react-native';
import { useLibraryActions } from '../../context/LibraryContext';
import { useRouter } from 'expo-router';
import { useAirCountdown } from '../../hooks/useAirCountdown';
import { useTranslation } from 'react-i18next';
import MediaPoster from '../MediaPoster';
import TrackingCardMenu from '../tracking/TrackingCardMenu';
import { generateMediaSlug } from '../../utils/slugHelper';
import { getMediaTagLabel } from '../../utils/mediaTagLabel';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Başarı mesajının okunabilir kaldığı süre; sonrasında kart listeden
// yumuşakça çıkar. Dizi kartlarındaki akışla aynı tempo.
const SUCCESS_HOLD_MS = 1400;

// Kartın listeden çıkışını yumuşatan animasyon (yalnızca opacity — Android'de stabil).
const REMOVAL_ANIMATION = {
  duration: 260,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

// Sağ panel: geri sayım / işaretleme butonu. useAirCountdown timer'ı BURADA yaşar —
// her tick'te yalnızca bu panel yeniden çizilir, kart gövdesi (poster/başlık) etkilenmez.
const MovieCardActions = memo(({ data, isLoading, isSuccess, onCheckIn }: {
  data: any;
  isLoading: boolean;
  isSuccess: boolean;
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
          style={[styles.checkButton, isSuccess && styles.checkButtonSuccess]}
          onPress={onCheckIn}
          disabled={isLoading || isSuccess}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Check size={20} color="#ffffff" strokeWidth={3} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
});

interface MovieCardMobileProps {
  data: any;
  onMovieFinished?: (title: string) => void;
  /** Verilirse posterin üzerinde 3-nokta menüsü (Bırak/Listeye Ekle/Favorile/Paylaş) gösterilir. */
  isDropped?: boolean;
  onToggleDropped?: (id: number) => void;
}

const MovieCard = memo(({ data, onMovieFinished, isDropped, onToggleDropped }: MovieCardMobileProps) => {
  const { t } = useTranslation(['media', 'common']);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);
  // Çift dokunuş koruması: isSuccess state'i fade bitene dek gecikmeli
  // set edildiği için anlık koruma bu ref ile sağlanır.
  const busyRef = useRef(false);
  // Store aboneliği yok — sadece aksiyon referansı alınır.
  const { markMovieAsWatched } = useLibraryActions();

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ESKİ SORUN: markMovieAsWatched optimistic olarak filmi ANINDA watchlist'ten
  // çıkarıyordu → kart daha başarı mesajı görünmeden listeden "pat" diye siliniyor,
  // konfeti de 1 sn sonra durduk yere beliriyordu.
  // YENİ AKIŞ: önce kartta yumuşak "Geçmişinize eklendi" gösterilir (~1.4 sn),
  // store güncellemesi SONRA yapılır ve kart listeden animasyonla çıkar.
  const handleCheckIn = () => {
    if (busyRef.current || isLoading || isSuccess) return;
    busyRef.current = true;

    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 0, duration: 140, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 350, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      // İçerik ancak görünmezken değişir — metin "pat" diye atlamaz.
      if (isMountedRef.current) setIsSuccess(true);
      Animated.timing(contentOpacity, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
    });

    setTimeout(async () => {
      try {
        // Kartın listeden çıkışı (store güncellemesi) yumuşak olsun.
        LayoutAnimation.configureNext(REMOVAL_ANIMATION);
        await markMovieAsWatched(data.id);
        if (onMovieFinished) {
          onMovieFinished(data.title);
        }
      } catch (error) {
        Alert.alert(t('common:error'), t('movieMarkError'));
        busyRef.current = false;
        if (isMountedRef.current) {
          // Hata: başarı görünümünü yumuşakça geri al.
          Animated.parallel([
            Animated.timing(contentOpacity, { toValue: 0, duration: 140, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(overlayOpacity, { toValue: 0, duration: 350, useNativeDriver: Platform.OS !== 'web' }),
          ]).start(() => {
            setIsSuccess(false);
            Animated.timing(contentOpacity, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
          });
        }
      }
    }, SUCCESS_HOLD_MS);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => {
        if (data?.id) {
          const slug = generateMediaSlug(data.id, data.slug, data.title);
          router.push(`/movie/${slug}?tmdbId=${data.tmdbId || ''}`);
        }
      }}
    >
      {/* Başarı arka planı: ani yeşil yerine yumuşak geçiş */}
      <Animated.View
        pointerEvents="none"
        style={[styles.successOverlay, { opacity: overlayOpacity }]}
      />

      {/* Poster */}
      <View style={styles.posterContainer}>
        <MediaPoster
          tmdbId={data.tmdbId}
          type="movie"
          title={data.title}
          style={styles.posterImage}
        />

        {onToggleDropped && (
          <TrackingCardMenu
            style={styles.menuOverlay}
            id={data.id}
            title={data.title}
            mediaType="movie"
            tmdbId={data.tmdbId}
            slug={data.slug}
            isDropped={!!isDropped}
            onToggleDropped={() => onToggleDropped(data.id)}
          />
        )}
      </View>

      {/* Content — crossfade: normal içerik ↔ başarı mesajı */}
      <Animated.View style={[styles.contentContainer, { opacity: contentOpacity }]}>
        {isSuccess ? (
          <>
            <Text style={styles.movieTitleText} numberOfLines={2}>
              {data.title}
            </Text>
            <View style={styles.successRow}>
              <View style={styles.successCheckBadge}>
                <Check size={12} color="#10b981" strokeWidth={3.5} />
              </View>
              <Text style={styles.successText}>{t('addedToHistory')}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.movieTitleText} numberOfLines={2}>
              {data.title}
            </Text>

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
      </Animated.View>

      <MovieCardActions
        data={data}
        isLoading={isLoading}
        isSuccess={isSuccess}
        onCheckIn={handleCheckIn}
      />
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
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#064e3b',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
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
  successText: {
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
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
  checkButtonSuccess: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
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

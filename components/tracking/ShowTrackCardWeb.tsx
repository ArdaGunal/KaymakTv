import React, { useState, memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayCircle } from '../icons';
import MediaPoster from '../MediaPoster';
import ProgressBar from '../ProgressBar';
import EpisodeCheckButton from '../EpisodeCheckButton';
import TrackingCardMenu from './TrackingCardMenu';
import BitisIcerigi, { BITIS_RENK } from './BitisIcerigi';
import { generateMediaSlug } from '../../utils/slugHelper';
import { getProgressBarColor, ilerlemeYuzdesi } from '../../utils/progressBarColor';
import type { TrackingCard } from '../../store/tracking/trackingLogic';

interface ShowTrackCardWebProps {
  data: TrackingCard;
  /** Verilirse posterin üzerinde 3-nokta menüsü (Bırakılanlara Ekle/Çıkar) gösterilir. */
  onToggleDropped?: (id: number) => void;
}

// Masaüstü web için Netflix tarzı POSTER kart (yatay satır kartı değil). Film
// tarafındaki MovieCard.web ile aynı görsel dil: 180×270 afiş, hover'da karartma
// + oynat ikonu + başlık + işaretleme butonu. Yalnızca shows.web.tsx tarafından,
// WebCarousel içinde kullanılır — bu yüzden platform uzantısı yerine açık isim.
const ShowTrackCardWeb = memo(({ data, onToggleDropped }: ShowTrackCardWebProps) => {
  const router = useRouter();
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

  const episodeCode =
    data.readyToWatch && data.season !== undefined
      ? `S${String(data.season).padStart(2, '0')} · E${String(data.episode).padStart(2, '0')}`
      : null;

  const progressPct = ilerlemeYuzdesi(data);

  // Bu kart yalnızca takip panosunun görünür kategorilerinden beslenir
  // (Aktif/Ara Verilen/Başlanmadı) — "Bırak" ile gizlenmiş yapımlar oraya HİÇ
  // girmez, bu yüzden burada "bırakıldı" durumu diye bir şey yoktur.
  const progressColor = getProgressBarColor(false, false);

  const handleCardPress = () => {
    if (!data.id) return;
    const slug = generateMediaSlug(data.id, data.slug, data.showName);
    router.push(`/show/${slug}?tmdbId=${data.tmdbId || ''}`);
  };

  // BITIS-01: dizi az önce bitti — afişin altında mavi «bitti» paneli (hover
  // beklemeden görünür), birkaç saniye sonra kart listeden kayar.
  if (data.bitti) {
    return (
      <View style={styles.container}>
        <View style={[styles.card, styles.cardBitti]}>
          <MediaPoster tmdbId={data.tmdbId} type="show" title={data.showName} style={styles.posterImage} />
          <View style={styles.bitisPaneli}>
            <BitisIcerigi tur="show" id={data.id} ad={data.showName} yerlesim="afis" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      // @ts-ignore web
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={styles.container}
    >
      <Pressable onPress={handleCardPress}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }, isHovered && styles.cardHovered]}>
          <MediaPoster tmdbId={data.tmdbId} type="show" title={data.showName} style={styles.posterImage} />

          {onToggleDropped && (
            <TrackingCardMenu
              style={styles.menuOverlay}
              id={data.id}
              title={data.showName}
              mediaType="show"
              tmdbId={data.tmdbId}
              slug={data.slug}
              onToggleDropped={() => onToggleDropped(data.id)}
            />
          )}

          {/* İzlenebilir sıradaki bölüm kodu — küçük, şık, altta */}
          {episodeCode && !isHovered && (
            <View style={styles.episodePill}>
              <Text style={styles.episodePillText}>{episodeCode}</Text>
            </View>
          )}

          {/* İnce ilerleme çubuğu (Netflix "devam et" hissi) */}
          {progressPct !== null && !isHovered && (
            <ProgressBar
              percentage={progressPct}
              height={3}
              fillColor={progressColor}
              trackColor="rgba(255,255,255,0.15)"
              style={styles.progressBar}
            />
          )}

          {/* Hover katmanı */}
          {isHovered && (
            <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,1)']} style={styles.hoverOverlay}>
              <View style={styles.playIconContainer}>
                <PlayCircle color="#ffffff" size={46} strokeWidth={1.5} style={styles.playIcon} />
              </View>
              <View style={styles.hoverContent}>
                <View style={styles.hoverContentLeft}>
                  <Text style={styles.showTitle} numberOfLines={1}>{data.showName}</Text>
                  <Text style={styles.episodeTitle} numberOfLines={1}>
                    {episodeCode ? `${episodeCode} · ${data.title}` : data.title}
                  </Text>
                </View>
                {!data.isCalculating && (
                  <View style={styles.hoverContentRight}>
                    <EpisodeCheckButton
                      traktId={data.id}
                      season={data.season}
                      episode={data.episode}
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

export default ShowTrackCardWeb;

const styles = StyleSheet.create({
  container: {
    marginRight: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  card: {
    width: 180,
    height: 270,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
    ...({ cursor: 'pointer', transition: 'box-shadow 0.3s ease' } as any),
  },
  cardHovered: {
    ...({ boxShadow: '0 10px 25px rgba(0,0,0,0.6)' } as any),
    zIndex: 10,
  },
  posterImage: { width: '100%', height: '100%' },
  cardBitti: { borderWidth: 1, borderColor: BITIS_RENK.kenar, ...({ cursor: 'default' } as any) },
  bitisPaneli: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: 'rgba(21, 36, 58, 0.94)',
    borderTopWidth: 1,
    borderTopColor: BITIS_RENK.kenar,
  },
  menuOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 15,
  },
  episodePill: {
    position: 'absolute',
    bottom: 10,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  episodePillText: {
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 14,
  },
  playIconContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playIcon: { opacity: 0.9, ...({ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))' } as any) },
  hoverContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
  },
  hoverContentLeft: { flex: 1, paddingRight: 8 },
  hoverContentRight: { justifyContent: 'center', alignItems: 'center', paddingBottom: 2 },
  showTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  episodeTitle: { color: '#cbd5e1', fontSize: 11, fontWeight: '500' },
});

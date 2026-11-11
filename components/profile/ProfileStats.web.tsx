import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Tv, Film, ChevronRight } from '../icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useResponsive } from '../../hooks/useResponsive';
import { useLibrarySelector } from '../../context/LibraryContext';
import { formatWatchDuration } from '../../utils/watchTimeHelper';
import ProfileStatsMobile from './ProfileStatsMobile';
import { gosterilecekIstatistik, yerelIstatistik } from '../../utils/yerelIstatistik';
import { MOBILE_PALETTE } from '../../constants/mobilePalette';

/**
 * Masaüstü (Web) için çerçevesiz (borderless) mikro-şerit istatistik bileşeni.
 *
 * Özet/Aktiviteler sekmeleriyle tam ortalanmış 3 dengeli kolon yapısı:
 * Sol: Diziler | Orta: Filmler | Sağ: Detaylı Analiz >
 */
const ProfileStatsWeb = () => {
  const { t } = useTranslation('media');
  const { isDesktop } = useResponsive();
  const router = useRouter();
  // §C17.2 — mobil sürümle AYNI düzeltme: `s.userStats` Trakt'ın
  // `/users/me/stats` ucundan geliyor ve Google hesabında hep `null`.
  // Yalnızca mobili düzeltmek, web'de aynı hatayı bırakmak olurdu.
  const { userStats: sunucuStats, watchedShows, watchedMovies, showProgressMap } =
    useLibrarySelector((s) => ({
      userStats: s.userStats,
      watchedShows: s.watchedShows,
      watchedMovies: s.watchedMovies,
      showProgressMap: s.showProgressMap,
    }));

  const userStats = useMemo(
    () => gosterilecekIstatistik(sunucuStats, yerelIstatistik(watchedShows, watchedMovies, showProgressMap)),
    [sunucuStats, watchedShows, watchedMovies, showProgressMap],
  );

  const showsDuration = useMemo(() => {
    if (!userStats?.episodes) return null;
    return formatWatchDuration(userStats.episodes.minutes, {
      month: t('unitMonth', 'Ay'),
      day: t('unitDay', 'Gün'),
      hour: t('unitHour', 'Saat'),
      minute: t('unitMinute', 'Dk'),
    });
  }, [userStats, t]);

  const moviesDuration = useMemo(() => {
    if (!userStats?.movies) return null;
    return formatWatchDuration(userStats.movies.minutes, {
      month: t('unitMonth', 'Ay'),
      day: t('unitDay', 'Gün'),
      hour: t('unitHour', 'Saat'),
      minute: t('unitMinute', 'Dk'),
    });
  }, [userStats, t]);

  if (!isDesktop) return <ProfileStatsMobile />;
  if (!userStats) return null;

  const showsCount = userStats.episodes?.watched?.toLocaleString?.() ?? userStats.episodes?.watched ?? 0;
  const moviesCount = userStats.movies?.watched?.toLocaleString?.() ?? userStats.movies?.watched ?? 0;

  return (
    <View style={styles.outerWrap}>
      <Pressable
        onPress={() => router.push('/(protected)/profile/statistics')}
        style={({ pressed }) => [styles.stripContainer, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {/* Sol Blok: Diziler */}
        <View style={styles.block}>
          <View style={styles.headerRow}>
            <View style={styles.iconChip}>
              <Tv size={13} color={MOBILE_PALETTE.steel} />
            </View>
            <Text style={styles.blockTitle} numberOfLines={1}>
              {t('statsShowsTab', 'Diziler')}
            </Text>
          </View>

          <Text style={styles.statValueText} numberOfLines={1}>
            {showsDuration || '0'}
          </Text>
          <Text style={styles.statSubText} numberOfLines={1}>
            {showsCount} {t('episodesWatchedCount', 'İzlenen Bölüm')}
          </Text>
        </View>

        <View style={styles.verticalDivider} />

        {/* Orta Blok: Filmler (Tam Sayfa Ortasında) */}
        <View style={styles.block}>
          <View style={styles.headerRow}>
            <View style={styles.iconChip}>
              <Film size={13} color={MOBILE_PALETTE.steel} />
            </View>
            <Text style={styles.blockTitle} numberOfLines={1}>
              {t('statsMoviesTab', 'Filmler')}
            </Text>
          </View>

          <Text style={styles.statValueText} numberOfLines={1}>
            {moviesDuration || '0'}
          </Text>
          <Text style={styles.statSubText} numberOfLines={1}>
            {moviesCount} {t('moviesWatchedCount', 'İzlenen Film')}
          </Text>
        </View>

        <View style={styles.verticalDivider} />

        {/* Sağ Blok: Detaylı Analiz Bağlantısı */}
        <View style={styles.actionBlock}>
          <View style={styles.actionPill}>
            <Text style={styles.actionText}>{t('detailedAnalysis', 'Detaylı Analiz')}</Text>
            <ChevronRight size={14} color={MOBILE_PALETTE.steel} />
          </View>
        </View>
      </Pressable>
    </View>
  );
};

export default ProfileStatsWeb;

const styles = StyleSheet.create({
  outerWrap: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    marginBottom: 24,
  },
  stripContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MOBILE_PALETTE.surface,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: MOBILE_PALETTE.border,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.2s ease' } as any) : null),
  },
  pressed: {
    opacity: 0.75,
    backgroundColor: MOBILE_PALETTE.raised,
  },
  block: {
    flex: 1,
    gap: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 2,
  },
  iconChip: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: MOBILE_PALETTE.steelTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: MOBILE_PALETTE.muted,
    letterSpacing: 0.3,
  },
  statValueText: {
    fontSize: 17,
    fontWeight: '800',
    color: MOBILE_PALETTE.text,
    letterSpacing: -0.4,
  },
  statSubText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: MOBILE_PALETTE.mutedDeep,
  },
  verticalDivider: {
    width: 1,
    height: 42,
    backgroundColor: MOBILE_PALETTE.border,
    marginHorizontal: 16,
  },
  actionBlock: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: MOBILE_PALETTE.steelTint,
    borderWidth: 1,
    borderColor: MOBILE_PALETTE.navBorder,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: MOBILE_PALETTE.steel,
  },
});

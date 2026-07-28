import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Tv, Film, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useResponsive } from '../../hooks/useResponsive';
import { useLibrarySelector } from '../../context/LibraryContext';
import { formatWatchDuration } from '../../utils/watchTimeHelper';
import ProfileStatsMobile from './ProfileStatsMobile';

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
  const userStats = useLibrarySelector((s) => s.userStats);

  const showsDuration = useMemo(() => {
    if (!userStats?.episodes) return null;
    return formatWatchDuration(userStats.episodes.minutes, {
      month: t('unitMonth', 'Ay'),
      day: t('unitDay', 'Gün'),
      hour: t('unitHour', 'Saat'),
    });
  }, [userStats, t]);

  const moviesDuration = useMemo(() => {
    if (!userStats?.movies) return null;
    return formatWatchDuration(userStats.movies.minutes, {
      month: t('unitMonth', 'Ay'),
      day: t('unitDay', 'Gün'),
      hour: t('unitHour', 'Saat'),
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
              <Tv size={13} color="#60a5fa" />
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
              <Film size={13} color="#60a5fa" />
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
            <ChevronRight size={14} color="#60a5fa" />
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.2s ease' } as any) : null),
  },
  pressed: {
    opacity: 0.75,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  statValueText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  statSubText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748b',
  },
  verticalDivider: {
    width: 1,
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
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
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.15)',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60a5fa',
  },
});

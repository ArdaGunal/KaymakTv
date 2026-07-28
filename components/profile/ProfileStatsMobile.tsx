import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Tv, Film, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useLibrarySelector } from '../../context/LibraryContext';
import { formatWatchDuration } from '../../utils/watchTimeHelper';
import { SECTION_PADDING_H } from './profileMetrics';

/**
 * Profilin en üstündeki borderless (çerçevesiz) mikro-şerit istatistik bileşeni.
 *
 * Sekme (toggle) mantığı ve ağır kart kutusu tamamen kaldırıldı.
 * Diziler ve Filmler süre/adet bilgileri yan yana 2 zarif mikro-blok halinde sunulur.
 */
const ProfileStats = () => {
  const { t } = useTranslation('media');
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

  if (!userStats) return null;

  const showsCount = userStats.episodes?.watched?.toLocaleString?.() ?? userStats.episodes?.watched ?? 0;
  const moviesCount = userStats.movies?.watched?.toLocaleString?.() ?? userStats.movies?.watched ?? 0;

  return (
    <Pressable
      onPress={() => router.push('/(protected)/profile/statistics')}
      style={({ pressed }) => [styles.stripContainer, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      {/* Sol Blok: Diziler */}
      <View style={styles.block}>
        <View style={styles.headerRow}>
          <View style={styles.iconChip}>
            <Tv size={12} color="#60a5fa" />
          </View>
          <Text style={styles.blockTitle} numberOfLines={1}>
            {t('statsShowsTab', 'Diziler')}
          </Text>
        </View>

        <Text style={styles.statValueText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {showsDuration || '0'}
        </Text>
        <Text style={styles.statSubText} numberOfLines={1}>
          {showsCount} {t('episodesWatchedCount', 'İzlenen Bölüm')}
        </Text>
      </View>

      <View style={styles.verticalDivider} />

      {/* Sağ Blok: Filmler */}
      <View style={styles.block}>
        <View style={styles.headerRow}>
          <View style={styles.iconChip}>
            <Film size={12} color="#60a5fa" />
          </View>
          <Text style={styles.blockTitle} numberOfLines={1}>
            {t('statsMoviesTab', 'Filmler')}
          </Text>
        </View>

        <Text style={styles.statValueText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {moviesDuration || '0'}
        </Text>
        <Text style={styles.statSubText} numberOfLines={1}>
          {moviesCount} {t('moviesWatchedCount', 'İzlenen Film')}
        </Text>
      </View>

      <View style={styles.chevronWrap}>
        <ChevronRight size={16} color="#64748b" />
      </View>
    </Pressable>
  );
};

export default ProfileStats;

const styles = StyleSheet.create({
  stripContainer: {
    marginHorizontal: SECTION_PADDING_H,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  pressed: {
    opacity: 0.7,
  },
  block: {
    flex: 1,
    gap: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 1,
  },
  iconChip: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  statValueText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  statSubText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  verticalDivider: {
    width: 1,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginHorizontal: 10,
  },
  chevronWrap: {
    marginLeft: 4,
    justifyContent: 'center',
  },
});

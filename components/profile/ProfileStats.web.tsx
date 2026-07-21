import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Tv, Film, ChevronRight, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useResponsive } from '../../hooks/useResponsive';
import { useLibrarySelector } from '../../context/LibraryContext';
import { formatWatchDuration } from '../../utils/watchTimeHelper';
import ProfileStatsMobile from './ProfileStatsMobile';

type StatsTab = 'shows' | 'movies';

// Geniş ekran (masaüstü) kartı: dikey yığın yerine yatay bir düzen. Dar
// ekranlarda (mobil web) bu bileşen Metro'nun platform-uzantı kuralı yüzünden
// yine de yüklenir; bu durumda görsel bütünlük için mobil kartı (ProfileStatsMobile)
// olduğu gibi devreder — bkz. EpisodeCard.web.tsx'teki aynı desen.
const ProfileStatsWeb = () => {
  const { t } = useTranslation('media');
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const userStats = useLibrarySelector((s) => s.userStats);
  const [activeTab, setActiveTab] = useState<StatsTab>('shows');

  const categoryStats = useMemo(() => {
    if (!userStats) return null;
    return activeTab === 'shows' ? userStats.episodes : userStats.movies;
  }, [userStats, activeTab]);

  const formattedDuration = useMemo(() => {
    if (!categoryStats) return null;
    return formatWatchDuration(categoryStats.minutes, {
      month: t('unitMonth', 'Ay'),
      day: t('unitDay', 'Gün'),
      hour: t('unitHour', 'Saat'),
    });
  }, [categoryStats, t]);

  if (!isDesktop) return <ProfileStatsMobile />;
  if (!userStats || !categoryStats) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.topRow}>
          <View style={styles.tabsContainer}>
            <Pressable
              onPress={() => setActiveTab('shows')}
              style={[styles.tab, activeTab === 'shows' && styles.tabActive]}
            >
              <Tv size={13} color={activeTab === 'shows' ? '#2563EB' : '#94a3b8'} />
              <Text style={[styles.tabText, activeTab === 'shows' && styles.tabTextActive]}>
                {t('statsShowsTab', 'Diziler')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('movies')}
              style={[styles.tab, activeTab === 'movies' && styles.tabActive]}
            >
              <Film size={13} color={activeTab === 'movies' ? '#2563EB' : '#94a3b8'} />
              <Text style={[styles.tabText, activeTab === 'movies' && styles.tabTextActive]}>
                {t('statsMoviesTab', 'Filmler')}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push('/(protected)/profile/statistics')}
            style={({ pressed }) => [styles.analysisLink, pressed && styles.analysisLinkPressed]}
          >
            <Text style={styles.analysisLinkText}>{t('detailedAnalysisCta', "Detaylı Analiz'e Git")}</Text>
            <ChevronRight size={15} color="#60a5fa" />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBlock, styles.statBlockPrimary]}>
            <View style={styles.statHeader}>
              <Clock size={13} color="#60a5fa" />
              <Text style={styles.statLabel}>{t('totalWatchTime', 'Toplam İzleme Süresi')}</Text>
            </View>
            <Text style={styles.statValuePrimary} numberOfLines={1} adjustsFontSizeToFit>
              {formattedDuration}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statBlock}>
            <View style={styles.statHeader}>
              <Tv size={13} color="#a78bfa" />
              <Text style={styles.statLabel}>{t('episodesWatchedCount', 'İzlenen Bölüm')}</Text>
            </View>
            <Text style={styles.statValue}>{(userStats.episodes.watched || 0).toLocaleString()}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statBlock}>
            <View style={styles.statHeader}>
              <Film size={13} color="#fbbf24" />
              <Text style={styles.statLabel}>{t('moviesWatchedCount', 'İzlenen Film')}</Text>
            </View>
            <Text style={styles.statValue}>{(userStats.movies.watched || 0).toLocaleString()}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

export default ProfileStatsWeb;

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    ...({ cursor: 'pointer' } as any),
  },
  tabActive: {
    backgroundColor: 'rgba(37,99,235,0.14)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  analysisLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(96,165,250,0.08)',
    ...({ cursor: 'pointer', transition: 'background-color 0.2s ease' } as any),
  },
  analysisLinkPressed: {
    backgroundColor: 'rgba(96,165,250,0.18)',
  },
  analysisLinkText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  statBlockPrimary: {
    flex: 1.4,
    paddingLeft: 0,
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  statValuePrimary: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  statValue: {
    color: '#f1f5f9',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
});

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Tv, Film, ChevronRight, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useLibrarySelector } from '../../context/LibraryContext';
import { formatWatchDuration } from '../../utils/watchTimeHelper';

type StatsTab = 'shows' | 'movies';

const ProfileStats = () => {
  const { t } = useTranslation('media');
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

  if (!userStats || !categoryStats) return null;

  const watchedCountLabel = activeTab === 'shows' ? t('episodesWatchedCount', 'İzlenen Bölüm') : t('moviesWatchedCount', 'İzlenen Film');

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => router.push('/(protected)/profile/statistics')}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Apple tarzı minimal sekmeler: incecik, zarif, seçilmeyen sadece metin */}
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

          {/* Ferah ve dengeli içerik alanı */}
          <View style={styles.content}>
            {/* Başlık + İkon */}
            <View style={styles.header}>
              <View style={styles.iconBadge}>
                <Clock size={14} color="#60a5fa" />
              </View>
              <Text style={styles.headerText}>
                {t('totalWatchTime', 'Toplam İzleme Süresi')}
              </Text>
            </View>

            {/* Devasa, vurucu değer - asıl odak noktası */}
            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
              {formattedDuration}
            </Text>

            {/* Zarif istatistik satırı - alt bölüm, üstten hafif ayrılmış */}
            <View style={styles.statRow}>
              <View style={styles.statDot} />
              <Text style={styles.statText}>
                <Text style={styles.statNumber}>
                  {categoryStats.watched?.toLocaleString?.() ?? categoryStats.watched}
                </Text>
                {' '}
                <Text style={styles.statLabel}>
                  {watchedCountLabel}
                </Text>
              </Text>
              <ChevronRight size={16} color="rgba(96,165,250,0.6)" />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
};

export default ProfileStats;

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.9,
  },
  gradient: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
    letterSpacing: -0.2,
  },
  tabTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  content: {
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#cbd5e1',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  heroValue: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  statDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#60a5fa',
  },
  statText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  statNumber: {
    fontWeight: '700',
    color: '#f1f5f9',
  },
  statLabel: {
    fontWeight: '500',
    color: '#94a3b8',
  },
});

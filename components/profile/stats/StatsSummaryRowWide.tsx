import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, Tv, Film } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { formatWatchDuration } from '../../../utils/watchTimeHelper';
import type { ProfileStatsSummary } from '../../../hooks/useProfileStatistics';

interface StatsSummaryRowWideProps {
  summary: ProfileStatsSummary;
}

// Masaüstü özet satırı: mobildeki dar kartların büyütülmüş hali değil, ayrı
// bir bileşen — geniş ekranda nefes alan padding ve daha büyük tipografi ile.
const StatsSummaryRowWide = ({ summary }: StatsSummaryRowWideProps) => {
  const { t } = useTranslation('media');

  const totalWatchTime = formatWatchDuration(summary.totalMinutes, {
    month: t('unitMonth', 'Ay'),
    day: t('unitDay', 'Gün'),
    hour: t('unitHour', 'Saat'),
  });

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <View style={[styles.iconBadge, { backgroundColor: 'rgba(96,165,250,0.14)' }]}>
          <Clock size={18} color="#60a5fa" />
        </View>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{totalWatchTime}</Text>
        <Text style={styles.label}>{t('totalWatchTime', 'Toplam İzleme Süresi')}</Text>
      </View>

      <View style={styles.card}>
        <View style={[styles.iconBadge, { backgroundColor: 'rgba(139,92,246,0.14)' }]}>
          <Tv size={18} color="#a78bfa" />
        </View>
        <Text style={styles.value}>{summary.episodesWatched.toLocaleString()}</Text>
        <Text style={styles.label}>{t('episodesWatchedCount', 'İzlenen Bölüm')}</Text>
      </View>

      <View style={styles.card}>
        <View style={[styles.iconBadge, { backgroundColor: 'rgba(245,158,11,0.14)' }]}>
          <Film size={18} color="#fbbf24" />
        </View>
        <Text style={styles.value}>{summary.moviesWatched.toLocaleString()}</Text>
        <Text style={styles.label}>{t('moviesWatchedCount', 'İzlenen Film')}</Text>
      </View>
    </View>
  );
};

export default StatsSummaryRowWide;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 22,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  value: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
});

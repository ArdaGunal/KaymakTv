import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, Tv, Film } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { formatWatchDuration } from '../../../utils/watchTimeHelper';
import type { ProfileStatsSummary } from '../../../hooks/useProfileStatistics';

interface StatsSummaryRowProps {
  summary: ProfileStatsSummary;
}

const StatsSummaryRow = ({ summary }: StatsSummaryRowProps) => {
  const { t } = useTranslation('media');

  const totalWatchTime = formatWatchDuration(summary.totalMinutes, {
    month: t('unitMonth', 'Ay'),
    day: t('unitDay', 'Gün'),
    hour: t('unitHour', 'Saat'),
  });

  return (
    <View style={styles.row}>
      <View style={[styles.card, styles.cardWide]}>
        <View style={[styles.iconBadge, { backgroundColor: 'rgba(96,165,250,0.14)' }]}>
          <Clock size={14} color="#60a5fa" />
        </View>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{totalWatchTime}</Text>
        <Text style={styles.label}>{t('totalWatchTime', 'Toplam İzleme Süresi')}</Text>
      </View>

      <View style={styles.card}>
        <View style={[styles.iconBadge, { backgroundColor: 'rgba(139,92,246,0.14)' }]}>
          <Tv size={14} color="#a78bfa" />
        </View>
        <Text style={styles.value}>{summary.episodesWatched.toLocaleString()}</Text>
        <Text style={styles.label}>{t('episodesWatchedCount', 'İzlenen Bölüm')}</Text>
      </View>

      <View style={styles.card}>
        <View style={[styles.iconBadge, { backgroundColor: 'rgba(245,158,11,0.14)' }]}>
          <Film size={14} color="#fbbf24" />
        </View>
        <Text style={styles.value}>{summary.moviesWatched.toLocaleString()}</Text>
        <Text style={styles.label}>{t('moviesWatchedCount', 'İzlenen Film')}</Text>
      </View>
    </View>
  );
};

export default StatsSummaryRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 12,
  },
  cardWide: {
    flex: 1.3,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  value: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  label: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
});

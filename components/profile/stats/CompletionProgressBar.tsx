import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { ProfileStatsCompletion, StatsTab } from '../../../hooks/useProfileStatistics';

interface CompletionProgressBarProps {
  completion: ProfileStatsCompletion;
  activeTab: StatsTab;
}

const CompletionProgressBar = ({ completion, activeTab }: CompletionProgressBarProps) => {
  const { t } = useTranslation('media');
  const { started, finished } = completion;

  const ratio = useMemo(() => (started > 0 ? Math.min(finished / started, 1) : 0), [started, finished]);

  const description = activeTab === 'shows'
    ? t('completionShows', 'Başlanan {{started}} dizinin {{finished}} tanesi bitti', { started, finished })
    : t('completionMovies', 'İzleme listesindeki {{started}} filmin {{finished}} tanesi izlendi', { started, finished });

  if (started === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('completionRate', 'Tamamlanma Oranı')}</Text>
        <Text style={styles.percent}>%{Math.round(ratio * 100)}</Text>
      </View>

      <View style={styles.track}>
        <LinearGradient
          colors={['#3B82F6', '#60A5FA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${Math.max(ratio * 100, 4)}%` }]}
        />
      </View>

      <Text style={styles.description}>{description}</Text>
    </View>
  );
};

export default CompletionProgressBar;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  percent: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '800',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  description: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
});

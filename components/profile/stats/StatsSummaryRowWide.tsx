import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Clock, Tv, Film } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { formatWatchDuration } from '../../../utils/watchTimeHelper';
import type { ProfileStatsSummary, StatsTab } from '../../../hooks/useProfileStatistics';

interface StatsSummaryRowWideProps {
  summary: ProfileStatsSummary;
  activeTab: StatsTab;
}

// Masaüstü özet satırı: mobildeki dar kartların büyütülmüş hali değil, ayrı
// bir bileşen — geniş ekranda nefes alan padding ve daha büyük tipografi ile.
//
// ESKİ HATA: aktif sekmeden bağımsız olarak hem "İzlenen Bölüm" hem "İzlenen
// Film" kutusu birlikte gösteriliyordu (bkz. mobil sürümdeki aynı düzeltme).
// İkinci kutu artık aktif sekmeye göre değişiyor.
const StatsSummaryRowWide = ({ summary, activeTab }: StatsSummaryRowWideProps) => {
  const { t } = useTranslation('media');
  const router = useRouter();

  const totalWatchTime = formatWatchDuration(summary.totalMinutes, {
    month: t('unitMonth', 'Ay'),
    day: t('unitDay', 'Gün'),
    hour: t('unitHour', 'Saat'),
  });

  const isShows = activeTab === 'shows';
  const CountIcon = isShows ? Tv : Film;
  const countLabel = isShows
    ? t('episodesWatchedCount', 'İzlenen Bölüm')
    : t('moviesWatchedCount', 'İzlenen Film');
  const countRoute = isShows ? '/(protected)/library/shows' : '/(protected)/library/movies';
  const countIconColor = isShows ? '#a78bfa' : '#fbbf24';
  const countIconBg = isShows ? 'rgba(139,92,246,0.14)' : 'rgba(245,158,11,0.14)';

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <View style={[styles.iconBadge, { backgroundColor: 'rgba(96,165,250,0.14)' }]}>
          <Clock size={18} color="#60a5fa" />
        </View>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{totalWatchTime}</Text>
        <Text style={styles.label}>{t('totalWatchTime', 'Toplam İzleme Süresi')}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.card, styles.cardTappable, pressed && styles.cardPressed]}
        onPress={() => router.push(countRoute)}
        accessibilityRole="button"
      >
        <View style={[styles.iconBadge, { backgroundColor: countIconBg }]}>
          <CountIcon size={18} color={countIconColor} />
        </View>
        <Text style={styles.value}>{summary.watchedCount.toLocaleString()}</Text>
        <Text style={styles.label}>{countLabel}</Text>
      </Pressable>
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
  cardTappable: {
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  cardPressed: {
    opacity: 0.7,
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

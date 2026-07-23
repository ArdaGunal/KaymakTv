import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Clock, Tv, Film } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { formatWatchDuration } from '../../../utils/watchTimeHelper';
import type { ProfileStatsSummary, StatsTab } from '../../../hooks/useProfileStatistics';

interface StatsSummaryRowProps {
  summary: ProfileStatsSummary;
  activeTab: StatsTab;
}

/**
 * Üstteki özet kutuları — Diziler sekmesindeyken YALNIZCA dizi verisini,
 * Filmler sekmesindeyken YALNIZCA film verisini gösterir.
 *
 * ESKİ HATA: bu satır her zaman "İzlenen Bölüm" VE "İzlenen Film" kutularını
 * birlikte, `activeTab`'dan bağımsız olarak gösteriyordu — kullanıcı Filmler
 * sekmesine geçse bile üstteki süre ve sayı hâlâ dizi verisiydi (ya da ikisinin
 * toplamıydı). Sekmelerin işlevi yoktu. Artık ikinci kutunun ikonu, etiketi ve
 * gittiği kütüphane sayfası aktif sekmeye göre değişiyor; süre de yalnızca o
 * sekmenin süresi (`summary.totalMinutes` hook'ta zaten sekmeye göre hesaplanıyor).
 */
const StatsSummaryRow = ({ summary, activeTab }: StatsSummaryRowProps) => {
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
      <View style={[styles.card, styles.cardWide]}>
        <View style={[styles.iconBadge, { backgroundColor: 'rgba(96,165,250,0.14)' }]}>
          <Clock size={14} color="#60a5fa" />
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
          <CountIcon size={14} color={countIconColor} />
        </View>
        <Text style={styles.value}>{summary.watchedCount.toLocaleString()}</Text>
        <Text style={styles.label}>{countLabel}</Text>
      </Pressable>
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
  cardTappable: {
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  cardPressed: {
    opacity: 0.6,
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

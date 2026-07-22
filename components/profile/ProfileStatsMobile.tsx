import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Tv, Film, ChevronRight, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useLibrarySelector } from '../../context/LibraryContext';
import { formatWatchDuration } from '../../utils/watchTimeHelper';
import { SECTION_PADDING_H } from './profileMetrics';

type StatsTab = 'shows' | 'movies';

/**
 * Profilin en üstündeki özet kartı.
 *
 * Eski tasarımda süre 44px'lik dev bir rakamla TEK BAŞINA bir satırda duruyor,
 * altında ayrı bir istatistik satırı daha vardı; kart ekranın üçte birini
 * kaplıyor ve altındaki şeritleri aşağı itiyordu. Yeni düzen aynı bilgiyi
 * koruyor ama süre ile izlenen sayısını TEK satırda, ince bir ayraçla yan yana
 * veriyor — kart belirgin biçimde alçaldı, bilgi yoğunluğu arttı.
 */
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

  const watchedCountLabel = activeTab === 'shows'
    ? t('episodesWatchedCount', 'İzlenen Bölüm')
    : t('moviesWatchedCount', 'İzlenen Film');

  const watchedCount = categoryStats.watched?.toLocaleString?.() ?? categoryStats.watched;

  return (
    // Kart BÜTÜN olarak tıklanabilir DEĞİL: sekmeler onun içinde yer aldığı için
    // bir sekmeye dokunmak hem sekmeyi değiştiriyor hem de (dokunuş dışa
    // sızdığından) istatistik sayfasına götürüyordu. Artık yalnızca aşağıdaki
    // değer satırı — yanındaki ok işaretinin zaten işaret ettiği yer — gezinir.
    <View style={styles.card}>
      <LinearGradient
        colors={['rgba(37,99,235,0.18)', 'rgba(30,41,59,0.45)', 'rgba(15,23,42,0.75)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Kompakt segment kontrolü */}
        <View style={styles.tabs}>
          {(['shows', 'movies'] as StatsTab[]).map((tab) => {
            const isActive = activeTab === tab;
            const Icon = tab === 'shows' ? Tv : Film;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tab, isActive && styles.tabActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Icon size={13} color={isActive ? '#ffffff' : '#94a3b8'} />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab === 'shows' ? t('statsShowsTab', 'Diziler') : t('statsMoviesTab', 'Filmler')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.labelRow}>
          <View style={styles.labelBadge}>
            <Clock size={11} color="#60a5fa" />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {t('totalWatchTime', 'Toplam İzleme Süresi')}
          </Text>
        </View>

        {/* Süre ve izlenen sayısı yan yana — ayraç ikisini görsel olarak ayırır. */}
        <Pressable
          onPress={() => router.push('/(protected)/profile/statistics')}
          style={({ pressed }) => [styles.valueRow, pressed && styles.valueRowPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.duration} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {formattedDuration}
          </Text>

          <View style={styles.divider} />

          <View style={styles.countBlock}>
            <Text style={styles.countValue} numberOfLines={1}>{watchedCount}</Text>
            <Text style={styles.countLabel} numberOfLines={1}>{watchedCountLabel}</Text>
          </View>

          <ChevronRight size={18} color="rgba(148,163,184,0.7)" />
        </Pressable>
      </LinearGradient>
    </View>
  );
};

export default ProfileStats;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SECTION_PADDING_H,
    marginBottom: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  valueRowPressed: {
    opacity: 0.65,
  },
  gradient: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15,23,42,0.45)',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  labelBadge: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(96,165,250,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `textTransform: 'uppercase'` BİLİNÇLİ OLARAK kullanılmıyor: CSS/RN büyütmesi
  // locale duyarsızdır ve Türkçe'de "i" harfini "İ" değil "I" yapar — etiket
  // ekranda "TOPLAM İZLEME SÜRESI" diye yanlış çıkıyordu. Vurguyu bunun yerine
  // harf aralığı ve renk sağlıyor.
  label: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  duration: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.8,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    minHeight: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  countBlock: {
    flexShrink: 1,
  },
  countValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 1,
  },
});

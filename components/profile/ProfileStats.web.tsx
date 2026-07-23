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

/**
 * Geniş ekran (masaüstü) özet kartı — mobildeki kompakt karta (`ProfileStatsMobile`)
 * YAKINLAŞTIRILDI, birebir kopyası değil: aynı "süre + sayı tek satırda, ince
 * bir ayraçla yan yana" iskeleti kullanır ama masaüstüne uygun büyüklükte
 * (daha geniş dolgu, daha büyük tipografi) ve ekstra olarak sağ üstte her zaman
 * görünen "Detaylı Analiz'e Git" bağlantısını korur — masaüstü kullanıcısı
 * dokunma keşfine değil görünür bağlantılara alışkın.
 *
 * ESKİ HATA (bulundu ve düzeltildi): bu bileşen kendi verisini `useLibrarySelector`
 * üzerinden AYRI hesaplıyordu ve yalnızca süre `activeTab`'a göre değişiyordu —
 * "İzlenen Bölüm" ile "İzlenen Film" sayıları sekmeden BAĞIMSIZ olarak HER ZAMAN
 * birlikte gösteriliyordu (Detaylı Analiz sayfasında Madde 70'te düzeltilen
 * hatanın birebir aynısı, ama bu dosya o düzeltmeyi hiç görmemişti çünkü ayrı
 * bir kod yolu). Artık mobildeki gibi TEK sayı, aktif sekmeye göre değişiyor.
 *
 * Dar ekranlarda (mobil web) bu bileşen Metro'nun platform-uzantı kuralı yüzünden
 * yine de yüklenir; bu durumda görsel bütünlük için mobil kartı (ProfileStatsMobile)
 * olduğu gibi devreder — bkz. EpisodeCard.web.tsx'teki aynı desen.
 */
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

  const watchedCountLabel = activeTab === 'shows'
    ? t('episodesWatchedCount', 'İzlenen Bölüm')
    : t('moviesWatchedCount', 'İzlenen Film');

  const watchedCount = categoryStats.watched?.toLocaleString?.() ?? categoryStats.watched;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(37,99,235,0.16)', 'rgba(30,41,59,0.4)', 'rgba(15,23,42,0.72)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.topRow}>
          <View style={styles.tabsContainer}>
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
                  <Icon size={14} color={isActive ? '#ffffff' : '#94a3b8'} />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab === 'shows' ? t('statsShowsTab', 'Diziler') : t('statsMoviesTab', 'Filmler')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => router.push('/(protected)/profile/statistics')}
            style={({ pressed }) => [styles.analysisLink, pressed && styles.analysisLinkPressed]}
          >
            <Text style={styles.analysisLinkText}>{t('detailedAnalysisCta', "Detaylı Analiz'e Git")}</Text>
            <ChevronRight size={15} color="#60a5fa" />
          </Pressable>
        </View>

        <View style={styles.labelRow}>
          <View style={styles.labelBadge}>
            <Clock size={13} color="#60a5fa" />
          </View>
          <Text style={styles.label}>{t('totalWatchTime', 'Toplam İzleme Süresi')}</Text>
        </View>

        {/* Süre ve izlenen sayısı TEK satırda — mobil karttaki aynı iskelet,
            masaüstü ölçeğinde. Tüm satır tıklanabilir (mobildeki gibi Detaylı
            Analiz'e götürür); ayrıca yukarıda her zaman görünen bir metin
            bağlantısı da var, masaüstü kullanıcısı ikisinden birini kullanabilir. */}
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
        </Pressable>
      </LinearGradient>
    </View>
  );
};

export default ProfileStatsWeb;

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
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
    marginBottom: 22,
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  labelBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(96,165,250,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `textTransform: 'uppercase'` BİLİNÇLİ OLARAK kullanılmıyor — bkz.
  // ProfileStatsMobile.tsx'teki aynı not: Türkçe'de "i" harfini "İ" değil "I"
  // yapıyor ("TOPLAM İZLEME SÜRESI" hatasına yol açar).
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    ...({ cursor: 'pointer' } as any),
  },
  valueRowPressed: {
    opacity: 0.75,
  },
  duration: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    minHeight: 44,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  countBlock: {},
  countValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  countLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 2,
  },
});

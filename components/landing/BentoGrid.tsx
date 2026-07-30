import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, BarChart2, ListVideo, Film, CheckCircle2 } from 'lucide-react-native';

const MOBILE_BREAKPOINT = 768;

const features = [
  {
    title: 'featureStats',
    description: 'featureStatsDesc',
    iconColor: '#fbbf24',
    Icon: BarChart2,
    accent: 'rgba(251,191,36,0.12)',
    borderAccent: 'rgba(251,191,36,0.18)',
  },
  {
    title: 'featureLists',
    description: 'featureListsDesc',
    iconColor: '#34d399',
    Icon: ListVideo,
    accent: 'rgba(52,211,153,0.1)',
    borderAccent: 'rgba(52,211,153,0.18)',
  },
  {
    title: 'featureCalendar',
    description: 'featureCalendarDesc',
    iconColor: '#60a5fa',
    Icon: Calendar,
    accent: 'rgba(96,165,250,0.1)',
    borderAccent: 'rgba(96,165,250,0.18)',
  },
  {
    title: 'featureDiscover',
    description: 'featureDiscoverDesc',
    iconColor: '#c084fc',
    Icon: Film,
    accent: 'rgba(192,132,252,0.1)',
    borderAccent: 'rgba(192,132,252,0.18)',
  },
  {
    title: 'featureProgress',
    description: 'featureProgressDesc',
    iconColor: '#f87171',
    Icon: CheckCircle2,
    accent: 'rgba(248,113,113,0.1)',
    borderAccent: 'rgba(248,113,113,0.18)',
  },
];

interface CardProps {
  feature: typeof features[0];
  isDesktop: boolean;
  index: number;
  t: any;
}

const BentoCard = ({ feature, isDesktop, index, t }: CardProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 7,
      tension: 200,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 200,
    }).start();
  };

  // Mobilde: 2 sütunlu grid benzeri yerleşim
  // 0. kart (Stats) tam genişlik, diğerleri 2'li sıra
  const isMobileFull = !isDesktop && index === 0;

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // @ts-ignore web-only
      onHoverIn={handlePressIn}
      onHoverOut={handlePressOut}
      style={[
        styles.cardOuter,
        !isDesktop && (isMobileFull ? styles.cardOuterFullMobile : styles.cardOuterHalfMobile),
        isDesktop && styles.cardOuterDesktop,
      ]}
    >
      <Animated.View style={[styles.cardAnimWrap, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={['rgba(22, 31, 50, 0.9)', 'rgba(11, 17, 32, 0.98)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { borderColor: feature.borderAccent }]}
        >
          {/* İkon + Başlık yatay */}
          <View style={styles.cardTop}>
            <View style={[styles.iconWrap, { backgroundColor: feature.accent }]}>
              <feature.Icon size={18} color={feature.iconColor} strokeWidth={2} />
            </View>
            <Text style={styles.cardTitle}>{t(feature.title)}</Text>
          </View>
          <Text style={styles.cardDesc}>{t(feature.description)}</Text>

          {/* Alt dekorasyon çizgisi */}
          <View style={[styles.cardLine, { backgroundColor: feature.borderAccent }]} />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
};

export default function BentoGrid() {
  const { t } = useTranslation('common');
  const { width } = useWindowDimensions();
  const isDesktop = width >= MOBILE_BREAKPOINT;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      delay: 150,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Bölüm Başlığı */}
      <View style={styles.header}>
        <View style={styles.eyebrow}>
          <Text style={styles.eyebrowText}>ÖZELLİKLER</Text>
        </View>
        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
          {t('landingWhy', 'Neden ')}<Text style={styles.highlight}>KaymakTV?</Text>
        </Text>
        <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
          {t('landingWhySub')}
        </Text>
      </View>

      {/* Kart Izgarası */}
      <Animated.View
        style={[
          styles.grid,
          isDesktop ? styles.gridDesktop : styles.gridMobile,
          { opacity: fadeAnim },
        ]}
      >
        {features.map((feature, index) => (
          <BentoCard key={index} feature={feature} isDesktop={isDesktop} index={index} t={t} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 56,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
  },
  // ── Başlık ──────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: 32,
    maxWidth: 580,
    paddingHorizontal: 8,
  },
  eyebrow: {
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    marginBottom: 16,
  },
  eyebrowText: {
    color: '#60a5fa',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  titleDesktop: {
    fontSize: 38,
    letterSpacing: -1,
  },
  highlight: {
    color: '#60a5fa',
  },
  subtitle: {
    fontSize: 14.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  subtitleDesktop: {
    fontSize: 17,
    lineHeight: 26,
    color: '#94a3b8',
  },
  // ── Grid ────────────────────────────────────────────────────────────────
  grid: {
    width: '100%',
    maxWidth: 1000,
  },
  gridMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
  },
  // ── Kart Dış Kaplama ────────────────────────────────────────────────────
  cardOuter: {},
  cardOuterFullMobile: {
    width: '100%',
  },
  cardOuterHalfMobile: {
    // Mobilde 2 sütunlu: boşluklar çıkarılarak yaklaşık %48
    flex: 1,
    minWidth: '45%',
  },
  cardOuterDesktop: {
    flex: 1,
    minWidth: 200,
    maxWidth: 320,
  },
  cardAnimWrap: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 8px 24px -8px rgba(0,0,0,0.45)',
    } as any),
  },
  // ── Kart İçi ────────────────────────────────────────────────────────────
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    color: '#e2e8f0',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
    flexWrap: 'wrap',
  },
  cardDesc: {
    color: '#64748b',
    fontSize: 12.5,
    lineHeight: 19,
  },
  cardLine: {
    position: 'absolute',
    bottom: 0,
    left: 18,
    right: 18,
    height: 1,
  },
});

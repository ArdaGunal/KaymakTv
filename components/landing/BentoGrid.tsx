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
import { Calendar, BarChart2, List, Star, Users, Search } from '../icons';

const MOBILE_BREAKPOINT = 768;

const features = [
  {
    titleKey: 'viewingDiary',
    descKey: 'viewingDiaryDesc',
    Icon: Calendar,
    iconColor: '#5c8cf5',
    accent: 'rgba(92, 140, 245, 0.10)',
    borderAccent: 'rgba(92, 140, 245, 0.14)',
  },
  {
    titleKey: 'fastSearchTitle',
    descKey: 'fastSearchDesc',
    Icon: Search,
    iconColor: '#38bdf8',
    accent: 'rgba(56, 189, 248, 0.08)',
    borderAccent: 'rgba(56, 189, 248, 0.12)',
  },
  {
    titleKey: 'statsPanel',
    descKey: 'statsPanelDesc',
    Icon: BarChart2,
    iconColor: '#fbbf24',
    accent: 'rgba(251,191,36,0.10)',
    borderAccent: 'rgba(251,191,36,0.14)',
  },
  {
    titleKey: 'ratingReview',
    descKey: 'ratingReviewDesc',
    Icon: Star,
    iconColor: '#f87171',
    accent: 'rgba(248,113,113,0.10)',
    borderAccent: 'rgba(248,113,113,0.14)',
  },
  {
    titleKey: 'personalLists',
    descKey: 'personalListsDesc',
    Icon: List,
    iconColor: '#34d399',
    accent: 'rgba(52,211,153,0.10)',
    borderAccent: 'rgba(52,211,153,0.14)',
  },
  {
    titleKey: 'socialFollow',
    descKey: 'socialFollowDesc',
    Icon: Users,
    iconColor: '#c084fc',
    accent: 'rgba(192,132,252,0.10)',
    borderAccent: 'rgba(192,132,252,0.14)',
  },
];

interface CardProps {
  feature: typeof features[0];
  isDesktop: boolean;
  isLastOdd: boolean;
  t: any;
}

const FeatureCard = ({ feature, isDesktop, isLastOdd, t }: CardProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
      tension: 220,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 220,
    }).start();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // @ts-ignore web-only
      onHoverIn={handlePressIn}
      onHoverOut={handlePressOut}
      style={[
        styles.cardOuter,
        isDesktop ? styles.cardDesktop : (isLastOdd ? styles.cardMobileFull : styles.cardMobileHalf),
      ]}
    >
      <Animated.View style={[styles.cardAnimWrap, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.card, { borderColor: feature.borderAccent }]}>
          {/* Subtle accent glow in corner */}
          <View style={[styles.cardCornerGlow, { backgroundColor: feature.accent }]} />

          {/* İkon */}
          <View style={[styles.iconWrap, { backgroundColor: feature.accent }]}>
            <feature.Icon size={20} color={feature.iconColor} strokeWidth={1.8} />
          </View>

          {/* Başlık */}
          <Text style={styles.cardTitle}>{t(feature.titleKey)}</Text>

          {/* Açıklama */}
          <Text style={styles.cardDesc}>{t(feature.descKey)}</Text>
        </View>
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
      delay: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Bölüm Başlığı */}
      <View style={styles.header}>
        <View style={styles.eyebrow}>
          <Text style={styles.eyebrowText}>{t('features', 'NELER YAPABİLİRSİN').toUpperCase()}</Text>
        </View>
        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
          {t('oneApp')}
        </Text>
        <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
          {t('featuresSectionSub')}
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
        {features.map((feature, index) => {
          const isLastOdd = !isDesktop && features.length % 2 !== 0 && index === features.length - 1;
          return (
            <FeatureCard
              key={index}
              feature={feature}
              isDesktop={isDesktop}
              isLastOdd={isLastOdd}
              t={t}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 64,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
  },
  // ── Başlık ──────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: 40,
    maxWidth: 600,
    paddingHorizontal: 8,
  },
  eyebrow: {
    backgroundColor: 'rgba(27, 32, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 18,
  },
  eyebrowText: {
    color: '#7aa2f7',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#dee2f1',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  titleDesktop: {
    fontSize: 36,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14.5,
    color: '#8c90a0',
    textAlign: 'center',
    lineHeight: 22,
  },
  subtitleDesktop: {
    fontSize: 16,
    lineHeight: 25,
    color: '#c2c6d6',
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
  cardMobileHalf: {
    flex: 1,
    minWidth: '45%',
  },
  cardMobileFull: {
    width: '100%',
  },
  cardDesktop: {
    flex: 1,
    minWidth: 200,
    maxWidth: 310,
  },
  cardAnimWrap: {
    flex: 1,
  },
  // ── Kart ────────────────────────────────────────────────────────────────
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(27, 32, 42, 0.7)',
    position: 'relative',
    overflow: 'hidden',
    gap: 10,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 24px -6px rgba(0,0,0,0.5)',
    } as any),
  },
  cardCornerGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.6,
  },
  // ── Kart İçi ────────────────────────────────────────────────────────────
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  cardTitle: {
    color: '#dee2f1',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardDesc: {
    color: '#8c90a0',
    fontSize: 13,
    lineHeight: 20,
  },
});

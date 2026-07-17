import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Animated, useWindowDimensions, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, BarChart2, ListVideo, Film, CheckCircle2 } from 'lucide-react-native';

const MOBILE_BREAKPOINT = 768;
const ICON_COLORS = ['#fbbf24', '#34d399', '#60a5fa', '#e879f9', '#f87171'] as const;

const features = [
  {
    title: 'Kapsamlı İstatistikler',
    description: 'Ne kadar süre dizi/film izlediğinizi detaylı grafiklerle analiz edin.',
    iconColor: ICON_COLORS[0],
    Icon: BarChart2,
    accent: 'rgba(251,191,36,0.15)',
    size: 'large',
  },
  {
    title: 'Özel Listeler',
    description: 'Kendi koleksiyonlarınızı yaratın ve arkadaşlarınızla paylaşın.',
    iconColor: ICON_COLORS[1],
    Icon: ListVideo,
    accent: 'rgba(52,211,153,0.12)',
    size: 'medium',
  },
  {
    title: 'Yayın Takvimi',
    description: 'Favori dizilerinizin yeni bölümlerini asla kaçırmayın.',
    iconColor: ICON_COLORS[2],
    Icon: Calendar,
    accent: 'rgba(96,165,250,0.12)',
    size: 'small',
  },
  {
    title: 'Film & Dizi Keşfi',
    description: 'Size özel öneriler ve trend olan yapımlarla yeni içerikler bulun.',
    iconColor: ICON_COLORS[3],
    Icon: Film,
    accent: 'rgba(232,121,249,0.12)',
    size: 'small',
  },
  {
    title: 'İlerleme Takibi',
    description: 'Hangi bölümde kaldığınızı anında görün.',
    iconColor: ICON_COLORS[4],
    Icon: CheckCircle2,
    accent: 'rgba(248,113,113,0.12)',
    size: 'medium',
  },
];

interface BentoCardProps {
  feature: typeof features[0];
  isDesktop: boolean;
}

const BentoCard = ({ feature, isDesktop }: BentoCardProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 6,
      tension: 200,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 200,
    }).start();
  };

  const cardStyle = [
    styles.cardContainer,
    !isDesktop && styles.cardMobileFixed,
    isDesktop && feature.size === 'large' && styles.cardLarge,
    isDesktop && feature.size === 'medium' && styles.cardMedium,
    isDesktop && feature.size === 'small' && styles.cardSmall,
  ];

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // @ts-ignore web-only hover
      onHoverIn={handlePressIn}
      onHoverOut={handlePressOut}
      style={cardStyle}
    >
      <Animated.View style={[styles.cardAnimWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={['#1e293b', '#0f172a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={[styles.iconContainer, { backgroundColor: feature.accent }]}>
            <feature.Icon size={28} color={feature.iconColor} />
          </View>
          <View style={styles.cardTextBlock}>
            <Text style={styles.cardTitle}>{feature.title}</Text>
            <Text style={styles.cardDesc}>{feature.description}</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
};

export default function BentoGrid() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= MOBILE_BREAKPOINT;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 900,
      delay: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
          Neden <Text style={styles.highlight}>KaymakTV?</Text>
        </Text>
        <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
          İzleme deneyiminizi bir üst seviyeye taşıyacak tüm araçlar elinizin altında.
        </Text>
      </View>

      <Animated.View
        style={[
          styles.grid,
          isDesktop ? styles.gridDesktop : styles.gridMobile,
          { opacity: fadeAnim },
        ]}
      >
        {features.map((feature, index) => (
          <BentoCard key={index} feature={feature} isDesktop={isDesktop} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 72,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    maxWidth: 620,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  titleDesktop: {
    fontSize: 42,
    letterSpacing: -1,
  },
  highlight: {
    color: '#3B82F6',
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
  },
  subtitleDesktop: {
    fontSize: 18,
    lineHeight: 28,
  },
  grid: {
    width: '100%',
    maxWidth: 1100,
  },
  gridMobile: {
    flexDirection: 'column',
    gap: 14,
  },
  gridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
  },
  cardContainer: {
    width: '100%',
  },
  cardMobileFixed: {
    minHeight: 140,
  },
  cardLarge: {
    width: '100%',
    minHeight: 260,
  },
  cardMedium: {
    width: '57%',
    minHeight: 230,
  },
  cardSmall: {
    width: '39%',
    minHeight: 230,
  },
  cardAnimWrapper: {
    flex: 1,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    flex: 1,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 8px 24px -8px rgba(0,0,0,0.55)',
    } as any),
  },
  iconContainer: {
    alignSelf: 'flex-start',
    padding: 12,
    borderRadius: 14,
    marginBottom: 20,
  },
  cardTextBlock: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  cardDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 22,
  },
});

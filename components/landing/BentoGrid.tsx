import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Animated, useWindowDimensions, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, BarChart2, ListVideo, Film, CheckCircle2 } from 'lucide-react-native';

const features = [
  {
    title: 'Kapsamlı İstatistikler',
    description: 'Ne kadar süre dizi/film izlediğinizi detaylı grafiklerle analiz edin.',
    icon: <BarChart2 size={32} color="#fbbf24" />,
    gradient: ['#1e293b', '#0f172a'],
    size: 'large',
  },
  {
    title: 'Özel Listeler',
    description: 'Kendi koleksiyonlarınızı yaratın ve arkadaşlarınızla paylaşın.',
    icon: <ListVideo size={32} color="#34d399" />,
    gradient: ['#1e293b', '#0f172a'],
    size: 'medium',
  },
  {
    title: 'Yayın Takvimi',
    description: 'Favori dizilerinizin yeni bölümlerini asla kaçırmayın.',
    icon: <Calendar size={32} color="#60a5fa" />,
    gradient: ['#1e293b', '#0f172a'],
    size: 'small',
  },
  {
    title: 'Film & Dizi Keşfi',
    description: 'Size özel öneriler ve trend olan yapımlarla yeni içerikler bulun.',
    icon: <Film size={32} color="#e879f9" />,
    gradient: ['#1e293b', '#0f172a'],
    size: 'small',
  },
  {
    title: 'İlerleme Takibi',
    description: 'Hangi bölümde kaldığınızı anında görün.',
    icon: <CheckCircle2 size={32} color="#f87171" />,
    gradient: ['#1e293b', '#0f172a'],
    size: 'medium',
  },
];

const BentoCard = ({ feature, isDesktop }: { feature: any, isDesktop: boolean }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  const handleHoverIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1.02,
        useNativeDriver: false,
        friction: 5,
      }),
      Animated.spring(translateYAnim, {
        toValue: -5,
        useNativeDriver: false,
        friction: 5,
      })
    ]).start();
  };

  const handleHoverOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: false,
        friction: 5,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        useNativeDriver: false,
        friction: 5,
      })
    ]).start();
  };

  return (
    <Pressable
      // @ts-ignore
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPressIn={handleHoverIn}
      onPressOut={handleHoverOut}
      style={[
        styles.cardContainer,
        isDesktop && feature.size === 'large' && styles.cardLarge,
        isDesktop && feature.size === 'medium' && styles.cardMedium,
        isDesktop && feature.size === 'small' && styles.cardSmall,
      ]}
    >
      <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }, { translateY: translateYAnim }] }}>
        <LinearGradient
          colors={feature.gradient as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.iconContainer}>
            {feature.icon}
          </View>
          <Text style={styles.cardTitle}>{feature.title}</Text>
          <Text style={styles.cardDesc}>{feature.description}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
};

export default function BentoGrid() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Neden <Text style={styles.highlight}>KaymakTV?</Text></Text>
        <Text style={styles.subtitle}>İzleme deneyiminizi bir üst seviyeye taşıyacak tüm araçlar elinizin altında.</Text>
      </View>

      <Animated.View style={[
        styles.grid, 
        isDesktop ? styles.gridDesktop : styles.gridMobile,
        { opacity: fadeAnim }
      ]}>
        {features.map((feature, index) => (
          <BentoCard key={index} feature={feature} isDesktop={isDesktop} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
    maxWidth: 600,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  highlight: {
    color: '#3B82F6',
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 26,
  },
  grid: {
    width: '100%',
    maxWidth: 1100,
    gap: 20,
  },
  gridMobile: {
    flexDirection: 'column',
  },
  gridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  cardContainer: {
    width: '100%',
    minHeight: 200,
  },
  cardLarge: {
    width: '100%', // Takes full width on top
    minHeight: 300,
  },
  cardMedium: {
    width: '58%', // Takes roughly 60%
    minHeight: 250,
  },
  cardSmall: {
    width: '38%', // Takes roughly 40%
    minHeight: 250,
  },
  card: {
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    flex: 1,
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
    } as any),
  },
  iconContainer: {
    marginBottom: 'auto',
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignSelf: 'flex-start',
    padding: 12,
    borderRadius: 16,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 20,
  },
  cardDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    lineHeight: 24,
  },
});

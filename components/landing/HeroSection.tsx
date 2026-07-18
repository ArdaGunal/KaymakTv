import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, Animated, useWindowDimensions, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Play, Compass } from 'lucide-react-native';

const MOBILE_BREAKPOINT = 768;

export default function HeroSection() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { loginAsGuest } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= MOBILE_BREAKPOINT;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGuestLogin = async () => {
    await loginAsGuest();
    router.replace('/(protected)/(tabs)/explore');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(59, 130, 246, 0.18)', 'transparent']}
        style={styles.glowEffect}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🎉 Yeni Sürüm 2.0 Yayında</Text>
        </View>

        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
          {t('landingTitle1')} {'\n'}
          <Text style={styles.highlight}>{t('landingTitle2')}</Text> {t('landingTitle3')}
        </Text>

        <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>{t('landingSubtitle')}</Text>

        <View style={[styles.buttonContainer, isDesktop && styles.buttonContainerDesktop]}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.82}
            onPress={() => router.push('/(public)/settings')}
          >
            <LinearGradient
              colors={['#2563eb', '#1d4ed8']}
              style={styles.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Play color="#fff" size={18} fill="#fff" style={styles.btnIcon} />
              <Text style={styles.primaryButtonText}>{t('landingStartFree')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostButton}
            activeOpacity={0.75}
            onPress={handleGuestLogin}
          >
            <Compass color="#60a5fa" size={18} style={styles.btnIcon} />
            <Text style={styles.ghostButtonText}>{t('landingGuest')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'web' ? 140 : 72,
    paddingBottom: Platform.OS === 'web' ? 100 : 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  glowEffect: {
    position: 'absolute',
    top: -80,
    left: '-50%',
    right: '-50%',
    width: '200%',
    height: 400,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 900,
    zIndex: 1,
  },
  badge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    marginBottom: 24,
  },
  badgeText: {
    color: '#60a5fa',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    lineHeight: 48,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  titleDesktop: {
    fontSize: 72,
    lineHeight: 85,
    letterSpacing: -1.5,
  },
  highlight: {
    color: '#3B82F6',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
    maxWidth: 560,
  },
  subtitleDesktop: {
    fontSize: 19,
    lineHeight: 30,
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 14,
    width: '100%',
    maxWidth: 340,
  },
  buttonContainerDesktop: {
    flexDirection: 'row',
    maxWidth: '100%',
    justifyContent: 'center',
    gap: 16,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 54,
  },
  btnIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    backgroundColor: 'rgba(59, 130, 246, 0.07)',
    minHeight: 54,
  },
  ghostButtonText: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

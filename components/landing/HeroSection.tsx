import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Clapperboard, LogIn, Compass } from '../icons';

const MOBILE_BREAKPOINT = 768;

export default function HeroSection() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { loginAsGuest } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= MOBILE_BREAKPOINT;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleGuestLogin = async () => {
    await loginAsGuest();
    router.replace('/(protected)/(tabs)/explore');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(176, 198, 255, 0.07)', 'rgba(14, 19, 29, 0)']}
        style={styles.glowTop}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.badge}>
          <Clapperboard size={13} color="#b0c6ff" strokeWidth={2} />
          <Text style={styles.badgeText}>{t('diaryEyebrow').toUpperCase()}</Text>
        </View>

        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
          {t('heroTitle1')}
          {'\n'}
          <Text style={styles.highlight}>{t('heroTitle2')}</Text>
          {t('heroTitle3')}
        </Text>

        <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
          {t('heroSubtitle')}
        </Text>

        <View style={[styles.ctaGroup, isDesktop && styles.ctaGroupDesktop]}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.82}
            onPress={() => router.push('/(public)/settings')}
          >
            <LinearGradient
              colors={['#b0c6ff', '#8ab4ff']}
              style={styles.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <LogIn color="#002d6e" size={17} strokeWidth={2.5} />
              <Text style={styles.primaryButtonText}>{t('connectTraktButton', 'Trakt ile Giriş Yap')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.78}
            onPress={handleGuestLogin}
          >
            <Compass color="#b0c6ff" size={17} strokeWidth={2} />
            <Text style={styles.secondaryButtonText}>{t('exploreAsGuest')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'web' ? 160 : 72,
    paddingBottom: Platform.OS === 'web' ? 96 : 60,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 680,
    zIndex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(27, 32, 42, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 28,
  },
  badgeText: {
    color: '#b0c6ff',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#dee2f1',
    textAlign: 'center',
    lineHeight: 46,
    marginBottom: 20,
    letterSpacing: -0.8,
  },
  titleDesktop: {
    fontSize: 56,
    lineHeight: 68,
    letterSpacing: -1.2,
  },
  highlight: {
    color: '#b0c6ff',
    fontStyle: 'italic',
  },
  subtitle: {
    fontSize: 15,
    color: '#8c90a0',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 36,
    maxWidth: 520,
  },
  subtitleDesktop: {
    fontSize: 17,
    lineHeight: 28,
    color: '#c2c6d6',
  },
  ctaGroup: {
    width: '100%',
    gap: 12,
    maxWidth: 480,
  },
  ctaGroupDesktop: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#b0c6ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 54,
  },
  primaryButtonText: {
    color: '#002d6e',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minHeight: 54,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(27, 32, 42, 0.8)',
  },
  secondaryButtonText: {
    color: '#c2c6d6',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});

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
import { LogIn, Compass, Sparkles, RefreshCw, BarChart2 } from 'lucide-react-native';

const MOBILE_BREAKPOINT = 768;

export default function HeroSection() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { loginAsGuest } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= MOBILE_BREAKPOINT;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleGuestLogin = async () => {
    await loginAsGuest();
    router.replace('/(protected)/(tabs)/explore');
  };

  return (
    <View style={styles.container}>
      {/* Çift katmanlı arka plan parlaması */}
      <LinearGradient
        colors={['rgba(37, 99, 235, 0.2)', 'rgba(59, 130, 246, 0.06)', 'transparent']}
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
        {/* Sürüm rozeti */}
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>{t('landingVersion', '✨ Yeni Sürüm 2.0 Yayında')}</Text>
        </View>

        {/* Başlık */}
        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
          {t('landingTitle1', 'Medyalarınızı')}{'\n'}
          {t('landingTitle3', 'Yönetmenin ')}<Text style={styles.highlight}>{t('landingTitle2', 'En Şık')}</Text>{'\n'}
          {'Yolu'}
        </Text>

        {/* Alt başlık */}
        <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
          {t('landingSubtitle')}
        </Text>

        {/* CTA Butonları */}
        <View style={[styles.ctaGroup, isDesktop && styles.ctaGroupDesktop]}>
          {/* Birincil: Giriş Yap */}
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.82}
            onPress={() => router.push('/(public)/settings')}
          >
            <LinearGradient
              colors={['#1d4ed8', '#3b82f6', '#60a5fa']}
              style={styles.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <LogIn color="#ffffff" size={17} />
              <Text style={styles.primaryButtonText}>{t('login', 'Giriş Yap')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* İkincil: Misafir */}
          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.78}
            onPress={handleGuestLogin}
          >
            <Compass color="#93c5fd" size={17} />
            <Text style={styles.secondaryButtonText}>{t('landingGuest', 'Misafir Devam')}</Text>
          </TouchableOpacity>
        </View>

        {/* Güven çipleri */}
        <View style={styles.trustRow}>
          <View style={styles.trustChip}>
            <Sparkles size={11} color="#60a5fa" />
            <Text style={styles.trustText}>100K+ İçerik</Text>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustChip}>
            <RefreshCw size={11} color="#34d399" />
            <Text style={styles.trustText}>Trakt Senkron</Text>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustChip}>
            <BarChart2 size={11} color="#fbbf24" />
            <Text style={styles.trustText}>Detaylı Analiz</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'web' ? 140 : 56,
    paddingBottom: Platform.OS === 'web' ? 80 : 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  glowTop: {
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
    maxWidth: 680,
    zIndex: 1,
  },
  // ── Rozet ───────────────────────────────────────────────────────────────
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.22)',
    marginBottom: 20,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#60a5fa',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 6px #60a5fa' } as any) : null),
  },
  badgeText: {
    color: '#93c5fd',
    fontWeight: '700',
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
  // ── Başlık ──────────────────────────────────────────────────────────────
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
    lineHeight: 43,
    marginBottom: 16,
    letterSpacing: -0.8,
  },
  titleDesktop: {
    fontSize: 64,
    lineHeight: 76,
    letterSpacing: -1.5,
  },
  highlight: {
    color: '#60a5fa',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 480,
  },
  subtitleDesktop: {
    fontSize: 18,
    lineHeight: 28,
    color: '#94a3b8',
  },
  // ── CTA Butonları ────────────────────────────────────────────────────────
  ctaGroup: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  ctaGroupDesktop: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    // Canlı mavi gölge
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 15,
    paddingHorizontal: 28,
    minHeight: 52,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 16,
    minHeight: 52,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.22)',
    backgroundColor: 'rgba(59, 130, 246, 0.07)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  secondaryButtonText: {
    color: '#93c5fd',
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  // ── Güven Çipleri ─────────────────────────────────────────────────────────
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#334155',
  },
});

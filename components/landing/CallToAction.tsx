import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LogIn, Compass, ArrowRight } from '../icons';

const MOBILE_BREAKPOINT = 768;

export default function CallToAction() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { loginAsGuest } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= MOBILE_BREAKPOINT;

  const handleGuestLogin = async () => {
    await loginAsGuest();
    router.replace('/(protected)/(tabs)/explore');
  };

  return (
    <View style={styles.container}>
      {/* Arka plan parlaması */}
      <LinearGradient
        colors={['rgba(37,99,235,0.12)', 'rgba(11,17,32,0)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={[styles.card, isDesktop && styles.cardDesktop]}>
        {/* Üst kısım: Başlık */}
        <View style={styles.cardHeader}>
          <View style={styles.eyebrow}>
            <Text style={styles.eyebrowText}>HEMEN BAŞLA</Text>
          </View>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
            {t('startToday1', 'Bugün başla,')}{'\n'}
            <Text style={styles.highlight}>{t('startToday2', 'ilk filmini kaydet.')}</Text>
          </Text>
          <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
            {t('ctaBandSubtitle', 'Kurulum yok, kredi kartı yok. Sadece izle ve kaydet.')}
          </Text>
        </View>

        {/* Ayraç */}
        <View style={styles.divider} />

        {/* Buton Grubu */}
        <View style={[styles.ctaGroup, isDesktop && styles.ctaGroupDesktop]}>
          {/* Giriş Yap — Ana buton */}
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.82}
            onPress={() => router.push('/(public)/settings')}
          >
            <LinearGradient
              colors={['#1d4ed8', '#3b82f6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGrad}
            >
              <LogIn color="#ffffff" size={16} />
              <Text style={styles.primaryText}>{t('login', 'Giriş Yap')}</Text>
              <ArrowRight color="rgba(255,255,255,0.6)" size={15} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Misafir Olarak Devam Et */}
          <TouchableOpacity
            style={styles.ghostBtn}
            activeOpacity={0.78}
            onPress={handleGuestLogin}
          >
            <Compass color="#93c5fd" size={16} />
            <Text style={styles.ghostText}>{t('exploreAsGuest', 'Misafir Olarak Devam Et')}</Text>
          </TouchableOpacity>
        </View>

        {/* Alt not */}
        <Text style={styles.footNote}>
          Ücretsiz · Reklamsız · Trakt.tv ile senkronize
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 56,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
  },
  // ── Kart ────────────────────────────────────────────────────────────────
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.16)',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({
      boxShadow: '0 0 60px rgba(37,99,235,0.15)',
    }) as any : {
      shadowColor: '#3B82F6',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.15,
      shadowRadius: 32,
      elevation: 14,
    }),
  },
  cardDesktop: {
    maxWidth: 560,
  },
  // ── Başlık bloğu ─────────────────────────────────────────────────────────
  cardHeader: {
    padding: 28,
    paddingBottom: 24,
    alignItems: 'center',
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
    lineHeight: 33,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  titleDesktop: {
    fontSize: 30,
    lineHeight: 40,
  },
  highlight: {
    color: '#60a5fa',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  subtitleDesktop: {
    fontSize: 15.5,
  },
  // ── Ayraç ────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 0,
  },
  // ── Butonlar ─────────────────────────────────────────────────────────────
  ctaGroup: {
    padding: 24,
    paddingTop: 22,
    gap: 12,
  },
  ctaGroupDesktop: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    flex: 1,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  primaryGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 50,
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    minHeight: 50,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
    backgroundColor: 'rgba(59,130,246,0.06)',
    flex: 1,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  ghostText: {
    color: '#93c5fd',
    fontSize: 15,
    fontWeight: '600',
  },
  // ── Alt not ──────────────────────────────────────────────────────────────
  footNote: {
    textAlign: 'center',
    color: '#334155',
    fontSize: 11.5,
    paddingBottom: 20,
    letterSpacing: 0.1,
  },
});

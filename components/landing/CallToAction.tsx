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
      <View style={[styles.card, isDesktop && styles.cardDesktop]}>
        {/* Üst kısım: Başlık */}
        <View style={styles.cardHeader}>
          <View style={styles.eyebrow}>
            <Text style={styles.eyebrowText}>{t('ctaEyebrow', 'HEMEN BAŞLA').toUpperCase()}</Text>
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
            style={[styles.primaryBtn, isDesktop && { flex: 1 }]}
            activeOpacity={0.82}
            onPress={() => router.push('/(public)/settings')}
          >
            <LogIn color="#ffffff" size={16} strokeWidth={2.2} />
            <Text style={styles.primaryText}>{t('connectTraktButton', 'Trakt ile Giriş Yap')}</Text>
            <ArrowRight color="rgba(255,255,255,0.7)" size={15} />
          </TouchableOpacity>

          {/* Misafir Olarak Devam Et */}
          <TouchableOpacity
            style={[styles.ghostBtn, isDesktop && { flex: 1 }]}
            activeOpacity={0.78}
            onPress={handleGuestLogin}
          >
            <Compass color="#8c90a0" size={16} />
            <Text style={styles.ghostText}>{t('exploreAsGuest', 'Misafir Olarak Devam Et')}</Text>
          </TouchableOpacity>
        </View>

        {/* Alt not */}
        <Text style={styles.footNote}>
          {t('ctaFootnote', 'Ücretsiz · Reklamsız · Trakt.tv ile senkronize')}
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
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: 'rgba(27, 32, 42, 0.7)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  cardDesktop: {
    maxWidth: 560,
  },
  cardHeader: {
    padding: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  eyebrow: {
    backgroundColor: 'rgba(27, 32, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    marginBottom: 16,
  },
  eyebrowText: {
    color: '#7aa2f7',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#dee2f1',
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
    color: '#5c8cf5',
    fontStyle: 'italic',
  },
  subtitle: {
    fontSize: 14,
    color: '#8c90a0',
    textAlign: 'center',
    lineHeight: 22,
  },
  subtitleDesktop: {
    fontSize: 15.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 0,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(27, 32, 42, 0.8)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  ghostText: {
    color: '#c2c6d6',
    fontSize: 15,
    fontWeight: '600',
  },
  footNote: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 11.5,
    paddingBottom: 20,
    letterSpacing: 0.1,
  },
});

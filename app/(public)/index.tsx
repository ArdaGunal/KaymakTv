import React, { useState } from 'react';
import { View, TouchableOpacity, Text, ScrollView, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeroSection from '../../components/landing/HeroSection';
import BentoGrid from '../../components/landing/BentoGrid';
import CallToAction from '../../components/landing/CallToAction';
import Footer from '../../components/landing/Footer';
import LanguagePickerModal from '../../components/settings/LanguagePickerModal';
import { StatusBar } from 'expo-status-bar';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { Globe, LogIn } from '../../components/icons';
import { useTranslation } from 'react-i18next';

export default function LandingPage() {
  const { accessToken, isGuest, loginAsGuest } = useAuth();
  const { currentLanguage, handleChangeLanguage } = useSettings();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { width } = useWindowDimensions();

  if (accessToken || isGuest) {
    return <Redirect href="/(protected)/(tabs)/explore" />;
  }

  const handleGuestLogin = async () => {
    await loginAsGuest();
    router.replace('/(protected)/(tabs)/explore');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />

      {/* ── Sticky Navbar ─────────────────────────────────────────────── */}
      <View style={styles.navbar}>
        {/* Sol: Logo */}
        <View style={styles.navBrand}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>KaymakTV</Text>
        </View>

        {/* Orta: Nav linkleri (sadece geniş ekran) */}
        {Platform.OS === 'web' && (
          <TouchableOpacity
            onPress={handleGuestLogin}
            activeOpacity={0.75}
            style={styles.navLink}
          >
            <Text style={styles.navLinkText}>{t('navExplore', 'Keşfet')}</Text>
          </TouchableOpacity>
        )}

        {/* Sağ: Dil + Giriş Yap */}
        <View style={styles.navActions}>
          <TouchableOpacity
            style={styles.langButton}
            onPress={() => setLangModalVisible(true)}
            activeOpacity={0.75}
          >
            <Globe size={14} color="#7aa2f7" />
            <Text style={styles.langButtonText}>
              {currentLanguage === 'tr' ? 'TR' : 'EN'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(public)/settings')}
            activeOpacity={0.82}
          >
            <LogIn size={14} color="#ffffff" strokeWidth={2.2} />
            {Platform.OS === 'web' || width >= 768 ? (
              <Text style={styles.loginButtonText}>{t('connectTraktButton', 'Trakt ile Giriş Yap')}</Text>
            ) : (
              <Text style={styles.loginButtonText}>{t('login', 'Giriş')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── İçerik ────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HeroSection />
        <BentoGrid />
        <CallToAction />
        <Footer />
      </ScrollView>

      <LanguagePickerModal
        visible={langModalVisible}
        currentLanguage={currentLanguage}
        onSelect={handleChangeLanguage}
        onClose={() => setLangModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0e131d',
  },
  // ── Sticky Navbar ────────────────────────────────────────────────────────
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(14, 19, 29, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    ...(Platform.OS === 'web' ? ({
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    } as any) : null),
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5c8cf5',
  },
  brandText: {
    color: '#5c8cf5',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  navLink: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  navLinkText: {
    color: '#c2c6d6',
    fontSize: 14,
    fontWeight: '500',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(27, 32, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  langButtonText: {
    color: '#c2c6d6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

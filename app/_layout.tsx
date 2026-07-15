import '../locales/index'; // Initialize i18n
import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, StyleSheet, Platform } from 'react-native';

function RootLayoutNav() {
  const { accessToken, isGuest, isLoading, loginAsGuest } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const initialCheckDone = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    const inSettingsGroup = segments[0] === 'settings';

    if (!accessToken && !isGuest) {
      if (Platform.OS === 'web') {
        // Otomatik Misafir Girişi (Web için) - Yönlendirme yapmadan önce deep link kontrolü yap
        loginAsGuest();
        
        // Sadece ana sayfaya (kök dizine) girilmişse /explore'a at. Alt linklere dokunma!
        if (segments.length === 0 || (segments.length === 1 && segments[0] === '(tabs)') || segments.join('/') === '(tabs)/index') {
          router.replace('/explore');
        }
      } else {
        if (!inSettingsGroup) {
          // Mobil için Login Ekranına Yönlendir
          router.replace('/settings');
        }
      }
    } else if (isGuest && Platform.OS === 'web') {
      // Daha önceden misafir olan kullanıcılar siteye ana dizinden (/) girerse, sadece İLK AÇILIŞTA /explore'a at.
      if (!initialCheckDone.current) {
        if (segments.length === 0 || (segments.length === 1 && segments[0] === '(tabs)') || segments.join('/') === '(tabs)/index') {
          router.replace('/explore');
        }
      }
    }

    initialCheckDone.current = true;
  }, [accessToken, isGuest, isLoading, segments]);

  if (isLoading) {
    return <View style={styles.loadingContainer} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#171717' } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

import { LibraryProvider } from '../context/LibraryContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <LibraryProvider>
        <RootLayoutNav />
      </LibraryProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
});

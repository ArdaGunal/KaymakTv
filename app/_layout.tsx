import '../locales/index'; // Initialize i18n
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, StyleSheet } from 'react-native';

function RootLayoutNav() {
  const { accessToken, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inSettingsGroup = segments[0] === 'settings';

    if (!accessToken && !inSettingsGroup) {
      // Redirect to settings if not authenticated
      router.replace('/settings');
    }
  }, [accessToken, isLoading, segments]);

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

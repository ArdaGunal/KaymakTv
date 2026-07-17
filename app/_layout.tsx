import '../locales/index'; // Initialize i18n
import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, StyleSheet, Platform } from 'react-native';

function RootLayoutNav() {
    const { accessToken, isGuest, isLoading } = useAuth();

  if (isLoading) {
    return <View style={styles.loadingContainer} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#171717' } }}>
      <Stack.Screen name="(public)" />
      <Stack.Screen name="(protected)" />
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

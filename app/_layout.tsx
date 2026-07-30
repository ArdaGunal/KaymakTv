import '../locales/index'; // Initialize i18n
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, StyleSheet } from 'react-native';
import { LibraryProvider } from '../context/LibraryContext';
import VersionGate from '../features/versionGate/components/VersionGate';
import SoftUpdateBanner from '../components/SoftUpdateBanner';

function RootLayoutNav() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <View style={styles.loadingContainer} />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#171717' } }}>
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(protected)" />
      </Stack>
      <SoftUpdateBanner />
    </>
  );
}

export default function RootLayout() {
  // VersionGate BİLİNÇLİ OLARAK AuthProvider'ın DIŞINDA: kendi kontrolünü
  // Trakt/Auth işlemlerinden tamamen bağımsız ve onlardan ÖNCE yapar — eski
  // bir sürüm engellendiğinde AuthProvider'ın SecureStore okuması/Trakt'a
  // giden hiçbir istek asla tetiklenmez (bkz. features/versionGate).
  return (
    <VersionGate>
      <AuthProvider>
        <LibraryProvider>
          <RootLayoutNav />
        </LibraryProvider>
      </AuthProvider>
    </VersionGate>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
});

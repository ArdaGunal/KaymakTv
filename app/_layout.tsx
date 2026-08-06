import '../locales/index'; // Initialize i18n
import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, StyleSheet } from 'react-native';
import { LibraryProvider } from '../context/LibraryContext';
import VersionGate from '../features/versionGate/components/VersionGate';
import SoftUpdateBanner from '../components/SoftUpdateBanner';
import { recordPerfMark } from '../utils/perfLog';

// Modül değerlendirilir değerlendirilmez (JS bundle'ı çalışmaya başlar
// başlamaz) damgalanır — "Toplam Uygulama Açılışı" ölçümünün başlangıç
// noktası budur. `RootLayoutNav` her yeniden render olduğunda SIFIRLANMAZ
// (modül seviyesinde bir kez tanımlanır), bu yüzden ölçüm yalnızca gerçek
// açılışta bir kez kaydedilir (bkz. aşağıdaki `hasRecordedStartup` ref).
const appLoadStartedAt = Date.now();

function RootLayoutNav() {
  const { isLoading } = useAuth();
  const hasRecordedStartup = useRef(false);

  // VersionGate (native'de ağ isteği içerebilir) + AuthContext'in oturum
  // yüklemesi bitip ilk anlamlı ekran render edilmeye hazır olduğu an —
  // kullanıcının "uygulama ne zaman kullanılabilir oldu" olarak deneyimlediği
  // gerçek süre budur (JS bundle yükleme dahil, yalnızca tek bir efektten
  // sonraki senkron render değil).
  useEffect(() => {
    if (isLoading || hasRecordedStartup.current) return;
    hasRecordedStartup.current = true;
    recordPerfMark('Toplam Uygulama Açılışı', 'startup', Date.now() - appLoadStartedAt);
  }, [isLoading]);

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

import { agIzleyiciKur } from '../utils/agIzleyici';
agIzleyiciKur(); // yalnız EXPO_PUBLIC_AG_IZLE=1 test APK'sında; bkz. utils/agIzleyici.ts
import '../locales/index'; // Initialize i18n
import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, StyleSheet } from 'react-native';
import { LibraryProvider } from '../context/LibraryContext';
import VersionGate from '../features/versionGate/components/VersionGate';
import SoftUpdateBanner from '../components/SoftUpdateBanner';
import OfflineBanner from '../components/OfflineBanner';
import ErrorFallback from '../components/ErrorFallback';
import { recordPerfMark } from '../utils/perfLog';
import { logError } from '../utils/errorLog';
import { useWatchedOutbox } from '../hooks/useWatchedOutbox';
import { useHiddenOutbox } from '../hooks/useHiddenOutbox';
import WatchedOutboxBanner from '../components/WatchedOutboxBanner';
import ConfirmHost from '../components/ConfirmHost';

// expo-router'ın kök segmentindeki (bu dosya) BÜTÜN alt ağacı kapsayan
// çökme yakalayıcısı — bir render hatası eskiden beyaz/boş bir ekranda
// SESSİZCE takılıp kalıyordu (bkz. google_play_eksikler.md Aşama 3: Google
// Play'in Pre-launch report botları tam olarak bunu arıyor). `retry()`
// expo-router tarafından veriliyor — render ağacını sıfırlayıp yeniden
// dener, hatanın kaynağı geçiciyse bu genelde yeterli olur.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => {
    logError('RootLayout.ErrorBoundary', error);
  }, [error]);

  return <ErrorFallback onRetry={retry} />;
}

// Modül değerlendirilir değerlendirilmez (JS bundle'ı çalışmaya başlar
// başlamaz) damgalanır — "Toplam Uygulama Açılışı" ölçümünün başlangıç
// noktası budur. `RootLayoutNav` her yeniden render olduğunda SIFIRLANMAZ
// (modül seviyesinde bir kez tanımlanır), bu yüzden ölçüm yalnızca gerçek
// açılışta bir kez kaydedilir (bkz. aşağıdaki `hasRecordedStartup` ref).
const appLoadStartedAt = Date.now();

function RootLayoutNav() {
  const { isLoading } = useAuth();
  // show/episode/movie root rotalarına soğuk deep link de kuyruğu başlatır.
  useWatchedOutbox();
  useHiddenOutbox();
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
      <OfflineBanner />
      <WatchedOutboxBanner />
    </>
  );
}

export default function RootLayout() {
  // VersionGate BİLİNÇLİ OLARAK AuthProvider'ın DIŞINDA: kendi kontrolünü
  // Trakt/Auth işlemlerinden tamamen bağımsız ve onlardan ÖNCE yapar — eski
  // bir sürüm engellendiğinde AuthProvider'ın SecureStore okuması/Trakt'a
  // giden hiçbir istek asla tetiklenmez (bkz. features/versionGate).
  // ConfirmHost VersionGate'in DIŞINDA: engel ekranında da, oturum yüklenirken de
  // `confirmAsync`/`notify` koyu kutuyla açılsın (GORSEL-01 · utils/confirmDialog.ts).
  return (
    <>
      <VersionGate>
        <AuthProvider>
          <LibraryProvider>
            <RootLayoutNav />
          </LibraryProvider>
        </AuthProvider>
      </VersionGate>
      <ConfirmHost />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
});

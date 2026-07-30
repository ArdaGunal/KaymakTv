import { Stack, Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useFeedSyncTrigger } from '../../features/feed/hooks/useFeedSyncTrigger';
import SyncStatusBanner from '../../components/SyncStatusBanner';

export default function ProtectedLayout() {
  const { accessToken, isGuest } = useAuth();
  useFeedSyncTrigger(accessToken, isGuest);

  if (!accessToken && !isGuest) {
    return <Redirect href="/" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#171717' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account" />
        <Stack.Screen name="error-log" />
        <Stack.Screen name="notifications" />
      </Stack>
      {/* Tek mount noktası — tüm korumalı ekranların (sekmeler + ayarlar +
          hata günlüğü) üzerinde, dokunuşları engellemeden görünür. */}
      <SyncStatusBanner />
    </View>
  );
}

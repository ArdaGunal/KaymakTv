import { Stack, Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useFeedSyncTrigger } from '../../features/feed/hooks/useFeedSyncTrigger';
import { useNotificationSetup } from '../../features/notifications/hooks/useNotificationSetup';
import { useNotificationTap } from '../../features/notifications/hooks/useNotificationTap';
import { useRemoteInbox } from '../../features/notifications/hooks/useRemoteInbox';
// 🔄 Trakt'ta sonradan yapılan eklemeleri sessizce getirir (§D15). Kendi
// kapılarını taşıyor: onay yoksa, Trakt hesabı değilse ya da son tur 6 saatten
// yeniyse HİÇBİR ŞEY yapmaz.
import { useOtomatikFarkTuru } from '../../hooks/useOtomatikFarkTuru';
import SyncStatusBanner from '../../components/SyncStatusBanner';

export default function ProtectedLayout() {
  const { accessToken, isGuest } = useAuth();
  useFeedSyncTrigger(accessToken, isGuest);
  // Bildirim sistemi (docs/design/notifications.md). Misafir kontrolü
  // hook'un İÇİNDE — Madde 268 gereği çağrı yerine kontrol eklenmiyor.
  useNotificationSetup(accessToken, isGuest);
  useNotificationTap();
  // Uygulama ONDEYKEN gelen uzak bildirimleri kutuya alir. Arka plan/kapali
  // hali acilistaki tepsi supurmesi ve tiklama yaniti kapsiyor
  // (features/notifications/inbox/remoteInbox.ts basligi).
  useRemoteInbox();
  useOtomatikFarkTuru();

  if (!accessToken && !isGuest) {
    return <Redirect href="/" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#171717' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account" />
        <Stack.Screen name="dev-panel" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="notification-settings" />
      </Stack>
      {/* Tek mount noktası — tüm korumalı ekranların (sekmeler + ayarlar +
          hata günlüğü) üzerinde, dokunuşları engellemeden görünür. */}
      <SyncStatusBanner />
    </View>
  );
}

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { PushToken, PermissionStatus } from '../types';
import { registerForPushNotificationsAsync } from '../services/expoPush';
import { registerForWebPushNotificationsAsync } from '../services/webPush';

/**
 * TODO: Bildirim mantığını uygulamanın geri kalanına bağlayacak hook.
 */
export const useNotifications = () => {
  const [token, setToken] = useState<PushToken | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');

  useEffect(() => {
    // TODO: İleride uygulama başlatıldığında veya kullanıcı izin verdiğinde token alınacak.
    const fetchToken = async () => {
      // let newToken = null;
      // if (Platform.OS === 'web') {
      //   newToken = await registerForWebPushNotificationsAsync();
      // } else {
      //   newToken = await registerForPushNotificationsAsync();
      // }
      // setToken(newToken);
    };

    // fetchToken();
  }, []);

  return {
    token,
    permissionStatus,
    // requestPermission: async () => { ... }
  };
};

import { Platform } from 'react-native';
import { PushToken } from '../types';

/**
 * TODO: Bu dosya Web bildirimleri için ayrılmıştır.
 * İleride Service Worker ve Web Push API (VAPID) mantığını barındıracak.
 */

export const registerForWebPushNotificationsAsync = async (): Promise<PushToken | null> => {
  if (Platform.OS !== 'web') return null;
  
  // TODO: Implement Web Push token retrieval via Service Worker
  return null;
};

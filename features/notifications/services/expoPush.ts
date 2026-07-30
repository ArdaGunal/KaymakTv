import { Platform } from 'react-native';
import { PushToken } from '../types';

/**
 * TODO: Bu dosya Mobil bildirimleri için ayrılmıştır.
 * İleride Expo Push token alma, bildirim kanalları oluşturma mantığı buraya yazılacak.
 */

export const registerForPushNotificationsAsync = async (): Promise<PushToken | null> => {
  if (Platform.OS === 'web') return null;
  
  // TODO: Implement Expo Push token retrieval
  return null;
};

import { PushToken } from '../types';

/**
 * TODO: Bu dosya Backend/Supabase API istekleri için ayrılmıştır.
 * Alınan Push Token'ı sunucuya kaydetme veya silme mantığı buraya yazılacak.
 */

export const registerPushToken = async (pushToken: PushToken): Promise<void> => {
  // TODO: Token'ı Supabase veya kendi backend servisimize kaydet
  console.log('Registering token:', pushToken);
};

export const unregisterPushToken = async (token: string): Promise<void> => {
  // TODO: Token'ı sunucudan sil
  console.log('Unregistering token:', token);
};

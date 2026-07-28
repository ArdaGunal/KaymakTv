import axios from 'axios';

// Hesap silme — yalnızca KaymakTV'nin kendi Supabase verisini (users satırı,
// buna FK ile bağlı feed_activities/comments CASCADE ile) siler. Trakt
// hesabına HİÇ dokunmaz: Trakt zaten bir hesap silme API'si sunmuyor,
// `traktAccessToken` yalnızca KİMLİK doğrulamak (hangi kullanıcının verisi
// silinecek) için Worker'a gönderilir, orada da yalnızca okunur.
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export async function deleteAccountData(traktAccessToken: string): Promise<void> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/account/delete`,
    { traktAccessToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'İşlem başarısız.');
  }
}

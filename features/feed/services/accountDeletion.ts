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

// ── Kimlik Faz 4 (M515) · D4 — isim ekranındaki «Zaten hesabın var mı? Giriş yap» ──
// Worker yalnız onaysız, 1 saatten genç, elle üretilmiş sosyal izi olmayan hesabı bırakır
// (`lib/kimlik/yeniHesap.js`); karar SUNUCUDA, istemci yalnız gösterir.

/** Link gösterilsin mi? Hata/bilinmeyen → false (link gizli kalır). */
export async function yeniHesapBirakilabilir(traktAccessToken: string): Promise<boolean> {
  if (!KAYMAK_WORKER_URL) return false;
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/account/yeni-hesap/durum`,
    { traktAccessToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  return response.data?.success === true && response.data?.birakilabilir === true;
}

/** Yeni hesabı bırakır; koşul tutmazsa (409) hata fırlatır — oturum KAPATILMAZ. */
export async function yeniHesabiBirak(traktAccessToken: string): Promise<void> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/account/yeni-hesabi-birak`,
    { traktAccessToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) throw new Error(response.data?.neden || 'birakilamaz');
}

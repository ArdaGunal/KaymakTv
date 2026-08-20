import axios from 'axios';

// Worker'daki `/auth/google` uç noktasının istemci tarafı (F8). Aynı
// KAYMAK_WORKER_URL deseni — bkz. features/feed/services/feedPrivacy.ts.
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export type GoogleAuthCheckResult =
  | { status: 'linked'; sessionToken: string }
  | { status: 'unlinked' };

export type GoogleAuthLinkResult = { status: 'created' | 'linked'; sessionToken: string };

const postAuthGoogle = async (body: Record<string, unknown>): Promise<any> => {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  try {
    const response = await axios.post(`${KAYMAK_WORKER_URL}/auth/google`, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    return response.data;
  } catch (error: any) {
    // Worker hata durumlarında da JSON gövde döner (`{success:false, code, message}`)
    // — axios 4xx/5xx'i exception'a çeviriyor ama gövde `error.response.data`'da duruyor.
    if (error?.response?.data) return error.response.data;
    throw error;
  }
};

/**
 * Google ID token'ının bu cihazdaki oturum için YETERLİ olup olmadığını
 * sorar — hiçbir şey YAZMAZ (bkz. Worker'daki `handleAuthGoogle` başlığı).
 *
 * ⚠️ Bugünkü kapsamda (HISTORY Madde 201) `status:'linked'` dönse bile
 * istemci `sessionToken`'ı KULLANMIYOR — her başarılı giriş `link_trakt` ile
 * tamamlanıp GERÇEK Trakt token'ları kaydediliyor (`AuthContext.saveTokens`).
 * Sebep: `sessionToken`'ı `traktAccessToken` olarak saklamak,
 * `services/api/traktClient.ts`'in 401 yakalayıcısını (refresh token yoksa
 * KOŞULSUZ oturumu kapatıyor) yanlış tetikleyip kullanıcıyı sessizce çıkışa
 * atardı. `sessionToken` altyapısı hazır ve test edildi; kullanılması bu
 * riskin çözüldüğü ayrı bir işe bırakıldı.
 */
export const checkGoogleAccount = async (googleIdToken: string, nonce: string): Promise<GoogleAuthCheckResult> => {
  const data = await postAuthGoogle({ action: 'check', googleIdToken, nonce });
  if (!data?.success) {
    throw new Error(data?.message || 'Google hesabı doğrulanamadı.');
  }
  return data.status === 'linked'
    ? { status: 'linked', sessionToken: data.sessionToken }
    : { status: 'unlinked' };
};

/**
 * Kullanıcı Trakt'ı YENİDEN doğruladıktan sonra (`traktAccessToken` GERÇEK
 * bir Trakt token'ı) bu Google hesabını bağlar. `sessionToken` dönüşü de var
 * ama yukarıdaki notla aynı sebeple kullanılmıyor — çağıran taraf bu
 * fonksiyonun DÖNÜŞÜNÜ değil, kendi elindeki gerçek Trakt token'larını
 * (`exchangeAuthCode`'dan gelen) `saveTokens`'a veriyor.
 */
export const linkGoogleToTrakt = async (
  googleIdToken: string,
  traktAccessToken: string,
  nonce: string
): Promise<GoogleAuthLinkResult> => {
  const data = await postAuthGoogle({ action: 'link_trakt', googleIdToken, traktAccessToken, nonce });
  if (!data?.success) {
    const err = new Error(data?.message || 'Hesaplar bağlanamadı.');
    (err as any).code = data?.code;
    throw err;
  }
  return { status: data.status, sessionToken: data.sessionToken };
};

import axios from 'axios';

// Trakt Client Secret istemciye ASLA gömülmez. Bunun yerine server.js'teki
// /api/trakt proxy'sine gidilir; secret orada sunucu-taraflı (TRAKT_CLIENT_SECRET,
// EXPO_PUBLIC_ önekSİZ) env değişkeninden okunur. EXPO_PUBLIC_API_URL tanımlıysa
// (native derlemeler için gerekli) mutlak adres kullanılır, yoksa (Web, aynı origin)
// göreli yol yeterlidir — tıpkı services/tmdbApi.ts'deki TMDB_PROXY_URL deseni gibi.
const TRAKT_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt`
  : '/api/trakt';

export const exchangeAuthCode = async (code: string, redirectUri: string) => {
  try {
    const response = await axios.post(TRAKT_PROXY_URL, {
      code,
      redirect_uri: redirectUri,
    });
    return response.data; // { access_token, refresh_token, ... }
  } catch (error: any) {
    console.error('exchangeAuthCode Hatası:', error?.response?.data || error);
    throw error;
  }
};

export const refreshTraktToken = async (refreshToken: string, redirectUri: string) => {
  const response = await axios.post(TRAKT_PROXY_URL, {
    refresh_token: refreshToken,
    redirect_uri: redirectUri,
  });
  return response.data; // { access_token, refresh_token, ... }
};

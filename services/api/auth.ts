import axios from 'axios';

// Trakt Client Secret istemciye ASLA gömülmez. Bunun yerine `server.js`'teki
// /api/trakt proxy'sine gidilir; secret orada sunucu-taraflı (TRAKT_CLIENT_SECRET,
// EXPO_PUBLIC_ önekSİZ) env değişkeninden okunur. EXPO_PUBLIC_API_URL tanımlıysa
// mutlak adres kullanılır, yoksa (uygulama API ile AYNI origin'den sunuluyorsa)
// göreli yol yeterlidir — tıpkı services/tmdbApi.ts'deki TMDB_PROXY_URL deseni gibi.
//
// ⚠️ BU KOŞULA `Platform.OS` KONTROLÜ EKLEMEYİN. Bir kez eklendi ve mimariyi
// kırdı (bkz. docs/HISTORY.md Madde 91): bu kurulumda uygulama istemciden
// (statik `serve -s dist`) sunulurken API'yi AYRI bir makine — Raspberry Pi
// üzerindeki `node server.js` — `EXPO_PUBLIC_API_URL` adresinden sunuyor.
// Web'i göreli yola zorlamak, isteği proxy'si olmayan statik sunucuya
// yönlendirip girişi tamamen kilitler. `server.js` `app.use(cors())` ile tüm
// origin'lere izin verdiği için `localhost` → uzak API çağrısı zaten sorunsuz
// çalışır; CORS'a takılıyormuş gibi görünen hata aslında API makinesinin
// KAPALI olmasından kaynaklanıyordu (kapalı sunucu yerine cevap veren
// katman CORS başlığı göndermiyor).
const TRAKT_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt`
  : '/api/trakt';

/**
 * Proxy yanıtını doğrular ve token'ı döndürür.
 *
 * NEDEN GEREKLİ: `/api/trakt` uç noktası YALNIZCA `server.js` (Express)
 * tarafından sunulur. O süreç çalışmıyorsa (makine kapalı, elektrik kesintisi,
 * süreç düşmüş) veya istek yanlışlıkla proxy'si olmayan statik bir sunucuya
 * giderse, POST hiçbir route'a uğramaz ve SPA fallback'ine düşüp **`index.html`**
 * döndürür — HTTP 200, `text/html`. Yani axios hata FIRLATMAZ; çağıran taraf
 * sessizce `access_token`'ı olmayan bir string alır. Eskiden çağıran kod
 * `if (tokenData?.access_token)` ile bunu kontrol edip `else` YAZMADIĞI için
 * hata TAMAMEN SESSİZ yutuluyordu: token kaydedilmiyor, yönlendirme olmuyor,
 * kullanıcıya hiçbir mesaj gösterilmiyordu — kullanıcı "giriş yapamıyorum ama
 * sebebini de göremiyorum" durumunda kalıyordu. Gerçekten de bir elektrik
 * kesintisinde API makinesi kapandığında tam olarak bu yaşandı ve teşhis
 * saatler aldı (bkz. docs/HISTORY.md Madde 91).
 */
const parseTokenResponse = (data: any): any => {
  // 1) Proxy'ye ulaşılamadı: JSON yerine (SPA fallback'inden) HTML döndü.
  if (typeof data === 'string') {
    const looksLikeHtml = data.trimStart().toLowerCase().startsWith('<!doctype') ||
      data.trimStart().toLowerCase().startsWith('<html');
    if (looksLikeHtml) {
      throw new Error(
        'AUTH_PROXY_MISSING: Trakt token uç noktası (/api/trakt) JSON yerine HTML döndürdü. ' +
        'Bu genellikle API sunucusunun (`node server.js`) ÇALIŞMADIĞI anlamına gelir — ' +
        'makinenin açık ve sürecin ayakta olduğunu kontrol edin.'
      );
    }
    throw new Error('AUTH_BAD_RESPONSE: Beklenmeyen yanıt biçimi (JSON değil).');
  }

  // 2) Beklenen JSON ama token yok (ör. server.js 500 + { error } döndü).
  if (!data || typeof data !== 'object' || !data.access_token) {
    const detail = data?.error ? ` (${JSON.stringify(data.error).slice(0, 200)})` : '';
    throw new Error(`AUTH_NO_TOKEN: Yanıtta access_token yok${detail}.`);
  }

  return data;
};

export const exchangeAuthCode = async (code: string, redirectUri: string) => {
  try {
    const response = await axios.post(TRAKT_PROXY_URL, {
      code,
      redirect_uri: redirectUri,
    });
    return parseTokenResponse(response.data); // { access_token, refresh_token, ... }
  } catch (error: any) {
    console.error('exchangeAuthCode Hatası:', error?.response?.status, error?.response?.data ?? error?.message ?? error);
    throw error;
  }
};

export const refreshTraktToken = async (refreshToken: string, redirectUri: string) => {
  const response = await axios.post(TRAKT_PROXY_URL, {
    refresh_token: refreshToken,
    redirect_uri: redirectUri,
  });
  return parseTokenResponse(response.data); // { access_token, refresh_token, ... }
};

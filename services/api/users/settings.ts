import axios from 'axios';
import { Platform } from 'react-native';
import { getTraktClient, refreshAccessToken } from '../traktClient';
import * as SecureStore from '../../../utils/secureStorage';

// ══════════════════════════════════════════════════════════════════════════
// `/users/settings` — Gizli Hesap + Profili Düzenle'nin ORTAK veri katmanı
// ══════════════════════════════════════════════════════════════════════════
// Uç nokta Trakt'ın resmi API sözleşmesiyle doğrulandı (github.com/trakt/trakt-api,
// `users/schema/request/settingsRequestSchema.ts`): `PUT /users/settings`,
// gövde `{ user: { name?, about?, location?, private?, dob? } }`, başarıda
// gövdesiz `201`. Okuma: `GET /users/settings` → `{ user: { name, about, private, ... } }`.
//
// NEDEN NATIVE'DE PROXY YOK (bkz. docs/HISTORY.md Madde 132): Proxy YALNIZCA
// tarayıcı CORS'u için var (Madde 109/120/122). Native'de CORS diye bir şey
// YOKTUR — uygulamanın diğer TÜM Trakt çağrıları zaten `getTraktClient()` ile
// doğrudan gidiyor. Native'i de proxy'ye bağlamak, özelliği gereksiz yere
// "sunucu güncel mi" sorusuna bağımlı kılıyordu ve gerçekte KIRILMASINA sebep
// oldu. Artık native doğrudan Trakt'a gider; proxy yalnızca web'de devrede.
// Ek fayda: `getTraktClient()` 401'de token yenileme/rate-limit/circuit breaker
// mantığını da getiriyor — ham `axios` çağrısında bunların hiçbiri yoktu.
//
// ⚠️ Bu, `services/api/auth.ts`'teki "Platform.OS KONTROLÜ EKLEMEYİN"
// uyarısıyla ÇELİŞMEZ: o uyarı `TRAKT_PROXY_URL`'in MUTLAK/GÖRELİ seçim
// koşuluna aittir (Madde 88/91 — web'i göreli yola zorlamak, API'yi ayrı bir
// makinede barındıran bu kurulumu kırmıştı). Aşağıdaki `TRAKT_PROXY_URL`
// tanımına HİÇ DOKUNULMADI; burada karar verilen şey URL'in şekli değil,
// "web dışında proxy'ye hiç uğramaya gerek var mı" sorusudur.
const isWeb = Platform.OS === 'web';

const TRAKT_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt-proxy`
  : '/api/trakt-proxy';

/**
 * Proxy'nin isteği Trakt'a GERÇEKTEN ilettiğini doğrular.
 *
 * Kök neden (Madde 132): `server.js`'in SPA fallback'i eşleşmeyen HER isteğe
 * `200 + index.html` döndürüyordu. Sunucuda `PUT /api/trakt-proxy` handler'ı
 * yoksa (henüz deploy edilmemişse) istemci HTML'i 2xx sanıp "kaydedildi"
 * diyordu — istek Trakt'a hiç ulaşmadan. Bu guard o sessiz yalanı GÖRÜNÜR bir
 * hataya çevirir; sunucu düzeltmesi deploy edilene kadar da koruma sağlar.
 */
const assertProxyReachedTrakt = (response: any, label: string): void => {
  const contentType = String(response?.headers?.['content-type'] ?? '');
  const looksLikeHtml =
    contentType.includes('text/html') ||
    (typeof response?.data === 'string' && response.data.trimStart().startsWith('<'));

  if (looksLikeHtml) {
    throw new Error(
      `[${label}] İstek Trakt'a ulaşmadı: proxy JSON yerine HTML döndürdü. ` +
        `Sunucuda /api/trakt-proxy handler'ı eksik olabilir (server.js güncel mi?).`
    );
  }
};

/**
 * Web'deki proxy yolu `getTraktClient()`'ın axios instance'ını hiç
 * KULLANMADIĞI için, o instance'a bağlı 401→token-yenileme interceptor'ından
 * da hiç geçmiyor. Burada AYNI davranış elle uygulanıyor: 401 alınca
 * `refreshAccessToken()` (traktClient.ts'teki paylaşılan mutex) ile bir kez
 * yenile, isteği TEK SEFERLİK tekrar dene.
 */
const webProxyGet = async (params: Record<string, unknown>): Promise<any> => {
  const send = async () => {
    const accessToken = await SecureStore.getItemAsync('traktAccessToken');
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    return axios.get(TRAKT_PROXY_URL, { params, headers });
  };

  try {
    return await send();
  } catch (error: any) {
    if (error?.response?.status === 401) {
      await refreshAccessToken();
      return await send();
    }
    throw error;
  }
};

/** `GET /users/settings` — native doğrudan, web proxy üzerinden. */
export const getUserSettings = async (): Promise<any> => {
  try {
    if (!isWeb) {
      const client = await getTraktClient();
      // Trakt CDN'i aynı URL'yi önbelliyor (bkz. Madde 87/102/130).
      const response = await client.get(`/users/settings?_=${Date.now()}`);
      return response.data;
    }

    const response = await webProxyGet({ endpoint: '/users/settings', _: Date.now() });
    assertProxyReachedTrakt(response, 'getUserSettings');
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getUserSettings):', error);
    throw error;
  }
};

/**
 * Hesabın Trakt'taki gizlilik durumu — SALT OKUNUR.
 *
 * ⛔ YAZMA FONKSİYONU EKLEMEYİN (bkz. docs/HISTORY.md Madde 134): Trakt'ın
 * PUBLIC API'sinde `/users/settings` için YALNIZCA `GET` vardır. `PUT
 * /users/settings` Trakt'ın KENDİ web uygulamasına ait first-party bir uç
 * noktadır (github.com/trakt/trakt-api'de tanımlı ama public dokümantasyonda
 * YOK) — üçüncü parti bir API anahtarıyla çağrıldığında, kullanıcının token'ı
 * tamamen geçerli olsa bile `401 invalid_token` döner (canlı olarak
 * doğrulandı; yanıt ayrıca `Set-Cookie: _traktsession` içeriyor, yani
 * oturum-tabanlı first-party akıştan geçiyor). Bu yüzden ad/bio/gizlilik
 * uygulama içinden DEĞİŞTİRİLEMEZ; kullanıcı trakt.tv'ye yönlendirilir.
 */
export const getProfilePrivacy = async (): Promise<boolean> => {
  const settings = await getUserSettings();
  return settings?.user?.private ?? false;
};

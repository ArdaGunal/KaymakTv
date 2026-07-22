import axios from 'axios';
import * as SecureStore from '../../utils/secureStorage';
import i18n from '../../locales/index';
import { refreshTraktToken } from './auth';
import { logError } from '../../utils/errorLog';

export const applyTranslation = (item: any, lang: string) => {
  if (item && item.translations && Array.isArray(item.translations)) {
    const translation = item.translations.find((t: any) => t.language === lang);
    if (translation) {
      item.title = translation.title || item.title;
      item.overview = translation.overview || item.overview;
    }
  }
  return item;
};

const TRAKT_API_URL = 'https://api.trakt.tv';

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Refresh token da geçersiz/yoksa (ör. kullanıcı Trakt'tan uygulamayı iptal etti)
// SecureStore'daki token'lar silinir ama bunu hiçbir yerdeki React state
// (AuthContext.accessToken) bilmez — UI "giriş yapılmış" sanıp her istekte
// tekrar 401 almaya devam eder. AuthContext bu event'e abone olup kullanıcıyı
// açıkça çıkışa alır (bkz. context/AuthContext.tsx).
type SessionExpiredListener = () => void;
let sessionExpiredListeners: SessionExpiredListener[] = [];

export const onSessionExpired = (listener: SessionExpiredListener) => {
  sessionExpiredListeners.push(listener);
  return () => {
    sessionExpiredListeners = sessionExpiredListeners.filter((l) => l !== listener);
  };
};

const notifySessionExpired = () => {
  sessionExpiredListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('[SessionExpired Listener Error]', e);
    }
  });
};

let cachedInstance: any = null;
let cachedAccessToken: string | null = null;

export const getTraktClient = async () => {
  const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
  const accessToken = await SecureStore.getItemAsync('traktAccessToken');

  if (cachedInstance && cachedAccessToken === accessToken) {
    return cachedInstance;
  }

  cachedAccessToken = accessToken;
  
  if (!clientId) {
    throw new Error('Trakt Client ID bulunamadÄ±. LÃ¼tfen .env dosyasÄ±nÄ± kontrol edin.');
  }

  const headers: any = {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': clientId,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const instance = axios.create({
    baseURL: TRAKT_API_URL,
    headers,
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // 401 hatası ve henüz tekrar denenmemişse
      if (error.response?.status === 401 && !originalRequest._retry) {
        // Bu istek nesnesini (queue'ya girse bile) "tekrar denendi" işaretle.
        // ESKİ DAVRANIŞ: yalnızca refresh'i BAŞLATAN istek işaretleniyordu; kuyruğa
        // giren istekler işaretlenmediğinden, yeni token'la tekrar denenip YİNE
        // 401 alırlarsa (örn. token hemen sonra da geçersizse) her biri bağımsız
        // yeni bir refresh döngüsü tetikleyip birbirini kilitleyebiliyordu.
        originalRequest._retry = true;

        // Zaten yenileniyorsa, bu isteği sıraya al — yeni token gelince ilgili
        // Authorization başlığına yazılıp istek tekrar denenir.
        if (isRefreshing) {
          return new Promise(function(resolve, reject) {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return instance(originalRequest);
          }).catch(err => {
            return Promise.reject(err);
          });
        }

        isRefreshing = true;

        const refreshToken = await SecureStore.getItemAsync('traktRefreshToken');

        if (!refreshToken) {
          // Refresh token yok: kuyrukta bekleyen başka istek varsa (bu 401'le
          // eşzamanlı gelmiş olabilir) onu da reddet — aksi halde isRefreshing
          // hiç sıfırlanmadan/işlenmeden sonsuza dek "true" kalır ve sıradaki
          // TÜM 401'ler bir daha asla çözülmeyen bir kuyruğa yığılır (sessiz kilitlenme).
          isRefreshing = false;
          processQueue(error, null);
          await SecureStore.deleteItemAsync('traktAccessToken');
          await SecureStore.deleteItemAsync('traktRefreshToken');
          logError('traktClient.401.noRefreshToken', error);
          notifySessionExpired();
          return Promise.reject(error);
        }

        try {
          console.log('Trakt API 401 hatası. Refresh Token ile yeni token alınıyor...');
          // Client Secret burada değil, server.js'teki /api/trakt proxy'sinde kullanılır.
          const data = await refreshTraktToken(refreshToken, 'urn:ietf:wg:oauth:2.0:oob');
          const newAccessToken = data.access_token;
          const newRefreshToken = data.refresh_token;

          await SecureStore.setItemAsync('traktAccessToken', newAccessToken);
          await SecureStore.setItemAsync('traktRefreshToken', newRefreshToken);

          instance.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          // cachedAccessToken güncellenmezse getTraktClient() bir sonraki çağrıda
          // SecureStore'daki (yeni) token'la eşleşmediğini sanıp gereksiz yere
          // yeni bir axios instance + yeni bir response interceptor daha kurar —
          // her token yenilemesinde bir tane daha üst üste yığılır.
          cachedAccessToken = newAccessToken;

          processQueue(null, newAccessToken);
          console.log('Token başarıyla yenilendi ve eski istekler tekrar ediliyor.');
          return instance(originalRequest);
        } catch (refreshError) {
          console.error('Refresh Token yenilenemedi, oturum kapatılıyor:', refreshError);
          processQueue(refreshError, null);
          await SecureStore.deleteItemAsync('traktAccessToken');
          await SecureStore.deleteItemAsync('traktRefreshToken');
          logError('traktClient.401.refreshFailed', refreshError);
          notifySessionExpired();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
      
      // 429 Too Many Requests (Rate Limit) Koruması
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2500;
        console.warn(`[Trakt API] 429 Rate Limit aşıldı. ${delay}ms sonra tekrar denenecek...`);
        
        return new Promise(resolve => setTimeout(resolve, delay)).then(() => {
          return instance(originalRequest);
        });
      }

      return Promise.reject(error);
    }
  );

  cachedInstance = instance;
  return instance;
};



































// --- MOVIE DETAYLARI ---




// --- PUANLAMA (RATING) SÄ°STEMÄ° ---




// --- GELÄ°ÅMÄ°Å SEÃ‡ENEKLER (ADVANCED OPTIONS) ---













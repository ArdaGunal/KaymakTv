import axios from 'axios';
import * as SecureStore from '../../utils/secureStorage';
import i18n from '../../locales/index';
import { refreshTraktToken } from './auth';
import { logError } from '../../utils/errorLog';
import { getCircuitBreaker, normalizeEndpointKey } from '../../utils/circuitBreaker';
import { calculateBackoffDelay, wait } from '../../utils/exponentialBackoff';
import { recordApiLatency } from '../../utils/metrics';

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

  // Devre kesici (Circuit Breaker): bir endpoint art arda başarısız oluyorsa
  // (bkz. response interceptor'daki onFailure çağrıları) bu istek AĞA HİÇ
  // GÖNDERİLMEDEN anında reddedilir — "OPEN sırasında reject immediately,
  // queue'ye gitme" davranışı. Her istek başlarken kendi endpoint anahtarını
  // config'e işler ki response interceptor'da hangi breaker'ın güncelleneceği
  // (başarı/başarısızlık) bilinsin.
  instance.interceptors.request.use((config) => {
    const key = normalizeEndpointKey(config.url || '');
    if (!getCircuitBreaker(key).canRequest()) {
      return Promise.reject(
        Object.assign(new Error(`[CircuitBreaker] '${key}' endpoint'i geçici olarak devre dışı — istek gönderilmedi.`), {
          isCircuitBreakerRejection: true,
        })
      );
    }
    (config as any)._circuitBreakerKey = key;
    // Faz 7 — API gecikme (latency) ölçümü: isteğin gerçekten ağa çıktığı an
    // damgalanır. 429/401 retry'ları `instance(originalRequest)` ile bu
    // interceptor'a TEKRAR uğrar, yani her deneme kendi gerçek süresiyle ayrı
    // ayrı ölçülür (retry'ları içeren yanıltıcı bir toplam süre değil).
    (config as any)._metricsStartTime = Date.now();
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      const key = (response.config as any)?._circuitBreakerKey;
      if (key) getCircuitBreaker(key).onSuccess();
      const startTime = (response.config as any)?._metricsStartTime;
      if (key && startTime) recordApiLatency(key, Date.now() - startTime);
      return response;
    },
    async (error) => {
      // Devre kesici tarafından ağa hiç gönderilmeden reddedilen istekler:
      // burada tekrar bir başarısızlık olarak SAYILMAZ (zaten sayılmıştı),
      // sadece zincire olduğu gibi iletilir.
      if (error?.isCircuitBreakerRejection) {
        return Promise.reject(error);
      }

      const originalRequest = error.config;
      const breakerKey = originalRequest ? normalizeEndpointKey(originalRequest.url || '') : null;

      // Yanıt gerçekten geldiyse (401/429/5xx/4xx fark etmez — istek ağa çıkıp
      // bir cevap aldı) bu da bir gecikme veri noktasıdır. Yanıtsız ağ hataları
      // (timeout/DNS/bağlantı kopması) burada SAYILMAZ — o durumda ölçülen süre
      // "gerçek API gecikmesi" değil, taleple ilgisiz bir bekleme süresidir.
      if (breakerKey && originalRequest?._metricsStartTime && error.response) {
        recordApiLatency(breakerKey, Date.now() - originalRequest._metricsStartTime);
      }

      // 401 hatası ve henüz tekrar denenmemişse
      if (error.response?.status === 401 && !originalRequest._retry) {
        // KRİTİK: 401 de dahil sunucudan HERHANGİ bir yanıt gelmesi, devre
        // kesici açısından "endpoint erişilebilir" demektir (satır ~245
        // civarındaki 429/5xx DIŞI durumlar için uygulanan kuralla BİREBİR
        // aynı mantık) — 401 kimlik doğrulama sorunudur, endpoint sağlığıyla
        // ilgisizdir. Bu çağrı, aşağıdaki 401 bloğunun DÖRT ayrı çıkış
        // noktasının (kuyruğa alma, refresh-token-yok, refresh başarılı/
        // başarısız) HEPSİNİ tek seferde kapsayacak şekilde bilinçli olarak
        // bloğun EN BAŞINA konuldu. AKSİ HALDE: devre `HALF_OPEN` durumunda
        // (30sn'lik `OPEN` süresi dolup "tek deneme" moduna geçmişken) iken
        // o tek yoklama isteği tam bu anda 401 alırsa (token süresi dolmuşsa
        // — ki refresh akışıyla aynı anda oldukça olası bir senaryo),
        // `canRequest()`'in işlediği `halfOpenProbeInFlight` bayrağı hiçbir
        // zaman temizlenmez (yalnızca `onSuccess()`/`onFailure()` temizler)
        // — breaker sonsuza dek `HALF_OPEN`'da (yeni istekleri reddeder
        // halde) TAKILI KALIR ve o endpoint, token yenilense bile, uygulama
        // yeniden başlatılana kadar KALICI OLARAK engellenirdi.
        if (breakerKey) getCircuitBreaker(breakerKey).onSuccess();

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
          logError('traktClient.401.noRefreshToken', error, { endpoint: breakerKey || 'unknown' });
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
          logError('traktClient.401.refreshFailed', refreshError, { endpoint: breakerKey || 'unknown' });
          notifySessionExpired();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
      
      // 429 Too Many Requests (Rate Limit) Koruması — üstel geri çekilme (jitter'lı)
      // + devre kesici. ESKİ DAVRANIŞ: sabit 2.5s bekleyip SINIRSIZ tekrar
      // deniyordu — endpoint kalıcı olarak 429 dönüyorsa istemci sonsuza kadar
      // aynı hızda vurmaya devam ederdi. Artık her 429'da breaker'a bir
      // başarısızlık işlenir; art arda 5 başarısızlık sonrası breaker OPEN'a
      // geçer ve bir sonraki deneme (request interceptor'da) ağa hiç
      // gönderilmeden anında reddedilir — bu döngü kendiliğinden durur.
      if (error.response?.status === 429) {
        if (breakerKey) getCircuitBreaker(breakerKey).onFailure();

        const attempt = ((originalRequest._retryAttempt = (originalRequest._retryAttempt || 0) + 1));
        const retryAfter = error.response.headers?.['retry-after'];
        const delay = calculateBackoffDelay(attempt - 1, retryAfter);
        console.warn(`[Trakt API] 429 Rate Limit aşıldı (deneme ${attempt}). ${delay}ms sonra tekrar denenecek...`);

        await wait(delay);
        return instance(originalRequest);
      }

      // 5xx sunucu hatası veya yanıtsız ağ hatası (timeout, bağlantı kopması):
      // 429 gibi otomatik tekrar denenmez (çağıranın kendi catch'i yönetir),
      // ama devre kesiciye "bu endpoint sağlıksız" sinyali işlenir.
      if (breakerKey) {
        if (!error.response || error.response.status >= 500) {
          getCircuitBreaker(breakerKey).onFailure();
        } else {
          // Sunucudan bir yanıt geldi (401/400/403/404 gibi 429/5xx DIŞI bir
          // durum) — endpoint erişilebilir demektir. HALF_OPEN'daki "tek
          // deneme" burada sonuçlanmış sayılmazsa, `canRequest()`'in işlediği
          // probe bayrağı hiç temizlenmez ve breaker sonsuza dek HALF_OPEN'da
          // (yeni istekleri reddeder halde) takılı kalırdı.
          getCircuitBreaker(breakerKey).onSuccess();
        }
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













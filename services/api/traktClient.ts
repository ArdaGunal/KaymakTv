import axios from 'axios';
import * as SecureStore from '../../utils/secureStorage';
import { eskiAnahtariTasi, traktOturumunuYenile } from '../auth/traktOturumu';
import { logError, logWarning } from '../../utils/errorLog';
import { getCircuitBreaker, normalizeEndpointKey } from '../../utils/circuitBreaker';
import { calculateBackoffDelay, wait } from '../../utils/exponentialBackoff';
import { recordApiLatency } from '../../utils/metrics';
import { recordPerfMark } from '../../utils/perfLog';

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

/**
 * Worker'ın `mintSessionToken`'ının ürettiği KaymakTV oturum token'ının öneki
 * (bkz. Worker `KAYMAK_SESSION_PREFIX` / `resolveCallerWithReason`).
 *
 * 🔴 NEDEN BURADA GEREKLİ: Google-only kullanıcıda (`create_new`, Madde 221)
 * `traktAccessToken` YUVASINDA bir Trakt token'ı DEĞİL, bu önekli Kaymak
 * oturum token'ı durur — bu, Worker'ın bilinçli tasarımı (12 yazma ucu tek
 * opak string görsün diye). Ama Trakt bu değeri tanımaz.
 *
 * Bunu `Authorization: Bearer` olarak Trakt'a göndermek yalnızca kişisel
 * uçları değil, KİMLİK GEREKTİRMEYEN PUBLIC UÇLARI DA kırıyordu: Trakt
 * geçersiz bir bearer görünce isteği komple 401'liyor. Canlı testte
 * (2026-08-22) `GET /shows/trending` — misafirin sorunsuz çektiği uç — bu
 * yüzden 401 dönüyordu; Keşfet, arama ve dizi/film detay sayfaları Google-only
 * kullanıcı için tamamen ölüydü. Yani token'ın VARLIĞI, kullanıcıyı
 * misafirden DAHA KÖTÜ duruma sokuyordu.
 *
 * Öneke bakmak `traktAuthProvider` bayrağını okumaya tercih edildi: değer
 * kendi kendini tanımlıyor, ekstra bir async okuma gerektirmiyor ve bayrak
 * bir şekilde bayatlarsa/yazılamazsa bile doğru davranıyor.
 */
const KAYMAK_SESSION_PREFIX = 'kaymak_session_v1.';

export const isKaymakSessionToken = (token: string | null | undefined): boolean =>
  typeof token === 'string' && token.startsWith(KAYMAK_SESSION_PREFIX);

// Kasa koptuysa ya da oturum bittiyse (ör. kullanıcı Trakt'tan uygulamayı iptal etti)
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

// onSessionExpired'ın simetriği: token BAŞARIYLA yenilendiğinde de aynı
// sorun var — bu dosya SecureStore'u ve kendi `cachedAccessToken`'ını
// güncelliyor ama AuthContext'teki React state'i (accessToken) hiç
// güncellenmiyordu. Sonuç: `useAuth().accessToken`'ı okuyup Worker'a
// (feedSync, feedPrivacy) doğrudan gönderen kod yolları, arka planda sessiz
// bir yenileme olduktan SONRA bile hâlâ ESKİ (artık gerçekten geçersiz)
// token'ı göndermeye devam ediyordu — Trakt'a giden normal istekler
// interceptor sayesinde otomatik tekrar deneniyordu ama bizim Worker'a giden
// isteklerimiz bu mekanizmadan hiç geçmiyor, doğrudan Trakt'a çarpıp 401
// alıyorlardı (canlı testte bulundu).
type TokenRefreshedListener = (token: string) => void;
let tokenRefreshedListeners: TokenRefreshedListener[] = [];

export const onTokenRefreshed = (listener: TokenRefreshedListener) => {
  tokenRefreshedListeners.push(listener);
  return () => {
    tokenRefreshedListeners = tokenRefreshedListeners.filter((l) => l !== listener);
  };
};

const notifyTokenRefreshed = (token: string) => {
  tokenRefreshedListeners.forEach((listener) => {
    try {
      listener(token);
    } catch (e) {
      console.error('[TokenRefreshed Listener Error]', e);
    }
  });
};

let cachedInstance: any = null;
let cachedAccessToken: string | null = null;

/** Yeni erişim anahtarı: sonraki istek yeni başlıkla kurulan istemciyi alır, dinleyiciler haberdar olur. */
const erisimiUygula = (erisim: string) => {
  cachedInstance = null;
  cachedAccessToken = null;
  notifyTokenRefreshed(erisim);
};

let yenilemeUcusu: Promise<string> | null = null;
let gecisUcusu: Promise<void> | null = null;

const yenileVeUygula = async (reddedilen?: string | null): Promise<string> => {
  // Y23: Google-only kullanıcının Trakt oturumu yok; yalnızca bu TEK istek başarısız sayılır.
  const authProvider = await SecureStore.getItemAsync('traktAuthProvider');
  if (authProvider === 'google') {
    console.log('[traktClient] Google-only oturum: Trakt isteği atlandı, çıkış tetiklenmedi.');
    throw new Error('Google-only oturumda Trakt yenilemesi yok.');
  }
  const onceki = reddedilen ?? (await SecureStore.getItemAsync('traktAccessToken'));
  // Denetim B3: açılış taşıması sürerken aynı yenileme anahtarıyla ikinci istek gitmez (biri reddedilip kişiyi çıkışa atardı).
  if (gecisUcusu) await gecisUcusu;
  const sonuc = await traktOturumunuYenile(onceki);
  if (sonuc.tur === 'tamam') {
    erisimiUygula(sonuc.erisim);
    return sonuc.erisim;
  }
  if (sonuc.tur === 'gecici') {
    // İnternet / Worker / Trakt sorunu: oturum KAPANMAZ, yalnız bu istek başarısız olur.
    logWarning('traktClient.yenileme.gecici', 'Yenileme ertelendi, oturum korunuyor');
    throw new Error('Trakt oturumu şu an yenilenemedi.');
  }
  const err = new Error('Trakt oturumu sona erdi.');
  await SecureStore.deleteItemAsync('traktAccessToken');
  await SecureStore.deleteItemAsync('traktRefreshToken');
  await SecureStore.deleteItemAsync('kaymakOturum');
  logError('traktClient.oturumBitti', err);
  notifySessionExpired();
  throw err;
};

/**
 * Erişim anahtarını kasadan yeniler (401 interceptor'ı, Worker'a giden yazma yolları, aktarım).
 * TEK UÇUŞ: aynı anda gelen çağrılar aynı sonucu bekler (bkz. docs/HISTORY.md Madde 133).
 * Sekmeler ve cihazlar arası tek Trakt isteğini Worker'daki kilit sağlar (plan §4.5).
 * `reddedilen`: isteğin gerçekten gönderdiği anahtar; yoksa o an diskte olan sayılır.
 */
export const refreshAccessToken = (reddedilen?: string | null): Promise<string> => {
  if (!yenilemeUcusu) {
    yenilemeUcusu = yenileVeUygula(reddedilen).finally(() => {
      yenilemeUcusu = null;
    });
  }
  return yenilemeUcusu;
};

/** Açılışta bir kez: eski cihazdaki yenileme anahtarı kasaya taşınır. Başarısızlık oturumu KAPATMAZ. */
export const eskiCihazGecisi = (): Promise<void> => {
  if (!gecisUcusu) {
    gecisUcusu = eskiAnahtariTasi()
      .then((sonuc) => {
        if (sonuc?.tur === 'tamam') erisimiUygula(sonuc.erisim);
      })
      .catch((e) => console.warn('[traktClient] Eski cihaz geçişi ertelendi:', e))
      .finally(() => {
        gecisUcusu = null;
      });
  }
  return gecisUcusu;
};

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

  // Kaymak oturum token'ı Trakt'a GÖNDERİLMEZ (bkz. KAYMAK_SESSION_PREFIX'in
  // başlığı): Trakt onu tanımaz ve geçersiz bir bearer yüzünden PUBLIC uçları
  // bile 401'ler. Başlığı hiç eklemeyerek Google-only kullanıcı, public Trakt
  // uçlarında misafirle BİREBİR aynı (çalışan) davranışı alır; kişisel uçlar
  // zaten onun için anlamsız ve 401 dönmeye devam eder — bu BEKLENEN, Y23'ün
  // yakalayıcısı bunu çıkışa çevirmiyor.
  if (accessToken && !isKaymakSessionToken(accessToken)) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // KRİTİK: `timeout` eskiden HİÇ yoktu — projedeki DİĞER tüm HTTP istemcileri
  // (feedPrivacy.ts, feedSync.ts, accountDeletion.ts, services/api/feedback.ts)
  // 10-15sn timeout kullanırken, uygulamanın TÜM Trakt trafiğini taşıyan bu
  // istemci korumasızdı. Sonuç: ağ askıda kalırsa (uykuya geçiş, zayıf sinyal)
  // istek SÜRESİZ bekler — `requestQueue`'nun eşzamanlılık sınırı (3) dolarsa
  // kuyruktaki HER ŞEY görünürde "donar" (asıl istekler 5 dakikalık deadline'a
  // kadar hiç ilerlemez). Devre kesici de bu senaryoda hiç devreye giremez,
  // çünkü `onFailure()` yalnızca istek GERÇEKTEN başarısız/timeout olduğunda
  // çağrılır — performans raporunda görülen ~130sn'lik uç değerler (bkz.
  // docs/HISTORY.md Madde 106) bu boşluğun izidir. 20sn: normal bir Trakt
  // isteğinin (p99 ~5sn) kat kat üstünde, ama kullanıcıyı süresiz beklemekten
  // kurtaracak kadar kısa.
  const instance = axios.create({
    baseURL: TRAKT_API_URL,
    headers,
    timeout: 20000,
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
      if (key && startTime) {
        const durationMs = Date.now() - startTime;
        recordApiLatency(key, durationMs);
        // Geliştirici Paneli'nin Performans sekmesi TEKİL istekleri gösterir —
        // `recordApiLatency` (yukarıda) yalnızca saatlik histogramı besler,
        // hangi ÇAĞRININ ne kadar sürdüğünü kaybeder. İkisi AYNI ölçümden
        // türer, birbirini geçersiz kılmaz. `response.status` burada zaten
        // elde var — durum kodu rozetinin (StatusBadge) tek veri kaynağı.
        recordPerfMark(key, 'network', durationMs, response.status);
      }
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
        const durationMs = Date.now() - originalRequest._metricsStartTime;
        recordApiLatency(breakerKey, durationMs);
        recordPerfMark(breakerKey, 'network', durationMs, error.response.status);
      }

      // 401 hatası ve henüz tekrar denenmemişse
      if (error.response?.status === 401 && !originalRequest._retry) {
        // KRİTİK: 401 de dahil sunucudan HERHANGİ bir yanıt gelmesi, devre
        // kesici açısından "endpoint erişilebilir" demektir (satır ~245
        // civarındaki 429/5xx DIŞI durumlar için uygulanan kuralla BİREBİR
        // aynı mantık) — 401 kimlik doğrulama sorunudur, endpoint sağlığıyla
        // ilgisizdir. Bu çağrı, aşağıdaki 401 bloğunun BÜTÜN çıkış noktalarını
        // kapsayacak şekilde bilinçli olarak bloğun EN BAŞINA konuldu. AKSİ HALDE: devre `HALF_OPEN` durumunda
        // (30sn'lik `OPEN` süresi dolup "tek deneme" moduna geçmişken) iken
        // o tek yoklama isteği tam bu anda 401 alırsa (token süresi dolmuşsa
        // — ki refresh akışıyla aynı anda oldukça olası bir senaryo),
        // `canRequest()`'in işlediği `halfOpenProbeInFlight` bayrağı hiçbir
        // zaman temizlenmez (yalnızca `onSuccess()`/`onFailure()` temizler)
        // — breaker sonsuza dek `HALF_OPEN`'da (yeni istekleri reddeder
        // halde) TAKILI KALIR ve o endpoint, token yenilense bile, uygulama
        // yeniden başlatılana kadar KALICI OLARAK engellenirdi.
        if (breakerKey) getCircuitBreaker(breakerKey).onSuccess();

        originalRequest._retry = true;

        // 🔴 KİMLİKSİZ İSTEK (misafir) — bu hata sınıfının DÖRDÜNCÜ hâli,
        // 2026-08-30'da native'de yakalandı. Ortada hiç `accessToken` yoksa
        // istek zaten `Authorization` başlığı OLMADAN gitmiştir; Trakt'ın
        // kişisel bir uca (`/users/me` gibi) döndürdüğü 401 "OTURUM SONA
        // ERDİ" DEĞİL, "bu uç kimlik ister" demektir. Oysa eski kod
        // misafiri gerçekten çıkışa alıyordu: `notifySessionExpired()` →
        // `AuthContext` `isGuest`'i false yapıyor → `(protected)/_layout.tsx`
        // `<Redirect href="/" />` → kullanıcı dizi incelerken KARŞILAMA
        // (vitrin) EKRANINA fırlıyordu.
        //
        // ⚠️ NEDEN BURADA, çağrı yerinde DEĞİL: aynı hata daha önce ÜÇ kez
        // tek tek çağrı yerlerinde yamandı (`useMyTraktProfile.ts` başlığı
        // bu tarihçeyi anlatıyor: misafir koruması + `useFeedPrivacy` +
        // Y23/Google-only). Her yeni "ben kimim" çağrısı hatayı geri
        // getiriyor — nitekim `getMySupabaseUserId → getMyTraktSlug`
        // zinciri dizi/film detay sayfasında tam olarak bunu yaptı.
        // Koruma artık TEK ve DOĞRU yerde: 401'i yorumlayan katmanda.
        //
        // Web'de bu hata GÖRÜNMÜYORDU: tarayıcı `api.trakt.tv/users/me`
        // preflight'ını CORS'a takıyor, `error.response` hiç oluşmuyor ve
        // bu blok çalışmıyor. Native'de CORS yok — 401 gerçekten geliyor.
        const currentAccessToken = await SecureStore.getItemAsync('traktAccessToken');
        if (!currentAccessToken) {
          console.log('[traktClient] Kimliksiz (misafir) istek 401 aldı — oturum kapatılmadı.');
          return Promise.reject(error);
        }

        // Y23: Google-only kullanıcının Trakt oturumu yok — oturum kapatılmaz, bu istek başarısız sayılır.
        const authProvider = await SecureStore.getItemAsync('traktAuthProvider');
        if (authProvider === 'google') {
          console.log('[traktClient] Google-only oturum: Trakt isteği atlandı, çıkış tetiklenmedi.');
          return Promise.reject(error);
        }

        try {
          const yeniErisim = await refreshAccessToken(String(originalRequest.headers?.['Authorization'] ?? '').replace(/^Bearer /, '') || null);
          originalRequest.headers['Authorization'] = `Bearer ${yeniErisim}`;
          return instance(originalRequest);
        } catch (yenilemeHatasi) {
          return Promise.reject(yenilemeHatasi);
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
        // Akışı bozmaz (otomatik tekrar denenir) ama Geliştirici Paneli'nin
        // "Uyarı" sayacı için anlamlı — kalıcı hata DEĞİL, gerçek bir uyarı.
        logWarning('traktClient.429', `Rate limit — deneme ${attempt}, ${delay}ms sonra tekrar denenecek`, {
          endpoint: breakerKey || 'unknown',
        });

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

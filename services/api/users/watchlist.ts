import axios from 'axios';
import { getTraktClient } from '../traktClient';
import * as SecureStore from '../../../utils/secureStorage';

export const getWatchlistShows = async () => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/sync/watchlist/shows?extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getWatchlistShows):', error);
    throw error;
  }
};

export const getWatchlistMovies = async () => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/sync/watchlist/movies?extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getWatchlistMovies):', error);
    throw error;
  }
};

export const addToWatchlistTrakt = async (id: number, type: 'show' | 'movie') => {
  try {
    const client = await getTraktClient();
    const body = {
      [type === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: id } }]
    };
    const response = await client.post('/sync/watchlist', body);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (addToWatchlistTrakt):', error);
    throw error;
  }
};

export const removeFromWatchlistTrakt = async (id: number, type: 'show' | 'movie') => {
  try {
    const client = await getTraktClient();
    const body = {
      [type === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: id } }]
    };
    const response = await client.post('/sync/watchlist/remove', body);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (removeFromWatchlistTrakt):', error);
    throw error;
  }
};

// NEDEN client-side getTraktClient() (direkt Trakt'a) DEĞİL: `/users/hidden/*`
// tarayıcıdan (web) doğrudan çağrıldığında Trakt CORS preflight'ını
// reddediyor (Access-Control-Allow-Origin başlığı gelmiyor) — diğer Trakt uç
// noktalarının çoğu bu sorunu yaşamıyor, yalnızca bu ailede gözlemlendi.
// server.js'teki /api/trakt (auth) ve /api/tmdb ile AYNI proxy deseni
// uygulandı: sunucu-sunucu isteği CORS'a hiç tabi değil.
//
// ⚠️ Platform.OS kontrolü BİLİNÇLİ OLARAK EKLENMEDİ (bkz. docs/HISTORY.md
// Madde 91) — hem native hem web aynı /api/trakt-proxy yolunu, aynı
// EXPO_PUBLIC_API_URL mutlak/göreli seçim mantığıyla kullanıyor.
const TRAKT_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt-proxy`
  : '/api/trakt-proxy';

// NOT: bunlar `/users/hidden/*` ailesine gittiği için yukarıdaki notla aynı
// tarayıcı CORS reddine takılıyor — proxy üzerinden gönderilir, token-header
// deseni birebir aynı.
export const hideItemTrakt = async (id: number, type: 'show' | 'movie') => {
  try {
    const accessToken = await SecureStore.getItemAsync('traktAccessToken');
    const body = {
      [type === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: id } }]
    };
    // Sadece dizilerin progress'i gizlenebilir (Trakt API dökümantasyonuna göre film progressi yok, genelde shows is hidden)
    const section = type === 'show' ? 'progress_watched' : 'calendar';
    const response = await axios.post(TRAKT_PROXY_URL, body, {
      params: { endpoint: `/users/hidden/${section}` },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (hideItemTrakt):', error);
    throw error;
  }
};

export const unhideItemTrakt = async (id: number, type: 'show' | 'movie') => {
  try {
    const accessToken = await SecureStore.getItemAsync('traktAccessToken');
    const body = {
      [type === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: id } }]
    };
    const section = type === 'show' ? 'progress_watched' : 'calendar';
    const response = await axios.post(TRAKT_PROXY_URL, body, {
      params: { endpoint: `/users/hidden/${section}/remove` },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (unhideItemTrakt):', error);
    throw error;
  }
};

// Trakt'ın `/users/hidden/:section` uç noktası SAYFALANDIRILMIŞTIR (resmi
// dokümanda page/limit destekli). ESKİ DAVRANIŞ: tek istek + `limit=200`, sayfa
// döngüsü YOK. Bu, "Gizle" yalnızca nadiren kullanılan bir ek özellikken
// görünmeyen ama artık KRİTİK olan bir hata: gizleme uygulamanın tek "Bırak"
// mekanizması olduğundan liste zamanla kolayca 200'ü aşar ve 200. sıradan
// sonraki her dizi/film `hiddenShowIds`'e HİÇ girmez — kullanıcının bıraktığı
// yapımlar sessizce takip panosuna geri döner ve "Gizlenenler/Bırakılanlar"
// filtresinden kaybolur. Artık tüm sayfalar, `history.ts`'teki getWatchedShows
// ile aynı `x-pagination-page-count` başlığı desenine göre çekilir.
const HIDDEN_PAGE_LIMIT = 100;
// Güvenlik tavanı: bozuk/beklenmedik bir başlık yüzünden sonsuz döngüye
// girilmesin (10.000 gizli öğe gerçekçi her kullanıcıyı fazlasıyla kapsar).
const HIDDEN_MAX_PAGES = 100;

const getAllHiddenItems = async (section: 'progress_watched' | 'calendar', type: 'show' | 'movie') => {
  const accessToken = await SecureStore.getItemAsync('traktAccessToken');
  // Token URL/query string'e DEĞİL, isteğin kendi Authorization başlığına
  // konur — sunucu erişim loglarında kalıcı iz bırakmaması için.
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  // CDN önbellek kırıcı (bkz. docs/HISTORY.md Madde 9/102) — `_` her çağrıda
  // benzersiz olmalı ki Trakt'ın CDN'i bayat bir yanıtı önbellekten dönmesin.
  const fetchPage = (page: number) =>
    axios.get(TRAKT_PROXY_URL, {
      params: { endpoint: `/users/hidden/${section}`, type, page, limit: HIDDEN_PAGE_LIMIT, _: Date.now() },
      headers,
    });

  const first = await fetchPage(1);
  const allData: any[] = [...first.data];

  const totalPagesStr = first.headers['x-pagination-page-count'];
  const parsedPages = totalPagesStr ? parseInt(totalPagesStr, 10) : 1;
  const totalPages = Math.min(Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : 1, HIDDEN_MAX_PAGES);

  // Sıralı (paralel değil): gizli listeler tipik olarak küçüktür ve bu istek
  // zaten en düşük öncelikli arka plan turunda çalışır — Trakt'ın rate limit'ini
  // zorlamaya değmez.
  for (let page = 2; page <= totalPages; page++) {
    const response = await fetchPage(page);
    allData.push(...response.data);
  }

  return allData;
};

/** "İlerlemeyi Gizle" (= uygulamadaki "Bırak") ile gizlenmiş dizilerin TAM
 * listesi — senkron sırasında `hiddenShowIds`'i güncel tutmak ve kütüphanenin
 * "Gizlenenler/Bırakılanlar" filtresini beslemek için kullanılır. İzleme
 * geçmişine (watched/history) HİÇ dokunmaz, yalnızca hangi dizilerin
 * "ilerleme/devam et" görünümünden gizlendiğini bildirir. */
export const getHiddenShows = async () => {
  try {
    return await getAllHiddenItems('progress_watched', 'show');
  } catch (error) {
    console.error('Trakt API Hatası (getHiddenShows):', error);
    throw error;
  }
};

/** Filmler için `progress_watched` bölümü YOKTUR (Trakt'ta filmlerin ilerlemesi
 * olmaz; o bölüm yalnızca show/season kabul eder) — bu yüzden filmler
 * `hideItemTrakt`/`unhideItemTrakt` ile `calendar` bölümünden gizlenir ve
 * burada da oradan okunur. `getHiddenShows` ile aynı sözleşme. */
export const getHiddenMovies = async () => {
  try {
    return await getAllHiddenItems('calendar', 'movie');
  } catch (error) {
    console.error('Trakt API Hatası (getHiddenMovies):', error);
    throw error;
  }
};

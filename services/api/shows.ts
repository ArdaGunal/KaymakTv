import axios from 'axios';
import { getTraktClient, applyTranslation } from './traktClient';
import { fetchCatalogOrFallback } from './traktCatalogClient';
import i18n from '../../locales/index';
import { CACHE_TTL } from '../../utils/cacheTTL';

// Sayfa başına önbellek: Keşfet ekranı her mount'ta (kalıcı bir store'a
// yazılmadığından) baştan `getTrendingShows(1, ...)` çağırıyordu — kullanıcı
// sekmeye her giriş çıkışında aynı trend listesi yeniden ağdan çekiliyordu
// (bkz. performans raporu: `shows/trending` tek oturumda 30 çağrı). Trend
// tabloları dakikalar içinde önemli ölçüde değişmediğinden kısa bir TTL
// yeterli; `force` (pull-to-refresh, dil değişimi) önbelleği bilerek atlar.
const trendingShowsCache = new Map<number, { data: any; fetchedAt: number }>();

// `getTraktClient()` doğrudan `https://api.trakt.tv`'ye gider — tarayıcıdan
// çağrıldığında Trakt CORS preflight'ını reddediyor (`/users/hidden/*`
// ailesiyle AYNI sorun, bkz. services/api/users/watchlist.ts). Bu uç
// kimlik gerektirmeyen public veri döndürdüğünden `/api/trakt-proxy` +
// CORS-güvenli köprü deseni burada da uygulandı (server/security.js'teki
// beyaz listeye eklendi); hem native hem web aynı yolu kullanır.
const TRAKT_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt-proxy`
  : '/api/trakt-proxy';

export const getTrendingShows = async (page = 1, limit = 7, force = false) => {
  const cached = trendingShowsCache.get(page);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL.SHORT) {
    return cached.data;
  }
  try {
    const response = await axios.get(TRAKT_PROXY_URL, {
      params: { endpoint: '/shows/trending', extended: 'full', page, limit },
    });
    trendingShowsCache.set(page, { data: response.data, fetchedAt: Date.now() });
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getTrendingShows):', error);
    throw error;
  }
};

export const getShowSummary = async (showId: number) => {
  const lang = i18n.language === 'tr' ? 'tr' : 'en';
  try {
    // 🆕 L7+: geçitten geçer, geçit çalışmazsa eski yola düşer
    // (`fetchCatalogOrFallback` sözleşmesi). `translations` query'nin
    // parçası olduğu için ÖNBELLEK ANAHTARI DİLE GÖRE AYRILIR
    // (server/lazyfetch/key.js) — tr ve en ayrı dosyalar.
    const ham = await fetchCatalogOrFallback(
      'L7/getShowSummary',
      `/shows/${showId}`,
      { extended: 'full', translations: lang },
      async () => (await (await getTraktClient()).get(`/shows/${showId}?extended=full&translations=${lang}`)).data,
      { showId: String(showId) }
    );
    // 🔴 Çeviri İKİ yola da uygulanır — geçit ham Trakt yanıtını döner,
    // eski yol da artık ham dönüyor. Dönüşüm tek yerde.
    return applyTranslation(ham, lang);
  } catch (error) {
    console.error(`Trakt API Hatasi (getShowSummary - ${showId}):`, error);
    throw error;
  }
};

export const getShowSeasons = async (showId: number) => {
  // 🆕 LazyFetch L7: bu çağrı KATALOG verisidir (kimseye ait değil) ve
  // L7'ye kadar Pi'yi hiç görmüyordu. Ölçülen kazanç: 610 ms → 2,4 ms.
  // L7+ turunda elle yazılmış geçit+geri düşüş bloğu
  // `fetchCatalogOrFallback`'e taşındı (8 uçta tek kopya, AI_RULES §2.5) —
  // davranış birebir aynı, gerekçelerin tamamı o dosyada.
  try {
    return await fetchCatalogOrFallback(
      'L7/getShowSeasons',
      `/shows/${showId}/seasons`,
      { extended: 'full,episodes' },
      async () => (await (await getTraktClient()).get(`/shows/${showId}/seasons?extended=full,episodes`)).data,
      { showId: String(showId) }
    );
  } catch (error) {
    console.error(`Trakt API Hatasi (getShowSeasons - ${showId}):`, error);
    throw error;
  }
};

export const getShowCast = async (showId: number) => {
  try {
    return await fetchCatalogOrFallback(
      'L7/getShowCast',
      `/shows/${showId}/people`,
      {},
      async () => (await (await getTraktClient()).get(`/shows/${showId}/people`)).data,
      { showId: String(showId) }
    );
  } catch (error) {
    console.error(`Trakt API Hatasi (getShowCast - ${showId}):`, error);
    throw error;
  }
};

export const getRelatedShows = async (showId: number) => {
  try {
    return await fetchCatalogOrFallback(
      'L7/getRelatedShows',
      `/shows/${showId}/related`,
      { extended: 'full', limit: '10' },
      async () => (await (await getTraktClient()).get(`/shows/${showId}/related?extended=full&limit=10`)).data,
      { showId: String(showId) }
    );
  } catch (error) {
    console.error(`Trakt API Hatasi (getRelatedShows - ${showId}):`, error);
    throw error;
  }
};

export const getEpisodeDetail = async (showId: number, season: number, episode: number) => {
  const lang = i18n.language === 'tr' ? 'tr' : 'en';
  try {
    const ham = await fetchCatalogOrFallback(
      'L7/getEpisodeDetail',
      `/shows/${showId}/seasons/${season}/episodes/${episode}`,
      { extended: 'full', translations: lang },
      async () =>
        (await (await getTraktClient()).get(
          `/shows/${showId}/seasons/${season}/episodes/${episode}?extended=full&translations=${lang}`
        )).data,
      { showId: String(showId), bolum: `S${season}E${episode}` }
    );
    return applyTranslation(ham, lang);
  } catch (error) {
    console.error(`Trakt API Hatasi (getEpisodeDetail - ${showId} S${season}E${episode}):`, error);
    throw error;
  }
};

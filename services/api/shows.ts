import axios from 'axios';
import { getTraktClient, applyTranslation } from './traktClient';
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
  try {
    const client = await getTraktClient();
    const lang = i18n.language === 'tr' ? 'tr' : 'en';
    const response = await client.get(`/shows/${showId}?extended=full&translations=${lang}`);
    return applyTranslation(response.data, lang);
  } catch (error) {
    console.error(`Trakt API HatasÃ„Â± (getShowSummary - ${showId}):`, error);
    throw error;
  }
};

export const getShowSeasons = async (showId: number) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/shows/${showId}/seasons?extended=full,episodes`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API HatasÃ„Â± (getShowSeasons - ${showId}):`, error);
    throw error;
  }
};

export const getShowCast = async (showId: number) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/shows/${showId}/people`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API HatasÃ„Â± (getShowCast - ${showId}):`, error);
    throw error;
  }
};

export const getRelatedShows = async (showId: number) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/shows/${showId}/related?extended=full&limit=10`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API HatasÃ„Â± (getRelatedShows - ${showId}):`, error);
    throw error;
  }
};

export const getEpisodeDetail = async (showId: number, season: number, episode: number) => {
  try {
    const client = await getTraktClient();
    const lang = i18n.language === 'tr' ? 'tr' : 'en';
    const response = await client.get(`/shows/${showId}/seasons/${season}/episodes/${episode}?extended=full&translations=${lang}`);
    return applyTranslation(response.data, lang);
  } catch (error) {
    console.error(`Trakt API HatasÄ± (getEpisodeDetail - ${showId} S${season}E${episode}):`, error);
    throw error;
  }
};

import axios from 'axios';
import { getTraktClient, applyTranslation } from './traktClient';
// 🆕 L7+ — film katalog uçları da Pi'nin önbellekli geçidinden geçiyor.
// Desen ve geri düşüş sözleşmesi shows.ts ile BİREBİR aynı; gerekçeler
// `traktCatalogClient.ts` `fetchCatalogOrFallback` başlığında.
import { fetchCatalogOrFallback } from './traktCatalogClient';
import i18n from '../../locales/index';
import { CACHE_TTL } from '../../utils/cacheTTL';

// bkz. services/api/shows.ts — getTrendingShows'taki aynı önbellek VE
// CORS-proxy gerekçesi (`/api/trakt-proxy`, server/security.js beyaz listesi).
const trendingMoviesCache = new Map<number, { data: any; fetchedAt: number }>();

const TRAKT_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt-proxy`
  : '/api/trakt-proxy';

export const getTrendingMovies = async (page = 1, limit = 7, force = false) => {
  const cached = trendingMoviesCache.get(page);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL.SHORT) {
    return cached.data;
  }
  try {
    const response = await axios.get(TRAKT_PROXY_URL, {
      params: { endpoint: '/movies/trending', extended: 'full', page, limit },
    });
    trendingMoviesCache.set(page, { data: response.data, fetchedAt: Date.now() });
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getTrendingMovies):', error);
    throw error;
  }
};

export const getMovieSummary = async (movieId: number | string) => {
  const lang = i18n.language === 'tr' ? 'tr' : 'en';
  try {
    const ham = await fetchCatalogOrFallback(
      'L7/getMovieSummary',
      `/movies/${movieId}`,
      { extended: 'full', translations: lang },
      async () => (await (await getTraktClient()).get(`/movies/${movieId}?extended=full&translations=${lang}`)).data,
      { movieId: String(movieId) }
    );
    return applyTranslation(ham, lang);
  } catch (error) {
    console.error(`Trakt API Hatasi (getMovieSummary - ${movieId}):`, error);
    throw error;
  }
};

export const getMovieCast = async (movieId: number | string) => {
  try {
    return await fetchCatalogOrFallback(
      'L7/getMovieCast',
      `/movies/${movieId}/people`,
      { extended: 'full' },
      async () => (await (await getTraktClient()).get(`/movies/${movieId}/people?extended=full`)).data,
      { movieId: String(movieId) }
    );
  } catch (error) {
    // 🔴 Bu iki fonksiyonun hata sözleşmesi DİĞERLERİNDEN FARKLI: fırlatmak
    // yerine boş bir varsayılan dönüyorlar (kadro/benzer filmler olmadan da
    // film ekranı açılabilmeli). L7+ bunu DEĞİŞTİRMEDİ.
    console.error(`Trakt API Hatasi (getMovieCast - ${movieId}):`, error);
    return { cast: [] };
  }
};

export const getRelatedMovies = async (movieId: number | string) => {
  try {
    return await fetchCatalogOrFallback(
      'L7/getRelatedMovies',
      `/movies/${movieId}/related`,
      { extended: 'full' },
      async () => (await (await getTraktClient()).get(`/movies/${movieId}/related?extended=full`)).data,
      { movieId: String(movieId) }
    );
  } catch (error) {
    console.error(`Trakt API Hatasi (getRelatedMovies - ${movieId}):`, error);
    return [];
  }
};

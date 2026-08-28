import axios from 'axios';
import { getTraktClient, applyTranslation } from './traktClient';
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
  try {
    const client = await getTraktClient();
    const lang = i18n.language === 'tr' ? 'tr' : 'en';
    const response = await client.get(`/movies/${movieId}?extended=full&translations=${lang}`);
    return applyTranslation(response.data, lang);
  } catch (error) {
    console.error(`Trakt API HatasÄ± (getMovieSummary - ${movieId}):`, error);
    throw error;
  }
};

export const getMovieCast = async (movieId: number | string) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/movies/${movieId}/people?extended=full`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API HatasÄ± (getMovieCast - ${movieId}):`, error);
    return { cast: [] };
  }
};

export const getRelatedMovies = async (movieId: number | string) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/movies/${movieId}/related?extended=full`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API HatasÄ± (getRelatedMovies - ${movieId}):`, error);
    return [];
  }
};

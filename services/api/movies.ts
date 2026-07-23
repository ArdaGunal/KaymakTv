import { getTraktClient, applyTranslation } from './traktClient';
import i18n from '../../locales/index';
import { CACHE_TTL } from '../../utils/cacheTTL';

// bkz. services/api/shows.ts — getTrendingShows'taki aynı önbellek gerekçesi.
const trendingMoviesCache = new Map<number, { data: any; fetchedAt: number }>();

export const getTrendingMovies = async (page = 1, limit = 7, force = false) => {
  const cached = trendingMoviesCache.get(page);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL.SHORT) {
    return cached.data;
  }
  try {
    const client = await getTraktClient();
    const response = await client.get(`/movies/trending?extended=full&page=${page}&limit=${limit}`);
    trendingMoviesCache.set(page, { data: response.data, fetchedAt: Date.now() });
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÄ± (getTrendingMovies):', error);
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

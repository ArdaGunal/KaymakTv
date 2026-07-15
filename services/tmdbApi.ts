import axios from 'axios';
import i18n from '../locales/index';
import { Platform } from 'react-native';
import * as SecureStore from '../utils/secureStorage';

const TMDB_API_URL = 'https://api.themoviedb.org/3';

const API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;

const isWeb = Platform.OS === 'web';
const TMDB_PROXY_URL = process.env.EXPO_PUBLIC_TMDB_PROXY_URL || '/api/tmdb';

// In-Memory Cache (Disk I/O ve SQLite dolumunu önler)
const memoryCache = new Map<string, string | null>();

// Yardımcı Cache fonksiyonları
const getCachedData = async (key: string): Promise<string | null> => {
  if (memoryCache.has(key)) return memoryCache.get(key) || null;
  try {
    const diskValue = await SecureStore.getItemAsync(key);
    if (diskValue) {
      memoryCache.set(key, diskValue);
      return diskValue;
    }
  } catch(e) {}
  return null;
};

const setCachedData = async (key: string, value: string | null) => {
  memoryCache.set(key, value);
  if (value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch(e) {}
  }
};

/**
 * Helper to fetch data from TMDB. 
 * On Mobile & Local Web: Uses direct TMDB API with API_KEY
 * On Production Web: Routes through Netlify proxy to hide API_KEY
 */
const fetchFromTmdb = async (endpoint: string, params: any = {}) => {
  // Misafirlerde ve normal kullanıcılarda ortak sorunu çözmek için
  // Proxy yerine doğrudan TMDB'ye bağlanıyoruz (eğer API anahtarı varsa)
  if (API_KEY) {
    return axios.get(`${TMDB_API_URL}${endpoint}`, { params: { ...params, api_key: API_KEY } });
  } else if (isWeb) {
    return axios.get(TMDB_PROXY_URL, { params: { ...params, endpoint } });
  } else {
    throw new Error('TMDB API Key missing');
  }
};

export const getShowPoster = async (tmdbId: number): Promise<string | null> => {
  if (!isWeb && !API_KEY) {
    console.warn('TMDB API Key eksik!');
    return null;
  }

  const cacheKey = `@tmdb_poster_cache_show_${tmdbId}`;

  const cached = await getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchFromTmdb(`/tv/${tmdbId}`, {
      language: i18n.language === 'tr' ? 'tr-TR' : 'en-US' 
    });

    const posterPath = response.data.poster_path;
    
    if (posterPath) {
      const fullUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
      await setCachedData(cacheKey, fullUrl);
      return fullUrl;
    }

    await setCachedData(cacheKey, null);
    return null;
  } catch (error: any) {
    console.warn(`TMDB API Hatası (show tmdbId: ${tmdbId}):`, error.message);
    await setCachedData(cacheKey, null);
    return null;
  }
};

export const getMoviePoster = async (tmdbId: number): Promise<string | null> => {
  if (!isWeb && !API_KEY) {
    console.warn('TMDB API Key eksik!');
    return null;
  }

  const cacheKey = `@tmdb_poster_cache_movie_${tmdbId}`;

  const cached = await getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchFromTmdb(`/movie/${tmdbId}`, {
      language: i18n.language === 'tr' ? 'tr-TR' : 'en-US'
    });

    const posterPath = response.data.poster_path;
    
    if (posterPath) {
      const fullUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
      await setCachedData(cacheKey, fullUrl);
      return fullUrl;
    }

    await setCachedData(cacheKey, null);
    return null;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      console.log(`[TMDB] Afiş bulunamadı (movie tmdbId: ${tmdbId})`);
    } else {
      console.warn(`TMDB API Hatası (movie tmdbId: ${tmdbId}):`, error.message);
    }
    await setCachedData(cacheKey, null);
    return null;
  }
};

export const getShowBackdrop = async (tmdbId: number): Promise<string | null> => {
  if (!isWeb && !API_KEY) return null;

  const cacheKey = `@tmdb_backdrop_cache_${tmdbId}`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) || null;
  }

  try {
    const response = await fetchFromTmdb(`/tv/${tmdbId}/images`);

    const backdropPath = response.data.backdrops?.[0]?.file_path;
    
    if (backdropPath) {
      const fullUrl = `https://image.tmdb.org/t/p/w1280${backdropPath}`;
      memoryCache.set(cacheKey, fullUrl);
      return fullUrl;
    }

    memoryCache.set(cacheKey, null);
    return null;
  } catch (error) {
    memoryCache.set(cacheKey, null);
    return null;
  }
};

export const getShowTrailer = async (tmdbId: number): Promise<string | null> => {
  if (!isWeb && !API_KEY) return null;

  const cacheKey = `@tmdb_trailer_cache_${tmdbId}`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) || null;
  }

  try {
    const response = await fetchFromTmdb(`/tv/${tmdbId}/videos`, {
      language: i18n.language === 'tr' ? 'tr-TR' : 'en-US'
    });

    const videos = response.data.results;
    const trailer = videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
    
    if (trailer) {
      memoryCache.set(cacheKey, trailer.key);
      return trailer.key;
    }

    memoryCache.set(cacheKey, null);
    return null;
  } catch (error) {
    memoryCache.set(cacheKey, null);
    return null;
  }
};

export const getPersonPhoto = (profilePath: string | null): string | null => {
  if (!profilePath) return null;
  return `https://image.tmdb.org/t/p/w276_and_h350_face${profilePath}`;
};

export const getEpisodeStill = async (tmdbId: number, season: number, episode: number): Promise<string | null> => {
  if (!isWeb && !API_KEY) return null;

  const cacheKey = `@tmdb_still_cache_${tmdbId}_${season}_${episode}`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) || null;
  }

  try {
    const response = await fetchFromTmdb(`/tv/${tmdbId}/season/${season}/episode/${episode}`, {
      language: i18n.language === 'tr' ? 'tr-TR' : 'en-US'
    });

    const stillPath = response.data.still_path;
    
    if (stillPath) {
      const fullUrl = `https://image.tmdb.org/t/p/w1280${stillPath}`;
      memoryCache.set(cacheKey, fullUrl);
      return fullUrl;
    }

    memoryCache.set(cacheKey, null);
    return null;
  } catch (error) {
    memoryCache.set(cacheKey, null);
    return null;
  }
};

export const getMovieBackdrop = async (tmdbId: number): Promise<string | null> => {
  if (!isWeb && !API_KEY) return null;

  const cacheKey = `@tmdb_backdrop_cache_movie_${tmdbId}`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) || null;
  }

  try {
    const response = await fetchFromTmdb(`/movie/${tmdbId}`, {
      language: i18n.language === 'tr' ? 'tr-TR' : 'en-US'
    });

    const backdropPath = response.data.backdrop_path;
    
    if (backdropPath) {
      const fullUrl = `https://image.tmdb.org/t/p/w1280${backdropPath}`;
      memoryCache.set(cacheKey, fullUrl);
      return fullUrl;
    }

    memoryCache.set(cacheKey, null);
    return null;
  } catch (error) {
    memoryCache.set(cacheKey, null);
    return null;
  }
};

export const getMovieTrailer = async (tmdbId: number): Promise<string | null> => {
  if (!isWeb && !API_KEY) return null;

  const cacheKey = `@tmdb_trailer_cache_movie_${tmdbId}`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) || null;
  }

  try {
    const response = await fetchFromTmdb(`/movie/${tmdbId}/videos`, {
      language: i18n.language === 'tr' ? 'tr-TR' : 'en-US'
    });

    const videos = response.data.results;
    if (!videos || videos.length === 0) {
      memoryCache.set(cacheKey, null);
      return null;
    }

    const trailer = videos.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
    const backupTrailer = videos.find((v: any) => v.site === 'YouTube');
    
    const finalVideo = trailer || backupTrailer;

    if (finalVideo) {
      memoryCache.set(cacheKey, finalVideo.key);
      return finalVideo.key;
    }

    memoryCache.set(cacheKey, null);
    return null;
  } catch (error) {
    memoryCache.set(cacheKey, null);
    return null;
  }
};

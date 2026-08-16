import axios from 'axios';
import i18n from '../locales/index';
import { cacheManager } from '../utils/cacheManager';
import { CACHE_TTL } from '../utils/cacheTTL';

// TMDB anahtarı istemciye ASLA gömülmez (`EXPO_PUBLIC_TMDB_API_KEY` KALDIRILDI
// — bkz. google_play_eksikler.md Aşama 5). `services/api/auth.ts`'teki
// TRAKT_PROXY_URL ile AYNI desen: `EXPO_PUBLIC_API_URL` tanımlıysa mutlak
// adres (native VE üretim web — API ayrı bir makinede, bkz. auth.ts'teki
// "Platform.OS kontrolü EKLEMEYİN" uyarısı, aynı gerekçe burada da geçerli),
// tanımlı değilse (uygulama API ile aynı origin'den sunuluyorsa) göreli yol.
const TMDB_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/tmdb`
  : '/api/tmdb';

// LRU Cache Sınıfı (Memory Leak Çözümü)
class LRUCache {
  private cache = new Map<string, any>();
  private limit: number;

  constructor(limit = 150) {
    this.limit = limit;
  }

  get(key: string) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: string, value: any) {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.limit) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  has(key: string) {
    return this.cache.has(key);
  }
}

const memoryCache = new LRUCache(150);

// Yardımcı Cache fonksiyonları
// Poster/afiş URL'leri (getShowPoster/getMoviePoster) burayı kullanır. TMDB'de
// var olan bir yapımın afiş yolu neredeyse hiç değişmediğinden LONG (7 gün)
// TTL kullanılır — eskiden cacheManager'ın varsayılanı olan 6 saatten sonra
// aynı posteri gereksiz yere yeniden TMDB'den çekiyorduk.
const getCachedData = async (key: string): Promise<string | null> => {
  if (memoryCache.has(key)) return memoryCache.get(key) || null;
  try {
    const diskValue = await cacheManager.get<string>(key, CACHE_TTL.LONG);
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
      await cacheManager.set(key, value);
    } catch(e) {}
  }
};

// Senkron bellek-içi önbellek kontrolü. Poster/afiş getirenler (getShowPoster,
// getMoviePoster) her çağrıldığında — önbellekte olsa bile — önce bir async
// fonksiyon içine girip state'i "yükleniyor" yapıyordu. Grid/liste ekranlarında
// hücreler kaydırma sırasında sürekli mount/unmount olduğundan (virtualization),
// bu her seferinde bir spinner "flaş"ına yol açıyordu. Bu fonksiyon, tüketicinin
// (MediaPoster) isLoading'e hiç geçmeden senkron olarak önbellek isabetini
// kullanabilmesini sağlar.
export const peekPosterCache = (type: 'show' | 'movie', tmdbId: number): { hit: boolean; url: string | null } => {
  const cacheKey = `@tmdb_poster_cache_${type}_${tmdbId}`;
  if (memoryCache.has(cacheKey)) {
    return { hit: true, url: memoryCache.get(cacheKey) || null };
  }
  return { hit: false, url: null };
};

// TMDB'ye HER ZAMAN proxy üzerinden gidilir (native dahil) — anahtar yalnızca
// sunucu tarafında (`server.js` → `TMDB_API_KEY`) tutulur.
const fetchFromTmdb = async (endpoint: string, params: any = {}) => {
  return axios.get(TMDB_PROXY_URL, { params: { ...params, endpoint } });
};

export const getShowPoster = async (tmdbId: number): Promise<string | null> => {
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
  if (!tmdbId || isNaN(tmdbId)) return null;

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

export const getTmdbCast = async (tmdbId: number, type: 'tv' | 'movie'): Promise<any[]> => {
  const cacheKey = `@tmdb_cast_cache_${type}_${tmdbId}`;
  
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) || [];
  }
  
  try {
    const response = await fetchFromTmdb(`/${type}/${tmdbId}/credits`, {
      language: i18n.language === 'tr' ? 'tr-TR' : 'en-US'
    });
    
    // Convert TMDB format to the expected Trakt-like format for MediaCast
    const cast = response.data.cast?.map((c: any) => ({
      characters: [c.character],
      person: {
        name: c.name,
        ids: { tmdb: c.id },
        images: {
          profiles: [{ file_path: c.profile_path }]
        }
      }
    })) || [];
    
    memoryCache.set(cacheKey, cast);
    return cast;
  } catch (error) {
    return [];
  }
};

export const getEpisodeTmdbCast = async (tmdbId: number, season: number, episode: number): Promise<any[]> => {
  if (!tmdbId || isNaN(tmdbId)) return [];
  
  const cacheKey = `@tmdb_cast_cache_ep_${tmdbId}_${season}_${episode}`;
  
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) || [];
  }
  
  try {
    const response = await fetchFromTmdb(`/tv/${tmdbId}/season/${season}/episode/${episode}/credits`, {
      language: i18n.language === 'tr' ? 'tr-TR' : 'en-US'
    });
    
    // Convert TMDB format to the expected Trakt-like format for MediaCast
    const cast = (response.data.cast || []).concat(response.data.guest_stars || []).map((c: any) => ({
      characters: [c.character],
      person: {
        name: c.name,
        ids: { tmdb: c.id },
        images: {
          profiles: [{ file_path: c.profile_path }]
        }
      }
    }));
    
    // Remove duplicates if guest_stars and cast overlap
    const uniqueCast = Array.from(new Map(cast.map((item: any) => [item.person.ids.tmdb, item])).values());
    
    memoryCache.set(cacheKey, uniqueCast);
    return uniqueCast;
  } catch (error) {
    return [];
  }
};

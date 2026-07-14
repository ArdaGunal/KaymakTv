import axios from 'axios';
import * as SecureStore from '../utils/secureStorage';
import i18n from '../locales/index';

const applyTranslation = (item: any, lang: string) => {
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

let cachedInstance: any = null;
let cachedAccessToken: string | null = null;

const getTraktClient = async () => {
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

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // 401 hatasÄ± ve henÃ¼z tekrar denenmemiÅŸse
      if (error.response?.status === 401 && !originalRequest._retry) {
        
        // Zaten yenileniyorsa, bu isteÄŸi sÄ±raya al
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

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = await SecureStore.getItemAsync('traktRefreshToken');
        const proxyUrl = process.env.EXPO_PUBLIC_PROXY_URL || '/api/trakt';

        if (refreshToken && proxyUrl) {
          try {
            console.log('Trakt API 401 hatasÄ±. Refresh Token ile yeni token alÄ±nÄ±yor...');
            const { data } = await axios.post(proxyUrl, { refresh_token: refreshToken });
            const newAccessToken = data.access_token;
            const newRefreshToken = data.refresh_token;

            await SecureStore.setItemAsync('traktAccessToken', newAccessToken);
            await SecureStore.setItemAsync('traktRefreshToken', newRefreshToken);

            instance.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

            processQueue(null, newAccessToken);
            console.log('Token baÅŸarÄ±yla yenilendi ve eski istekler tekrar ediliyor.');
            return instance(originalRequest);
          } catch (refreshError) {
            console.error('Refresh Token yenilenemedi, oturum kapatÄ±lÄ±yor:', refreshError);
            processQueue(refreshError, null);
            await SecureStore.deleteItemAsync('traktAccessToken');
            await SecureStore.deleteItemAsync('traktRefreshToken');
            return Promise.reject(refreshError);
          } finally {
            isRefreshing = false;
          }
        } else {
          // Refresh token yoksa mecbur Ã§Ä±kÄ±ÅŸ
          await SecureStore.deleteItemAsync('traktAccessToken');
          await SecureStore.deleteItemAsync('traktRefreshToken');
          return Promise.reject(error);
        }
      }
      
      return Promise.reject(error);
    }
  );

  cachedInstance = instance;
  return instance;
};

export const exchangeAuthCode = async (code: string, redirectUri: string) => {
  try {
    const proxyUrl = process.env.EXPO_PUBLIC_PROXY_URL || '/api/trakt';
    if (!proxyUrl) {
      throw new Error('Proxy URL bulunamadÃ„Â±. LÃƒÂ¼tfen .env dosyasÃ„Â±nÃ„Â± kontrol edin.');
    }
    const response = await axios.post(proxyUrl, {
      code,
      redirect_uri: redirectUri,
    });
    return response.data; // { access_token, refresh_token, ... }
  } catch (error: any) {
    console.error('exchangeAuthCode HatasÃ„Â±:', error?.response?.data || error);
    throw error;
  }
};

export const getTrendingShows = async (page = 1, limit = 7) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/shows/trending?extended=full&page=${page}&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getTrendingShows):', error);
    throw error;
  }
};

export const getHistoryEpisodes = async () => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/sync/history/episodes?extended=full&limit=1000`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getHistoryEpisodes):', error);
    throw error;
  }
};

export const getWatchedShows = async () => {
  try {
    const client = await getTraktClient();
    const limit = 100;
    let page = 1;
    let allData: any[] = [];
    
    // Ã„Â°lk sayfayÃ„Â± ÃƒÂ§ek
    const response = await client.get(`/sync/watched/shows?extended=full&page=${page}&limit=${limit}`);
    allData = [...response.data];
    
    // Toplam sayfa sayÃ„Â±sÃ„Â±nÃ„Â± header'dan al
    const totalPagesStr = response.headers['x-pagination-page-count'];
    const totalPages = totalPagesStr ? parseInt(totalPagesStr, 10) : 1;
    
    // Kalan sayfalarÃ„Â± ÃƒÂ§ek
    if (totalPages > 1) {
      for (let i = 2; i <= totalPages; i += 5) {
        const chunkPromises = [];
        for (let j = i; j < i + 5 && j <= totalPages; j++) {
          chunkPromises.push(
            client.get(`/sync/watched/shows?extended=full&page=${j}&limit=${limit}`)
          );
        }
        
        const responses = await Promise.all(chunkPromises);
        responses.forEach(res => {
          allData.push(...res.data);
        });
        
        if (i + 5 <= totalPages) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Trakt API Rate Limit koruması
        }
      }
    }
    
    return allData;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getWatchedShows):', error);
    throw error;
  }
};

export const addEpisodeToHistory = async (showId: number, season: number, episode: number) => {
  try {
    const client = await getTraktClient();
    const payload = {
      shows: [
        {
          ids: { trakt: showId },
          seasons: [
            {
              number: season,
              episodes: [{ number: episode }]
            }
          ]
        }
      ]
    };
    const response = await client.post('/sync/history', payload);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (addEpisodeToHistory):', error);
    throw error;
  }
};

export const addSeasonToHistory = async (showId: number, season: number) => {
  try {
    const client = await getTraktClient();
    const payload = {
      shows: [
        {
          ids: { trakt: showId },
          seasons: [
            {
              number: season
            }
          ]
        }
      ]
    };
    const response = await client.post('/sync/history', payload);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (addSeasonToHistory):', error);
    throw error;
  }
};

export const addEpisodesBulkToHistory = async (showId: number, season: number, episodes: number[]) => {
  try {
    const client = await getTraktClient();
    const payload = {
      shows: [
        {
          ids: { trakt: showId },
          seasons: [
            {
              number: season,
              episodes: episodes.map(num => ({ number: num }))
            }
          ]
        }
      ]
    };
    const response = await client.post('/sync/history', payload);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (addEpisodesBulkToHistory):', error);
    throw error;
  }
};

export const getShowProgress = async (showId: number) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/shows/${showId}/progress/watched?hidden=false&specials=false&count_specials=false`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getShowProgress):', error);
    throw error;
  }
};

export const getWatchlistShows = async () => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/sync/watchlist/shows?extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getWatchlistShows):', error);
    throw error;
  }
};

export const getWatchlistMovies = async () => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/sync/watchlist/movies?extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getWatchlistMovies):', error);
    throw error;
  }
};

export const getWatchedMovies = async () => {
  try {
    const client = await getTraktClient();
    const limit = 100;
    let page = 1;
    let allData: any[] = [];
    
    // Ã„Â°lk sayfayÃ„Â± ÃƒÂ§ek
    const response = await client.get(`/sync/watched/movies?extended=full&page=${page}&limit=${limit}`);
    allData = [...response.data];
    
    // Toplam sayfa sayÃ„Â±sÃ„Â±nÃ„Â± header'dan al
    const totalPagesStr = response.headers['x-pagination-page-count'];
    const totalPages = totalPagesStr ? parseInt(totalPagesStr, 10) : 1;
    
    // Kalan sayfalarÃ„Â± ÃƒÂ§ek
    if (totalPages > 1) {
      for (let i = 2; i <= totalPages; i += 5) {
        const chunkPromises = [];
        for (let j = i; j < i + 5 && j <= totalPages; j++) {
          chunkPromises.push(
            client.get(`/sync/watched/movies?extended=full&page=${j}&limit=${limit}`)
          );
        }
        
        const responses = await Promise.all(chunkPromises);
        responses.forEach(res => {
          allData.push(...res.data);
        });
        
        if (i + 5 <= totalPages) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Trakt API Rate Limit koruması
        }
      }
    }
    
    return allData;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getWatchedMovies):', error);
    throw error;
  }
};

export const getCustomLists = async (page = 1, limit = 20) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/users/me/lists?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getCustomLists):', error);
    throw error;
  }
};

export const getFavoriteShows = async (page = 1, limit = 20) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/sync/ratings/shows?rating=10&extended=full&page=${page}&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getFavoriteShows):', error);
    throw error;
  }
};

export const getFavoriteMovies = async (page = 1, limit = 20) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/sync/ratings/movies?rating=10&extended=full&page=${page}&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getFavoriteMovies):', error);
    throw error;
  }
};

export const getMyCalendarShows = async (days = 30) => {
  try {
    const client = await getTraktClient();
    const today = new Date().toISOString().split('T')[0];
    const response = await client.get(`/calendars/my/shows/${today}/${days}?extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getMyCalendarShows):', error);
    throw error;
  }
};

export const getMyCalendarMovies = async (days = 30) => {
  try {
    const client = await getTraktClient();
    const today = new Date().toISOString().split('T')[0];
    const response = await client.get(`/calendars/my/movies/${today}/${days}?extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getMyCalendarMovies):', error);
    throw error;
  }
};

export const addMovieToHistory = async (movieId: number) => {
  try {
    const client = await getTraktClient();
    const payload = {
      movies: [
        {
          ids: { trakt: movieId }
        }
      ]
    };
    const response = await client.post('/sync/history', payload);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (addMovieToHistory):', error);
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

export const getEpisodeComments = async (showId: number, season: number, episode: number) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/shows/${showId}/seasons/${season}/episodes/${episode}/comments?extended=full`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API HatasÄ± (getEpisodeComments - ${showId} S${season}E${episode}):`, error);
    return [];
  }
};

export const getTrendingMovies = async (page = 1, limit = 7) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/movies/trending?extended=full&page=${page}&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÄ± (getTrendingMovies):', error);
    throw error;
  }
};

export const searchTrakt = async (query: string, type: 'show' | 'movie') => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/search/${type}?query=${encodeURIComponent(query)}&extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÄ± (searchTrakt):', error);
    throw error;
  }
};

// --- MOVIE DETAYLARI ---

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

// --- PUANLAMA (RATING) SÄ°STEMÄ° ---

export const getUserRatings = async (type: 'shows' | 'movies' | 'episodes') => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/sync/ratings/${type}?extended=full`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API Hatası (getUserRatings - ${type}):`, error);
    return [];
  }
};

export const addRating = async (id: number, type: 'show' | 'movie' | 'episode', rating: number, season?: number, episode?: number) => {
  try {
    const client = await getTraktClient();
    let body: any = {};
    if (type === 'episode' && season !== undefined && episode !== undefined) {
      body = {
        shows: [{
          ids: { trakt: id },
          seasons: [{
            number: season,
            episodes: [{ number: episode, rating: rating }]
          }]
        }]
      };
    } else {
      const typeKey = type === 'show' ? 'shows' : type === 'movie' ? 'movies' : 'episodes';
      body = {
        [typeKey]: [{
          rating: rating,
          ids: { trakt: id }
        }]
      };
    }
    const response = await client.post('/sync/ratings', body);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (addRating):', error);
    throw error;
  }
};

export const removeRating = async (id: number, type: 'show' | 'movie' | 'episode') => {
  try {
    const client = await getTraktClient();
    const typeKey = type === 'show' ? 'shows' : type === 'movie' ? 'movies' : 'episodes';
    const body = {
      [typeKey]: [{
        ids: { trakt: id }
      }]
    };
    const response = await client.post('/sync/ratings/remove', body);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (removeRating):', error);
    throw error;
  }
};

// --- GELÄ°ÅMÄ°Å SEÃ‡ENEKLER (ADVANCED OPTIONS) ---

export const addToWatchlistTrakt = async (id: number, type: 'show' | 'movie') => {
  try {
    const client = await getTraktClient();
    const body = {
      [type === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: id } }]
    };
    const response = await client.post('/sync/watchlist', body);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÄ± (addToWatchlistTrakt):', error);
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
    console.error('Trakt API HatasÄ± (removeFromWatchlistTrakt):', error);
    throw error;
  }
};

export const hideItemTrakt = async (id: number, type: 'show' | 'movie') => {
  try {
    const client = await getTraktClient();
    const body = {
      [type === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: id } }]
    };
    // Sadece dizilerin progress'i gizlenebilir (Trakt API dÃ¶kÃ¼mantasyonuna gÃ¶re film progressi yok, genelde shows is hidden)
    const section = type === 'show' ? 'progress_watched' : 'calendar';
    const response = await client.post(`/users/hidden/${section}`, body);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÄ± (hideItemTrakt):', error);
    throw error;
  }
};

export const removeFromHistoryTrakt = async (id: number, type: 'show' | 'movie') => {
  try {
    const client = await getTraktClient();
    const body = {
      [type === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: id } }]
    };
    const response = await client.post('/sync/history/remove', body);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÄ± (removeFromHistoryTrakt):', error);
    throw error;
  }
};

export const removeEpisodeFromHistoryTrakt = async (showId: number, season: number, episode: number) => {
  try {
    const client = await getTraktClient();
    const body = {
      shows: [{
        ids: { trakt: showId },
        seasons: [{
          number: season,
          episodes: [{ number: episode }]
        }]
      }]
    };
    const response = await client.post('/sync/history/remove', body);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (removeEpisodeFromHistoryTrakt):', error);
    throw error;
  }
};

export const removeSeasonFromHistoryTrakt = async (showId: number, season: number) => {
  try {
    const client = await getTraktClient();
    const body = {
      shows: [
        {
          ids: { trakt: showId },
          seasons: [
            {
              number: season
            }
          ]
        }
      ]
    };
    const response = await client.post('/sync/history/remove', body);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (removeSeasonFromHistoryTrakt):', error);
    throw error;
  }
};

export const addComment = async (id: number, type: 'show' | 'movie' | 'episode', comment: string, spoiler: boolean = true) => {
  try {
    const client = await getTraktClient();
    const body: any = {
      comment,
      spoiler
    };

    if (type === 'show') {
      body.show = { ids: { trakt: id } };
    } else if (type === 'movie') {
      body.movie = { ids: { trakt: id } };
    } else if (type === 'episode') {
      body.episode = { ids: { trakt: id } };
    }

    const response = await client.post('/comments', body);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (addComment):', error);
    throw error;
  }
};

export const updateComment = async (commentId: number, comment: string, spoiler: boolean = true) => {
  try {
    const client = await getTraktClient();
    const body = {
      comment,
      spoiler
    };
    const response = await client.put(`/comments/${commentId}`, body);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (updateComment):', error);
    throw error;
  }
};

export const deleteComment = async (commentId: number) => {
  try {
    const client = await getTraktClient();
    const response = await client.delete(`/comments/${commentId}`);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (deleteComment):', error);
    throw error;
  }
};

export const getMediaComments = async (id: number, type: 'show' | 'movie' | 'episode', sort: 'likes' | 'newest' | 'oldest' = 'likes', page: number = 1, limit: number = 10, season?: number, episode?: number) => {
  try {
    const client = await getTraktClient();
    let url = '';
    if (type === 'episode' && season !== undefined && episode !== undefined) {
      url = `/shows/${id}/seasons/${season}/episodes/${episode}/comments/${sort}?page=${page}&limit=${limit}&extended=full`;
    } else {
      const typePath = type === 'show' ? 'shows' : type === 'movie' ? 'movies' : 'episodes';
      url = `/${typePath}/${id}/comments/${sort}?page=${page}&limit=${limit}&extended=full`;
    }
    
    const response = await client.get(url);
    
    return {
      data: response.data,
      pagination: {
        page: parseInt(response.headers['x-pagination-page'] || '1', 10),
        limit: parseInt(response.headers['x-pagination-limit'] || '10', 10),
        pageCount: parseInt(response.headers['x-pagination-page-count'] || '1', 10),
        itemCount: parseInt(response.headers['x-pagination-item-count'] || '0', 10),
      }
    };
  } catch (error) {
    console.error(`Trakt API Hatası (getMediaComments - ${type}):`, error);
    throw error;
  }
};

export const getUserComments = async () => {
  try {
    const client = await getTraktClient();
    const response = await client.get('/users/me/comments/all/newest?include_replies=false&extended=full');
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getUserComments):', error);
    throw error;
  }
};

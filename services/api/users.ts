import { getTraktClient } from './traktClient';

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

export const getUserStats = async () => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/users/me/stats`);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getUserStats):', error);
    throw error;
  }
};

export const getCustomLists = async (page = 1, limit = 20) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/users/me/lists?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getCustomLists):', error);
    throw error;
  }
};

export const createCustomList = async (name: string, description: string = '') => {
  try {
    const client = await getTraktClient();
    const response = await client.post('/users/me/lists', {
      name,
      description,
      privacy: 'private',
      display_numbers: false,
      allow_comments: false
    });
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (createCustomList):', error);
    throw error;
  }
};

export const deleteCustomList = async (listId: number | string) => {
  try {
    const client = await getTraktClient();
    await client.delete(`/users/me/lists/${listId}`);
  } catch (error) {
    console.error('Trakt API Hatası (deleteCustomList):', error);
    throw error;
  }
};

export const getCustomListItems = async (listId: number | string) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/users/me/lists/${listId}/items?extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getCustomListItems):', error);
    throw error;
  }
};

export const addMediaToCustomList = async (listId: number | string, mediaId: number, type: 'show' | 'movie') => {
  try {
    const client = await getTraktClient();
    const payload = {
      [type === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: mediaId } }]
    };
    const response = await client.post(`/users/me/lists/${listId}/items`, payload);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (addMediaToCustomList):', error);
    throw error;
  }
};

export const removeMediaFromCustomList = async (listId: number | string, mediaId: number, type: 'show' | 'movie') => {
  try {
    const client = await getTraktClient();
    const payload = {
      [type === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: mediaId } }]
    };
    const response = await client.post(`/users/me/lists/${listId}/items/remove`, payload);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (removeMediaFromCustomList):', error);
    throw error;
  }
};

export const getOrCreateLikedList = async () => {
  const client = await getTraktClient();
  const { data: lists } = await client.get('/users/me/lists');
  
  let likedList = lists.find((l: any) => l.name === 'Beğenilen Diziler' || l.name === 'Beğenilenler');
  
  if (!likedList) {
    const { data: newList } = await client.post('/users/me/lists', {
      name: 'Beğenilen Diziler',
      description: 'Kalp butonuna basarak beğendiğim içerikler.',
      privacy: 'private',
      display_numbers: false,
      allow_comments: false
    });
    likedList = newList;
  }
  return likedList.ids.trakt;
};

export const getLikedShows = async () => {
  try {
    const listId = await getOrCreateLikedList();
    const client = await getTraktClient();
    const response = await client.get(`/users/me/lists/${listId}/items/shows?extended=full`);
    // Custom list items return an array of { id, rank, listed_at, type, show: { ... } }
    // So we map them to return just the show object similar to favorites API
    return response.data.map((item: any) => ({
      listed_at: item.listed_at,
      show: item.show
    }));
  } catch (error) {
    console.error('Trakt API Hatası (getLikedShows):', error);
    throw error;
  }
};

export const getLikedMovies = async () => {
  try {
    const listId = await getOrCreateLikedList();
    const client = await getTraktClient();
    const response = await client.get(`/users/me/lists/${listId}/items/movies?extended=full`);
    return response.data.map((item: any) => ({
      listed_at: item.listed_at,
      movie: item.movie
    }));
  } catch (error) {
    console.error('Trakt API Hatası (getLikedMovies):', error);
    throw error;
  }
};

export const toggleLikedMedia = async (id: number, type: 'show' | 'movie', isAdding: boolean) => {
  try {
    const listId = await getOrCreateLikedList();
    const client = await getTraktClient();
    const endpoint = isAdding ? `/users/me/lists/${listId}/items` : `/users/me/lists/${listId}/items/remove`;
    const payload = {
      [type === 'show' ? 'shows' : 'movies']: [
        {
          ids: { trakt: id }
        }
      ]
    };
    const response = await client.post(endpoint, payload);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (toggleLikedMedia):', error);
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

export const getUserRatings = async (type: 'shows' | 'movies' | 'episodes') => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/sync/ratings/${type}?extended=full`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API Hatası (getUserRatings - ${type}):`, error);
    // ESKİ HATA: burada `return []` vardı ve bu, KULLANICININ TÜM PUANLARINI
    // siliyordu. Çağıran taraf (`fetchers.ts`) "başarısızlık = null" sözleşmesine
    // göre yazılmıştır: `.catch(() => null)` ile sarmalanır ve `null` gelirse
    // önbellekteki eski veriyi korur. Bu fonksiyon hatayı YUTUP boş dizi
    // döndürdüğü için o `.catch` hiç çalışmıyor, `[]` geçerli bir sonuç sanılıp
    // hem store'a hem diske yazılıyordu. Sonuç: ağ hatası / Trakt kesintisi /
    // rate-limit durumunda kullanıcının verdiği tüm puanlar uygulamadan
    // kayboluyordu. Diğer kardeş fonksiyonlar (getWatchedShows vb.) zaten
    // `throw` ediyor — sözleşme burada da aynı hale getirildi.
    throw error;
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

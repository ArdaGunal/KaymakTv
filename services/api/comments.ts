import { getTraktClient } from './traktClient';
import { CACHE_TTL } from '../../utils/cacheTTL';

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
    invalidateUserCommentsCache();
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
    invalidateUserCommentsCache();
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
    invalidateUserCommentsCache();
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

// `MyInlineComment` (yorum önizleme) ve `WriteCommentSheet` (yazma sheet'i)
// her dizi/film/bölüm sayfası mount olduğunda BAĞIMSIZ olarak bu 200 kayıtlık
// listeyi baştan çekip client-side `.find()` yapıyordu — aynı sayfada ikisi
// birden açıksa aynı veri iki kez, farklı sayfalar gezilince her seferinde
// yeniden isteniyordu (bkz. performans raporu: `users/me/comments/all/newest`
// tek oturumda 38 çağrı, en yüksek sayılardan biri). Kısa TTL'li paylaşımlı
// önbellek + uçuştaki (in-flight) isteği tekilleştirme bunu ortadan kaldırır;
// yorum ekleme/güncelleme/silme sonrası `invalidateUserCommentsCache` ile
// bozulur ki kullanıcı kendi yeni yorumunu hemen görsün.
let userCommentsCache: { data: any[]; fetchedAt: number } | null = null;
let userCommentsInFlight: Promise<any[]> | null = null;

export const invalidateUserCommentsCache = (): void => {
  userCommentsCache = null;
};

export const getUserComments = async (force = false): Promise<any[]> => {
  if (!force && userCommentsCache && Date.now() - userCommentsCache.fetchedAt < CACHE_TTL.SHORT) {
    return userCommentsCache.data;
  }
  if (!force && userCommentsInFlight) {
    return userCommentsInFlight;
  }

  const request = (async () => {
    try {
      const client = await getTraktClient();
      // limit şart: Trakt varsayılanı 10 kayıttır — limitsiz istekte 10'dan fazla
      // yorumu olan kullanıcının eski yorumları bulunamıyor ve "zaten yorum var"
      // tespiti kaçtığı için tekrar gönderimde 409 (duplicate) hatası oluşuyordu.
      const response = await client.get('/users/me/comments/all/newest?include_replies=false&extended=full&limit=200');
      userCommentsCache = { data: response.data, fetchedAt: Date.now() };
      return response.data;
    } catch (error) {
      console.error('Trakt API Hatası (getUserComments):', error);
      throw error;
    } finally {
      userCommentsInFlight = null;
    }
  })();

  userCommentsInFlight = request;
  return request;
};

export const getCommentReplies = async (commentId: number, page: number = 1, limit: number = 25) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/comments/${commentId}/replies?page=${page}&limit=${limit}&extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getCommentReplies):', error);
    throw error;
  }
};

export const addCommentReply = async (commentId: number, comment: string, spoiler: boolean = false) => {
  try {
    const client = await getTraktClient();
    const response = await client.post(`/comments/${commentId}/replies`, { comment, spoiler });
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (addCommentReply):', error);
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

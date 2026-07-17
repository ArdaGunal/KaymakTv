import { getTraktClient } from './traktClient';

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

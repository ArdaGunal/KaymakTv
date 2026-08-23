import { getTraktClient } from './traktClient';

/**
 * Trakt yorumlarını **OKUMA** servisi.
 *
 * ⚠️ v2 (Trakt'tan kopuş): bu dosya eskiden Trakt'a YAZIYORDU da
 * (`addComment`, `updateComment`, `deleteComment`, `addCommentReply`) ve
 * kullanıcının kendi yorumlarını önbellekliyordu (`getUserComments`). Trakt
 * API ücretlendirmeye geçtiği için yazma tamamen kaldırıldı — kullanıcının
 * ürettiği içerik artık yalnızca kendi veritabanımıza gidiyor
 * (bkz. docs/design/REVIEWS_PLAN.md v2, `features/feed/services/feedReviews.ts`).
 *
 * Geriye kalan üç fonksiyon yalnızca dizi/film/bölüm sayfalarındaki "Trakt
 * topluluğu" bloğunu besliyor.
 */

// Trakt'ın CDN'i GET yanıtlarını agresif önbelliyor (bkz. docs/HISTORY.md
// Madde 9 — aynı sınıf sorun, eski prototipte de görülmüştü). Sonuç: bir
// yorum silinip yenisi yazıldığında, `POST`/`DELETE` Trakt'ta ANINDA
// işleniyor (ve `/users/me/comments/...`'ta hemen doğru görünüyor) ama
// hemen ardından gelen `GET .../comments/{sort}` isteği CDN'de duran ESKİ
// sürümü döndürebiliyor. Bu, yalnızca "eski görünüyor" demek değil: o
// silinmiş yorum başka kullanıcılara dakikalarca görünmeye devam edip
// üzerine cevap/beğeni bırakılabiliyor. Her isteğe benzersiz bir `_` query
// parametresi eklemek CDN'i her seferinde "yeni bir kaynak" sanmaya
// zorlayıp önbelleği atlatır — Trakt topluluğunun bilinen çözümü de bu
// (bkz. Trakt API tartışmaları, cache-busting query param önerisi).
const cacheBustParam = () => `_=${Date.now()}`;




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

    const response = await client.get(`${url}&${cacheBustParam()}`);
    
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

export const getCommentReplies = async (commentId: number, page: number = 1, limit: number = 25) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/comments/${commentId}/replies?page=${page}&limit=${limit}&extended=full&${cacheBustParam()}`);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getCommentReplies):', error);
    throw error;
  }
};


export const getEpisodeComments = async (showId: number, season: number, episode: number) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/shows/${showId}/seasons/${season}/episodes/${episode}/comments?extended=full&${cacheBustParam()}`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API HatasÄ± (getEpisodeComments - ${showId} S${season}E${episode}):`, error);
    return [];
  }
};

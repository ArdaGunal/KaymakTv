import { getTraktClient } from '../traktClient';

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

export const addRating = async (
  id: number,
  type: 'show' | 'movie' | 'episode',
  rating: number,
  season?: number,
  episode?: number,
  ratedAt?: string
) => {
  try {
    const client = await getTraktClient();
    // bkz. history.ts/addEpisodeToHistory üstündeki "AÇIK ZAMAN DAMGASI" notu.
    const stamp = ratedAt ? { rated_at: ratedAt } : {};
    let body: any = {};
    if (type === 'episode' && season !== undefined && episode !== undefined) {
      body = {
        shows: [{
          ids: { trakt: id },
          seasons: [{
            number: season,
            episodes: [{ number: episode, rating: rating, ...stamp }]
          }]
        }]
      };
    } else {
      const typeKey = type === 'show' ? 'shows' : type === 'movie' ? 'movies' : 'episodes';
      body = {
        [typeKey]: [{
          rating: rating,
          ids: { trakt: id },
          ...stamp
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

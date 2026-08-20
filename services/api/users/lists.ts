import { getTraktClient } from '../traktClient';
import * as SecureStore from '../../../utils/secureStorage';

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

// "Beğenilenler" özel liste ID'si — CACHE'LENİR (bkz. docs/HISTORY.md Madde 106).
// ESKİ DAVRANIŞ: her çağrı `GET /users/me/lists`i baştan çekiyordu; tek bir
// `fetchFreshData` turunda `getCustomLists()` + `getLikedShows()` +
// `getLikedMovies()` AYNI ANDA tetiklendiğinden (Promise.all) bu uç nokta
// senkron başına 3 KEZ vuruluyordu — performans raporunda 25 senkron × 3 = 75
// çağrı olarak görüldü, üçte ikisi gereksizdi. Liste ID'si bir oturum boyunca
// değişmeyen sabit bir değer olduğundan önbelleğe almak güvenlidir.
let cachedLikedListId: number | null = null;
// Önbellek HANGİ hesaba ait olduğunu unutmamalı: kullanıcı çıkış yapıp farklı
// bir Trakt hesabıyla tekrar girerse (uygulama yeniden başlatılmadan) eski
// liste ID'si YANLIŞ hesaba ait kalır — favorileme sessizce yanlış listeye
// yazardı. `getTraktClient()`'ın kendisi de token'ı SecureStore'dan okuyup
// aynı şekilde karşılaştırıyor (bkz. `cachedAccessToken`); aynı deseni burada
// da uyguluyoruz.
let cachedForAccessToken: string | null = null;
// Aynı anda birden fazla çağıran (ör. Promise.all içindeki getLikedShows +
// getLikedMovies) varsa hepsi TEK bir isteği paylaşsın — üç ayrı istek yerine.
let inFlightListLookup: Promise<number> | null = null;

/** Hesap değişimi/çıkış sonrası önbelleği elle geçersiz kılmak için (bkz.
 * aşağıdaki 404 kurtarma yolu — liste kullanıcı tarafından Trakt.tv'den
 * silinmişse önbellekteki ID artık geçersizdir). */
export const invalidateLikedListCache = () => {
  cachedLikedListId = null;
  cachedForAccessToken = null;
};

export const getOrCreateLikedList = async (): Promise<number> => {
  const currentToken = await SecureStore.getItemAsync('traktAccessToken');

  if (cachedLikedListId !== null && cachedForAccessToken === currentToken) {
    return cachedLikedListId;
  }

  if (inFlightListLookup) {
    return inFlightListLookup;
  }

  inFlightListLookup = (async () => {
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

    cachedLikedListId = likedList.ids.trakt;
    cachedForAccessToken = currentToken;
    return cachedLikedListId as number;
  })();

  try {
    return await inFlightListLookup;
  } finally {
    inFlightListLookup = null;
  }
};

/** Önbellekteki liste ID'si ile bir işlemi çalıştırır; 404 (liste artık yok —
 * kullanıcı Trakt.tv'den elle silmiş olabilir) alınırsa önbellek temizlenip
 * TEK seferlik bir yeniden deneme yapılır. Üç tüketicinin (getLikedShows,
 * getLikedMovies, toggleLikedMedia) tekrarlamaması için ortak yardımcı. */
const withLikedListId = async <T>(fn: (listId: number) => Promise<T>): Promise<T> => {
  const listId = await getOrCreateLikedList();
  try {
    return await fn(listId);
  } catch (error: any) {
    if (error?.response?.status === 404) {
      invalidateLikedListCache();
      const freshListId = await getOrCreateLikedList();
      return await fn(freshListId);
    }
    throw error;
  }
};

export const getLikedShows = async () => {
  try {
    return await withLikedListId(async (listId) => {
      const client = await getTraktClient();
      const response = await client.get(`/users/me/lists/${listId}/items/shows?extended=full`);
      // Custom list items return an array of { id, rank, listed_at, type, show: { ... } }
      // So we map them to return just the show object similar to favorites API
      return response.data.map((item: any) => ({
        listed_at: item.listed_at,
        show: item.show
      }));
    });
  } catch (error) {
    console.error('Trakt API Hatası (getLikedShows):', error);
    throw error;
  }
};

export const getLikedMovies = async () => {
  try {
    return await withLikedListId(async (listId) => {
      const client = await getTraktClient();
      const response = await client.get(`/users/me/lists/${listId}/items/movies?extended=full`);
      return response.data.map((item: any) => ({
        listed_at: item.listed_at,
        movie: item.movie
      }));
    });
  } catch (error) {
    console.error('Trakt API Hatası (getLikedMovies):', error);
    throw error;
  }
};

export const toggleLikedMedia = async (id: number, type: 'show' | 'movie', isAdding: boolean) => {
  try {
    return await withLikedListId(async (listId) => {
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
    });
  } catch (error) {
    console.error('Trakt API Hatası (toggleLikedMedia):', error);
    throw error;
  }
};

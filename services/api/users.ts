import axios from 'axios';
import { Platform } from 'react-native';
import { getTraktClient, refreshAccessToken } from './traktClient';
import * as SecureStore from '../../utils/secureStorage';

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

// ─────────────────────────────────────────────────────────────────────────
// AÇIK ZAMAN DAMGASI (watched_at / rated_at) — Akış'ın anında yayın
// mekanizmasının temeli.
//
// ESKİ DAVRANIŞ: bu uç noktalara hiç zaman gönderilmiyordu, Trakt kendi sunucu
// saatini yazıyordu. Sonuç: client, olayın Trakt'ta HANGİ damgayla kaydedildiğini
// BİLMİYORDU. Akış artık aktiviteyi Trakt'a yazıldığı anda kendi veritabanına
// da yayınlıyor (bkz. features/feed/services/feedPublish.ts); damga bilinmezse
// bir sonraki tam senkron Trakt'tan FARKLI bir damga okur, dedup anahtarı
// tutmaz ve aynı olay ya ikinci kez eklenir ya da "Trakt'ta yok" sanılıp
// silinir. Damgayı client üretip HER İKİ tarafa da aynısını göndererek bu
// sınıf hatayı yapısal olarak imkânsız kılıyoruz.
//
// `watchedAt` opsiyonel: verilmezse eski davranış (Trakt kendi saatini yazar)
// korunur — çağıranların hepsini değiştirmek zorunda kalmadan kademeli geçiş.
// ─────────────────────────────────────────────────────────────────────────

export const addEpisodeToHistory = async (
  showId: number,
  season: number,
  episode: number,
  watchedAt?: string
) => {
  try {
    const client = await getTraktClient();
    const payload = {
      shows: [
        {
          ids: { trakt: showId },
          seasons: [
            {
              number: season,
              episodes: [{ number: episode, ...(watchedAt ? { watched_at: watchedAt } : {}) }]
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

export const addSeasonToHistory = async (showId: number, season: number, watchedAt?: string) => {
  try {
    const client = await getTraktClient();
    const payload = {
      shows: [
        {
          ids: { trakt: showId },
          seasons: [
            {
              number: season,
              ...(watchedAt ? { watched_at: watchedAt } : {})
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

export const addEpisodesBulkToHistory = async (
  showId: number,
  season: number,
  episodes: number[],
  watchedAt?: string
) => {
  try {
    const client = await getTraktClient();
    const payload = {
      shows: [
        {
          ids: { trakt: showId },
          seasons: [
            {
              number: season,
              episodes: episodes.map(num => ({ number: num, ...(watchedAt ? { watched_at: watchedAt } : {}) }))
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

/**
 * TOPLU İLERLEME ÖZETİ — `GET /sync/progress/up_next_nitro?intent=all`.
 *
 * Trakt, kullanıcının TÜM dizilerinin ilerleme özetini (aired, completed,
 * last_watched_at, next_episode, last_episode) tek sayfalanmış uç noktadan
 * verir; `intent=all` başlanmış + bitmiş + yeni başlanan dizilerin hepsini
 * kapsar (dokümantasyon: docs.trakt.tv/reference/getsyncprogressupnextnitro).
 * VIP şartı YOK, yalnızca OAuth. Bu, senkronun eskiden dizi başına tek tek
 * attığı yüzlerce `/shows/:id/progress/watched` isteğinin yerine geçen toplu
 * yoldur — İLK GİRİŞTE kategorilerin saniyeler içinde doğru oturmasını sağlar
 * (bkz. services/library/fetchers.ts "toplu tohumlama").
 *
 * DİKKAT: yanıttaki `progress` nesnesi sezon/bölüm KIRILIMI (`seasons`)
 * İÇERMEZ — bölüm bazlı işaretleme kontrolü yapan ekranlar için dizi başına
 * tam `getShowProgress` hâlâ gereklidir; çağıran taraf bu farkı yönetir.
 */
export const getUpNextProgress = async () => {
  try {
    const client = await getTraktClient();
    const limit = 100;
    // Güvenlik tavanı: bozuk bir sayfa başlığı sonsuz döngüye çevirmesin
    // (50 sayfa × 100 = 5.000 dizi, gerçekçi her kütüphaneyi kapsar).
    const MAX_PAGES = 50;
    const buildUrl = (page: number) =>
      `/sync/progress/up_next_nitro?intent=all&page=${page}&limit=${limit}`;

    const first = await client.get(buildUrl(1));
    const allData: any[] = [...first.data];

    const totalPagesStr = first.headers['x-pagination-page-count'];
    const parsedPages = totalPagesStr ? parseInt(totalPagesStr, 10) : 1;
    const totalPages = Math.min(Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : 1, MAX_PAGES);

    // Kalan sayfalar getWatchedShows ile aynı desenle (5'li paralel gruplar +
    // gruplar arası kısa bekleme) çekilir — Trakt rate limit koruması.
    if (totalPages > 1) {
      for (let i = 2; i <= totalPages; i += 5) {
        const chunkPromises = [];
        for (let j = i; j < i + 5 && j <= totalPages; j++) {
          chunkPromises.push(client.get(buildUrl(j)));
        }
        const responses = await Promise.all(chunkPromises);
        responses.forEach((res) => allData.push(...res.data));
        if (i + 5 <= totalPages) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    return allData;
  } catch (error) {
    console.error('Trakt API Hatası (getUpNextProgress):', error);
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

export const addMovieToHistory = async (movieId: number, watchedAt?: string) => {
  try {
    const client = await getTraktClient();
    const payload = {
      movies: [
        {
          ids: { trakt: movieId },
          ...(watchedAt ? { watched_at: watchedAt } : {})
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
    // bkz. addEpisodeToHistory üstündeki "AÇIK ZAMAN DAMGASI" notu.
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

// NOT: `getAllHiddenItems`'taki gibi (bkz. aşağıdaki not) bunlar da
// `/users/hidden/*` ailesine gittiği için aynı tarayıcı CORS reddine takılıyor
// — proxy üzerinden gönderilir, `TRAKT_PROXY_URL`/token-header deseni birebir aynı.
export const hideItemTrakt = async (id: number, type: 'show' | 'movie') => {
  try {
    const accessToken = await SecureStore.getItemAsync('traktAccessToken');
    const body = {
      [type === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: id } }]
    };
    // Sadece dizilerin progress'i gizlenebilir (Trakt API dökümantasyonuna göre film progressi yok, genelde shows is hidden)
    const section = type === 'show' ? 'progress_watched' : 'calendar';
    const response = await axios.post(TRAKT_PROXY_URL, body, {
      params: { endpoint: `/users/hidden/${section}` },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (hideItemTrakt):', error);
    throw error;
  }
};

export const unhideItemTrakt = async (id: number, type: 'show' | 'movie') => {
  try {
    const accessToken = await SecureStore.getItemAsync('traktAccessToken');
    const body = {
      [type === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: id } }]
    };
    const section = type === 'show' ? 'progress_watched' : 'calendar';
    const response = await axios.post(TRAKT_PROXY_URL, body, {
      params: { endpoint: `/users/hidden/${section}/remove` },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (unhideItemTrakt):', error);
    throw error;
  }
};

// Trakt'ın `/users/hidden/:section` uç noktası SAYFALANDIRILMIŞTIR (resmi
// dokümanda page/limit destekli). ESKİ DAVRANIŞ: tek istek + `limit=200`, sayfa
// döngüsü YOK. Bu, "Gizle" yalnızca nadiren kullanılan bir ek özellikken
// görünmeyen ama artık KRİTİK olan bir hata: gizleme uygulamanın tek "Bırak"
// mekanizması olduğundan liste zamanla kolayca 200'ü aşar ve 200. sıradan
// sonraki her dizi/film `hiddenShowIds`'e HİÇ girmez — kullanıcının bıraktığı
// yapımlar sessizce takip panosuna geri döner ve "Gizlenenler/Bırakılanlar"
// filtresinden kaybolur. Artık tüm sayfalar, dosyanın geri kalanıyla (bkz.
// getWatchedShows) aynı `x-pagination-page-count` başlığı desenine göre çekilir.
const HIDDEN_PAGE_LIMIT = 100;
// Güvenlik tavanı: bozuk/beklenmedik bir başlık yüzünden sonsuz döngüye
// girilmesin (10.000 gizli öğe gerçekçi her kullanıcıyı fazlasıyla kapsar).
const HIDDEN_MAX_PAGES = 100;

// CDN ÖNBELLEK KIRICI (cache-busting) — CİHAZLAR ARASI SENKRONUN ŞARTI.
// Trakt'ın CDN'i GET yanıtlarını agresif önbelliyor (bkz. docs/HISTORY.md
// Madde 9: "Trakt'ın CDN önbelleğinden kaynaklı veri gecikmeleri... Çözüm:
// Tüm GET isteklerine cb=${Date.now()} eklendi" — o koruma sonraki
// refaktörlerde bu dosyadan kaybolmuş, yalnızca services/api/comments.ts'te
// kalmıştı). Bu uç noktanın URL'si her çağrıda BİREBİR AYNI olduğundan
// (`?type=show&page=1&limit=100`) mükemmel bir önbellek anahtarı oluşturuyor.
// Sonuç: Cihaz A bir diziyi bıraktığında POST Trakt'a anında işleniyor ama
// Cihaz B'nin hemen ardından attığı GET, CDN'de duran ESKİ listeyi alıp
// diziyi hâlâ "Aktif"te gösteriyordu — önbellek düşünce (dakikalar sonra ya
// da tekrar denendiğinde) kendiliğinden düzeldiği için de "bazen oluyor
// bazen olmuyor" şeklinde görünüyordu ve hata günlüğüne HİÇBİR iz düşmüyordu
// (istek teknik olarak 200 dönüyordu, sadece içeriği bayattı).
// NEDEN client-side getTraktClient() (direkt Trakt'a) DEĞİL: `/users/hidden/*`
// tarayıcıdan (web) doğrudan çağrıldığında Trakt CORS preflight'ını
// reddediyor (Access-Control-Allow-Origin başlığı gelmiyor) — diğer Trakt uç
// noktalarının çoğu bu sorunu yaşamıyor, yalnızca bu ikisinde gözlemlendi.
// server.js'teki /api/trakt (auth) ve /api/tmdb ile AYNI proxy deseni
// uygulandı: sunucu-sunucu isteği CORS'a hiç tabi değil.
//
// ⚠️ services/api/auth.ts'teki notla AYNI gerekçeyle: bu URL seçimine
// Platform.OS kontrolü EKLENMEDİ (bkz. docs/HISTORY.md Madde 91) — hem native
// hem web aynı /api/trakt-proxy yolunu, aynı EXPO_PUBLIC_API_URL mutlak/göreli
// seçim mantığıyla kullanıyor.
const TRAKT_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt-proxy`
  : '/api/trakt-proxy';

const getAllHiddenItems = async (section: 'progress_watched' | 'calendar', type: 'show' | 'movie') => {
  const accessToken = await SecureStore.getItemAsync('traktAccessToken');
  // Token URL/query string'e DEĞİL, isteğin kendi Authorization başlığına
  // konur — sunucu erişim loglarında kalıcı iz bırakmaması için.
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  // CDN önbellek kırıcı (bkz. docs/HISTORY.md Madde 9/102) — `_` her çağrıda
  // benzersiz olmalı ki Trakt'ın CDN'i bayat bir yanıtı önbellekten dönmesin.
  const fetchPage = (page: number) =>
    axios.get(TRAKT_PROXY_URL, {
      params: { endpoint: `/users/hidden/${section}`, type, page, limit: HIDDEN_PAGE_LIMIT, _: Date.now() },
      headers,
    });

  const first = await fetchPage(1);
  const allData: any[] = [...first.data];

  const totalPagesStr = first.headers['x-pagination-page-count'];
  const parsedPages = totalPagesStr ? parseInt(totalPagesStr, 10) : 1;
  const totalPages = Math.min(Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : 1, HIDDEN_MAX_PAGES);

  // Sıralı (paralel değil): gizli listeler tipik olarak küçüktür ve bu istek
  // zaten en düşük öncelikli arka plan turunda çalışır — Trakt'ın rate limit'ini
  // zorlamaya değmez.
  for (let page = 2; page <= totalPages; page++) {
    const response = await fetchPage(page);
    allData.push(...response.data);
  }

  return allData;
};

/** "İlerlemeyi Gizle" (= uygulamadaki "Bırak") ile gizlenmiş dizilerin TAM
 * listesi — senkron sırasında `hiddenShowIds`'i güncel tutmak ve kütüphanenin
 * "Gizlenenler/Bırakılanlar" filtresini beslemek için kullanılır. İzleme
 * geçmişine (watched/history) HİÇ dokunmaz, yalnızca hangi dizilerin
 * "ilerleme/devam et" görünümünden gizlendiğini bildirir. */
export const getHiddenShows = async () => {
  try {
    return await getAllHiddenItems('progress_watched', 'show');
  } catch (error) {
    console.error('Trakt API Hatası (getHiddenShows):', error);
    throw error;
  }
};

/** Filmler için `progress_watched` bölümü YOKTUR (Trakt'ta filmlerin ilerlemesi
 * olmaz; o bölüm yalnızca show/season kabul eder) — bu yüzden filmler
 * `hideItemTrakt`/`unhideItemTrakt` ile `calendar` bölümünden gizlenir ve
 * burada da oradan okunur. `getHiddenShows` ile aynı sözleşme. */
export const getHiddenMovies = async () => {
  try {
    return await getAllHiddenItems('calendar', 'movie');
  } catch (error) {
    console.error('Trakt API Hatası (getHiddenMovies):', error);
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

// ══════════════════════════════════════════════════════════════════════════
// `/users/settings` — Gizli Hesap + Profili Düzenle'nin ORTAK veri katmanı
// ══════════════════════════════════════════════════════════════════════════
// Uç nokta Trakt'ın resmi API sözleşmesiyle doğrulandı (github.com/trakt/trakt-api,
// `users/schema/request/settingsRequestSchema.ts`): `PUT /users/settings`,
// gövde `{ user: { name?, about?, location?, private?, dob? } }`, başarıda
// gövdesiz `201`. Okuma: `GET /users/settings` → `{ user: { name, about, private, ... } }`.
//
// NEDEN NATIVE'DE PROXY YOK (bkz. docs/HISTORY.md Madde 132): Proxy YALNIZCA
// tarayıcı CORS'u için var (Madde 109/120/122). Native'de CORS diye bir şey
// YOKTUR — uygulamanın diğer TÜM Trakt çağrıları zaten `getTraktClient()` ile
// doğrudan gidiyor. Native'i de proxy'ye bağlamak, özelliği gereksiz yere
// "sunucu güncel mi" sorusuna bağımlı kılıyordu ve gerçekte KIRILMASINA sebep
// oldu. Artık native doğrudan Trakt'a gider; proxy yalnızca web'de devrede.
// Ek fayda: `getTraktClient()` 401'de token yenileme/rate-limit/circuit breaker
// mantığını da getiriyor — ham `axios` çağrısında bunların hiçbiri yoktu.
//
// ⚠️ Bu, `services/api/auth.ts`'teki "Platform.OS KONTROLÜ EKLEMEYİN"
// uyarısıyla ÇELİŞMEZ: o uyarı `TRAKT_PROXY_URL`'in MUTLAK/GÖRELİ seçim
// koşuluna aittir (Madde 88/91 — web'i göreli yola zorlamak, API'yi ayrı bir
// makinede barındıran bu kurulumu kırmıştı). Aşağıdaki `TRAKT_PROXY_URL`
// tanımına HİÇ DOKUNULMADI; burada karar verilen şey URL'in şekli değil,
// "web dışında proxy'ye hiç uğramaya gerek var mı" sorusudur.
const isWeb = Platform.OS === 'web';

/**
 * Proxy'nin isteği Trakt'a GERÇEKTEN ilettiğini doğrular.
 *
 * Kök neden (Madde 132): `server.js`'in SPA fallback'i eşleşmeyen HER isteğe
 * `200 + index.html` döndürüyordu. Sunucuda `PUT /api/trakt-proxy` handler'ı
 * yoksa (henüz deploy edilmemişse) istemci HTML'i 2xx sanıp "kaydedildi"
 * diyordu — istek Trakt'a hiç ulaşmadan. Bu guard o sessiz yalanı GÖRÜNÜR bir
 * hataya çevirir; sunucu düzeltmesi deploy edilene kadar da koruma sağlar.
 */
const assertProxyReachedTrakt = (response: any, label: string): void => {
  const contentType = String(response?.headers?.['content-type'] ?? '');
  const looksLikeHtml =
    contentType.includes('text/html') ||
    (typeof response?.data === 'string' && response.data.trimStart().startsWith('<'));

  if (looksLikeHtml) {
    throw new Error(
      `[${label}] İstek Trakt'a ulaşmadı: proxy JSON yerine HTML döndürdü. ` +
        `Sunucuda /api/trakt-proxy handler'ı eksik olabilir (server.js güncel mi?).`
    );
  }
};

/**
 * Web'deki proxy yolu `getTraktClient()`'ın axios instance'ını hiç
 * KULLANMADIĞI için, o instance'a bağlı 401→token-yenileme interceptor'ından
 * da hiç geçmiyor. Burada AYNI davranış elle uygulanıyor: 401 alınca
 * `refreshAccessToken()` (traktClient.ts'teki paylaşılan mutex) ile bir kez
 * yenile, isteği TEK SEFERLİK tekrar dene.
 */
const webProxyGet = async (params: Record<string, unknown>): Promise<any> => {
  const send = async () => {
    const accessToken = await SecureStore.getItemAsync('traktAccessToken');
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    return axios.get(TRAKT_PROXY_URL, { params, headers });
  };

  try {
    return await send();
  } catch (error: any) {
    if (error?.response?.status === 401) {
      await refreshAccessToken();
      return await send();
    }
    throw error;
  }
};

/** `GET /users/settings` — native doğrudan, web proxy üzerinden. */
export const getUserSettings = async (): Promise<any> => {
  try {
    if (!isWeb) {
      const client = await getTraktClient();
      // Trakt CDN'i aynı URL'yi önbelliyor (bkz. Madde 87/102/130).
      const response = await client.get(`/users/settings?_=${Date.now()}`);
      return response.data;
    }

    const response = await webProxyGet({ endpoint: '/users/settings', _: Date.now() });
    assertProxyReachedTrakt(response, 'getUserSettings');
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getUserSettings):', error);
    throw error;
  }
};

/**
 * Hesabın Trakt'taki gizlilik durumu — SALT OKUNUR.
 *
 * ⛔ YAZMA FONKSİYONU EKLEMEYİN (bkz. docs/HISTORY.md Madde 134): Trakt'ın
 * PUBLIC API'sinde `/users/settings` için YALNIZCA `GET` vardır. `PUT
 * /users/settings` Trakt'ın KENDİ web uygulamasına ait first-party bir uç
 * noktadır (github.com/trakt/trakt-api'de tanımlı ama public dokümantasyonda
 * YOK) — üçüncü parti bir API anahtarıyla çağrıldığında, kullanıcının token'ı
 * tamamen geçerli olsa bile `401 invalid_token` döner (canlı olarak
 * doğrulandı; yanıt ayrıca `Set-Cookie: _traktsession` içeriyor, yani
 * oturum-tabanlı first-party akıştan geçiyor). Bu yüzden ad/bio/gizlilik
 * uygulama içinden DEĞİŞTİRİLEMEZ; kullanıcı trakt.tv'ye yönlendirilir.
 */
export const getProfilePrivacy = async (): Promise<boolean> => {
  const settings = await getUserSettings();
  return settings?.user?.private ?? false;
};

import { getTraktClient } from '../traktClient';

export const getWatchedShows = async () => {
  try {
    const client = await getTraktClient();
    const limit = 100;
    let page = 1;
    let allData: any[] = [];

    // İlk sayfayı çek
    const response = await client.get(`/sync/watched/shows?extended=full&page=${page}&limit=${limit}`);
    allData = [...response.data];

    // Toplam sayfa sayısını header'dan al
    const totalPagesStr = response.headers['x-pagination-page-count'];
    const totalPages = totalPagesStr ? parseInt(totalPagesStr, 10) : 1;

    // Kalan sayfaları çek
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
    console.error('Trakt API Hatası (getWatchedShows):', error);
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
    console.error('Trakt API Hatası (addEpisodeToHistory):', error);
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
    console.error('Trakt API Hatası (addSeasonToHistory):', error);
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
    console.error('Trakt API Hatası (addEpisodesBulkToHistory):', error);
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
    console.error('Trakt API Hatası (getShowProgress):', error);
    throw error;
  }
};

export const getWatchedMovies = async () => {
  try {
    const client = await getTraktClient();
    const limit = 100;
    let page = 1;
    let allData: any[] = [];

    // İlk sayfayı çek
    const response = await client.get(`/sync/watched/movies?extended=full&page=${page}&limit=${limit}`);
    allData = [...response.data];

    // Toplam sayfa sayısını header'dan al
    const totalPagesStr = response.headers['x-pagination-page-count'];
    const totalPages = totalPagesStr ? parseInt(totalPagesStr, 10) : 1;

    // Kalan sayfaları çek
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
    console.error('Trakt API Hatası (getWatchedMovies):', error);
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
    console.error('Trakt API Hatası (addMovieToHistory):', error);
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
    console.error('Trakt API Hatası (removeFromHistoryTrakt):', error);
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

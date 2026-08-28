import axios from 'axios';
import { getTraktClient, applyTranslation } from './traktClient';
import {
  fetchTraktCatalog,
  isTraktCatalogViaPiEnabled,
  reportCatalogConfig,
  catalogErrorTags,
} from './traktCatalogClient';
import { logWarning } from '../../utils/errorLog';
import i18n from '../../locales/index';
import { CACHE_TTL } from '../../utils/cacheTTL';

// Sayfa başına önbellek: Keşfet ekranı her mount'ta (kalıcı bir store'a
// yazılmadığından) baştan `getTrendingShows(1, ...)` çağırıyordu — kullanıcı
// sekmeye her giriş çıkışında aynı trend listesi yeniden ağdan çekiliyordu
// (bkz. performans raporu: `shows/trending` tek oturumda 30 çağrı). Trend
// tabloları dakikalar içinde önemli ölçüde değişmediğinden kısa bir TTL
// yeterli; `force` (pull-to-refresh, dil değişimi) önbelleği bilerek atlar.
const trendingShowsCache = new Map<number, { data: any; fetchedAt: number }>();

// `getTraktClient()` doğrudan `https://api.trakt.tv`'ye gider — tarayıcıdan
// çağrıldığında Trakt CORS preflight'ını reddediyor (`/users/hidden/*`
// ailesiyle AYNI sorun, bkz. services/api/users/watchlist.ts). Bu uç
// kimlik gerektirmeyen public veri döndürdüğünden `/api/trakt-proxy` +
// CORS-güvenli köprü deseni burada da uygulandı (server/security.js'teki
// beyaz listeye eklendi); hem native hem web aynı yolu kullanır.
const TRAKT_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt-proxy`
  : '/api/trakt-proxy';

export const getTrendingShows = async (page = 1, limit = 7, force = false) => {
  const cached = trendingShowsCache.get(page);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL.SHORT) {
    return cached.data;
  }
  try {
    const response = await axios.get(TRAKT_PROXY_URL, {
      params: { endpoint: '/shows/trending', extended: 'full', page, limit },
    });
    trendingShowsCache.set(page, { data: response.data, fetchedAt: Date.now() });
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getTrendingShows):', error);
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
  // 🆕 LazyFetch L7: bu çağrı KATALOG verisidir (kimseye ait değil) ve
  // bugüne kadar Pi'yi hiç görmüyordu. Bayrak açıksa Pi'nin önbellekli
  // geçidinden geçer — ölçülen kazanç: 610 ms → 2,4 ms.
  //
  // 🔴 GERİ DÜŞÜŞ: geçit herhangi bir sebeple çalışmazsa AŞAĞIDAKİ eski
  // yol devreye girer. Bir dizi ekranının açılmaması, önbellek kazancından
  // kat kat pahalıdır.
  // 🔴 Yapılandırma her koşulda bir kez raporlanır — bayrak KAPALIYKEN de.
  // Kapalıysa aşağıdaki blok hiç çalışmaz, yani hata da oluşmaz ve
  // Geliştirici Paneli boş kalırdı; boş panel "sorun yok" değil "hiç
  // denenmedi" demek olurdu (bkz. traktCatalogClient.ts teşhis notu).
  reportCatalogConfig();

  if (isTraktCatalogViaPiEnabled()) {
    try {
      return await fetchTraktCatalog(`/shows/${showId}/seasons`, { extended: 'full,episodes' });
    } catch (error) {
      // `logWarning` → yalnızca cihazdaki günlük + Geliştirici Paneli;
      // Discord'a GİTMEZ (teşhis gürültüsü operasyon kanalını kirletmesin).
      logWarning(
        'L7/getShowSeasons',
        error,
        catalogErrorTags(error, { showId: String(showId), sonuc: 'eski-yola-dusuldu' })
      );
      // bilinçli olarak yutuluyor — aşağıdaki eski yol denenecek
    }
  }

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

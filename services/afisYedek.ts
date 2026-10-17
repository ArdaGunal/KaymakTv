import axios from 'axios';

// K1(b) · LAZYFETCH-01 (M532) — TMDB afiş yolu alınamadığında (TMDB'de yok, 503, kesinti)
// Pi'deki arşivin Trakt afiş adresi. Uç salt okuma: Trakt'a/TMDB'ye gitmez, kova dolu
// ya da TMDB çökmüşken de cevap verir. Görsel baytı Trakt'ın kendi CDN'inden gelir.
const AFIS_YEDEK_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/afis-yedek`
  : '/api/afis-yedek';

// Sunucu da süzüyor; istemci yine de yalnız Trakt'ın görsel sunucularını kabul eder.
const TRAKT_GORSEL = /^https:\/\/(media|walter[a-z0-9-]*)\.trakt\.tv\//;

/** Yedek afiş adresi ya da null. Asla fırlatmaz — yedek, ana yolun hatasını büyütmemeli. */
export const traktAfisYedegi = async (tur: 'show' | 'movie', tmdbId: number): Promise<string | null> => {
  try {
    const { data } = await axios.get(AFIS_YEDEK_URL, { params: { tur, tmdb: String(tmdbId) }, timeout: 8000 });
    const url = data?.url;
    return typeof url === 'string' && TRAKT_GORSEL.test(url) ? url : null;
  } catch {
    return null;
  }
};

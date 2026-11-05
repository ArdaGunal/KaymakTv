import { fetchFromTmdb } from './tmdbApi';
import { dilBilgisi } from '../locales/diller';
import { adTemizle, ceviriAdi } from '../locales/baslikElemesi.js';

export type TmdbBasliklari = { original_title: string | null; titles: Record<string, string> };

/**
 * Detay ekranının başlık alanları (BASLIK §0). Aynı TMDB yanıtı afiş için de çekiliyor, Pi önbelleğinde
 * duruyor. Eleme kuralı aynaya gidenle tek dosyada. Hata ekranı bozmaz, `null` döner.
 */
export const getTmdbBasliklari = async (tmdbId: number, tur: 'tv' | 'movie', dil: string): Promise<TmdbBasliklari | null> => {
  const kayit = dilBilgisi(dil);
  try {
    const { data } = await fetchFromTmdb(`/${tur}/${tmdbId}`, { language: kayit.etiket });
    const ozgunAd = adTemizle(data?.original_name ?? data?.original_title);
    const ad = ceviriAdi({
      ad: data?.name ?? data?.title,
      ozgunAd,
      ozgunDil: data?.original_language,
      hedefDil: kayit.kod,
      hedefAlfabe: kayit.alfabe,
    });
    return { original_title: ozgunAd, titles: ad ? { [kayit.kod]: ad } : {} };
  } catch {
    return null;
  }
};

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTmdbBasliklari, type TmdbBasliklari } from '../services/tmdbBasliklari';

/**
 * Detay ekranı Trakt özetini kullanır; Trakt çeviri vermiyor (BASLIK §0). Yapımın adı ve çevirisi
 * TMDB'den tamamlanır. Gelene kadar ve gelmezse özet olduğu gibi kalır, ekran beklemez.
 */
export function useTmdbBasliklari<T extends { ids?: { tmdb?: number | string } } | null | undefined>(
  yapim: T,
  tur: 'tv' | 'movie'
): T {
  const { i18n } = useTranslation();
  const tmdbId = Number(yapim?.ids?.tmdb) || null;
  const [ek, setEk] = useState<TmdbBasliklari | null>(null);

  useEffect(() => {
    setEk(null);
    if (!tmdbId) return undefined;
    let canli = true;
    getTmdbBasliklari(tmdbId, tur, i18n.language).then((sonuc) => {
      if (canli) setEk(sonuc);
    });
    return () => { canli = false; };
  }, [tmdbId, tur, i18n.language]);

  return useMemo(() => (yapim && ek ? { ...yapim, ...ek } : yapim), [yapim, ek]);
}

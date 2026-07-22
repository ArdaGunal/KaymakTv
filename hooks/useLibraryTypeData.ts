import { useEffect, useMemo, useState } from 'react';
import {
  getWatchedShows,
  getWatchedMovies,
  getCustomLists,
  getLikedShows,
  getLikedMovies,
} from '../services/traktApi';
import { useLibrarySelector } from '../context/LibraryContext';
import { filterUserLists } from '../utils/listHelpers';

export type LibraryType = 'shows' | 'movies' | 'favShows' | 'favMovies' | 'lists';

export interface LibraryItem {
  /**
   * FlatList `keyExtractor`'ı için GARANTİLİ eşsiz anahtar. Eskiden anahtar
   * `${id}-${index}` ile üretiliyordu; index anahtara girdiği için liste
   * süzüldüğünde/sıralandığında aynı dizi her seferinde YENİ bir kimlik alıyor,
   * FlatList hücreleri geri dönüştüremeyip hepsini baştan monte ediyordu
   * (posterler yeniden yükleniyor, kaydırma takılıyordu). Anahtar artık
   * yalnızca kalıcı kimlikten türetiliyor.
   */
  key: string;
  id: number | undefined;
  title: string | undefined;
  tmdbId: number | undefined;
}

/**
 * Kimliğe göre tekilleştirir ve her öğeye kalıcı bir `key` yazar. Trakt aynı
 * diziyi/filmi bazı durumlarda (ör. birden fazla izleme kaydı) tekrar
 * döndürebiliyor; yinelenen anahtar React'te "aynı kart iki kez" ve bozuk
 * hücre geri dönüşümüne yol açıyordu.
 */
function withUniqueKeys(items: Omit<LibraryItem, 'key'>[], prefix: string): LibraryItem[] {
  const seen = new Set<string>();
  const result: LibraryItem[] = [];

  items.forEach((item, index) => {
    const key = item.id != null ? `${prefix}-${item.id}` : `${prefix}-idx${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ ...item, key });
  });

  return result;
}

function mapMediaItems(items: any[], itemType: 'show' | 'movie'): LibraryItem[] {
  return withUniqueKeys(
    items.map((item: any) => ({
      id: itemType === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
      title: itemType === 'show' ? item.show?.title : item.movie?.title,
      tmdbId: itemType === 'show' ? item.show?.ids?.tmdb : item.movie?.ids?.tmdb,
    })),
    itemType
  );
}

const sortByWatchedAt = (items: any[]) =>
  [...items].sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime());

function mapListItems(items: any[]): LibraryItem[] {
  return withUniqueKeys(
    items.map((item: any) => ({
      id: item.ids?.trakt,
      title: item.name,
      tmdbId: undefined,
    })),
    'list'
  );
}

const TITLE_KEYS: Record<LibraryType, string> = {
  shows: 'shows',
  movies: 'movies',
  favShows: 'favShows',
  favMovies: 'favMovies',
  lists: 'lists',
};

export function getLibraryTitleKey(type: string | string[] | undefined): string {
  if (typeof type === 'string' && type in TITLE_KEYS) {
    return TITLE_KEYS[type as LibraryType];
  }
  return 'library';
}

// Fallback: store boşsa (soğuk başlangıçta doğrudan bu ekrana gelinmişse) ağdan çek.
const FALLBACK_FETCHERS: Record<LibraryType, () => Promise<any[]>> = {
  shows: getWatchedShows,
  movies: getWatchedMovies,
  favShows: getLikedShows,
  favMovies: getLikedMovies,
  lists: getCustomLists,
};

/**
 * Kütüphane detay ekranlarının (mobil + web) ortak veri hook'u.
 *
 * Performans sözleşmesi: veri ÖNCE Zustand store'undan senkron okunur — ekran
 * anında açılır (eskiden her açılışta 600-700 öğe Trakt'tan yeniden indiriliyordu).
 * Ağ isteği yalnızca ilgili store dilimi tamamen boşken (fallback) atılır;
 * store dolduğunda seçici abonelik sayesinde liste kendiliğinden güncellenir.
 */
export function useLibraryTypeData(type: string | string[] | undefined, accessToken: string | null | undefined) {
  const slices = useLibrarySelector(s => ({
    watchedShows: s.watchedShows,
    watchedMovies: s.watchedMovies,
    favShows: s.favShows,
    favMovies: s.favMovies,
    customLists: s.customLists,
    isLoading: s.isLoading,
  }));

  const [fallbackData, setFallbackData] = useState<LibraryItem[] | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  const storeData = useMemo<LibraryItem[]>(() => {
    switch (type) {
      case 'shows': return mapMediaItems(sortByWatchedAt(slices.watchedShows || []), 'show');
      case 'movies': return mapMediaItems(sortByWatchedAt(slices.watchedMovies || []), 'movie');
      case 'favShows': return mapMediaItems(slices.favShows || [], 'show');
      case 'favMovies': return mapMediaItems(slices.favMovies || [], 'movie');
      case 'lists': return mapListItems(slices.customLists || []);
      default: return [];
    }
  }, [type, slices.watchedShows, slices.watchedMovies, slices.favShows, slices.favMovies, slices.customLists]);

  useEffect(() => {
    // Store bu dilim için doluysa fallback'e hiç gerek yok.
    if (!accessToken || storeData.length > 0 || slices.isLoading) return;
    if (typeof type !== 'string' || !(type in FALLBACK_FETCHERS)) return;

    let cancelled = false;
    setFallbackLoading(true);
    FALLBACK_FETCHERS[type as LibraryType]()
      .then((res) => {
        if (cancelled) return;
        // Fallback ağdan geldiği için favori (liked) listesini burada da ayıkla.
        if (type === 'lists') setFallbackData(mapListItems(filterUserLists(res)));
        else if (type === 'shows' || type === 'movies') {
          setFallbackData(mapMediaItems(sortByWatchedAt(res), type === 'shows' ? 'show' : 'movie'));
        } else {
          setFallbackData(mapMediaItems(res, type === 'favShows' ? 'show' : 'movie'));
        }
      })
      .catch((error) => console.log('Kütüphane fallback veri hatası:', error))
      .finally(() => { if (!cancelled) setFallbackLoading(false); });

    return () => { cancelled = true; };
  }, [type, accessToken, storeData.length, slices.isLoading]);

  const data = storeData.length > 0 ? storeData : (fallbackData ?? []);
  const loading = data.length === 0 && (slices.isLoading || fallbackLoading);

  return { data, loading };
}

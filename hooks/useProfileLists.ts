import { useState, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCustomListItems } from '../services/traktApi';
import { getShowPoster, getMoviePoster } from '../services/tmdbApi';

export interface EnrichedList {
  id: number | string;
  title: string;
  itemCount: number;
  coverImageUrl: string | null;
}

const COVER_CACHE_KEY = '@profile_list_covers_v1';
const COVER_TTL = 24 * 60 * 60 * 1000; // 24 saat
const CONCURRENCY = 4;

interface CoverCacheEntry {
  url: string | null;
  itemCount: number;
  fetchedAt: number;
}

type CoverCache = Record<string, CoverCacheEntry>;

let memoryCoverCache: CoverCache | null = null;

const readCoverCache = async (): Promise<CoverCache> => {
  if (memoryCoverCache) return memoryCoverCache;
  try {
    const raw = await AsyncStorage.getItem(COVER_CACHE_KEY);
    memoryCoverCache = raw ? JSON.parse(raw) : {};
  } catch {
    memoryCoverCache = {};
  }
  return memoryCoverCache!;
};

const writeCoverCache = (cache: CoverCache) => {
  memoryCoverCache = cache;
  AsyncStorage.setItem(COVER_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
};

const fetchCover = async (listId: number | string): Promise<string | null> => {
  try {
    const items = await getCustomListItems(listId);
    const first = items?.[0];
    const tmdbId = first?.show?.ids?.tmdb || first?.movie?.ids?.tmdb;
    if (!tmdbId) return null;
    return first.movie ? await getMoviePoster(tmdbId) : await getShowPoster(tmdbId);
  } catch {
    return null;
  }
};

/**
 * Profil listelerini kapak görselleriyle birlikte verir.
 *
 * Performans sözleşmesi:
 * - Liste adı/sayısı store'dan ANINDA döner (ağ beklenmez) — UI hemen çizilir.
 * - Kapaklar AsyncStorage'da 24 saat önbelleklenir; sadece eksik/bayat/değişmiş
 *   (item_count farklı) listeler için, en fazla 4'lü gruplar halinde arka planda çekilir.
 * - Eldeki liste verisi varken isLoading asla true'ya geri dönmez (skeleton flaşı yok).
 */
export function useProfileLists(
  customLists: any[],
  isLibraryLoading: boolean
): { lists: EnrichedList[]; isLoading: boolean } {
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const enrichRunId = useRef(0);

  // Metadata senkron türetilir — ağ yok, gecikme yok.
  const baseLists = useMemo<EnrichedList[]>(
    () =>
      (customLists || [])
        .filter((item: any) => item.ids?.trakt)
        .map((item: any) => ({
          id: item.ids.trakt,
          title: item.name,
          itemCount: item.item_count ?? 0,
          coverImageUrl: covers[String(item.ids.trakt)] ?? null,
        })),
    [customLists, covers]
  );

  useEffect(() => {
    if (!customLists || customLists.length === 0) return;

    const runId = ++enrichRunId.current;

    (async () => {
      const cache = await readCoverCache();
      const now = Date.now();

      // 1. Önbellekten anında doldur
      const cachedCovers: Record<string, string | null> = {};
      const staleLists: { id: number | string; itemCount: number }[] = [];

      for (const item of customLists) {
        const listId = item.ids?.trakt;
        if (!listId) continue;
        const key = String(listId);
        const entry = cache[key];
        const itemCount = item.item_count ?? 0;

        if (entry && entry.itemCount === itemCount && now - entry.fetchedAt < COVER_TTL) {
          cachedCovers[key] = entry.url;
        } else {
          if (entry) cachedCovers[key] = entry.url; // bayat da olsa hemen göster (SWR)
          staleLists.push({ id: listId, itemCount });
        }
      }

      if (enrichRunId.current !== runId) return;
      if (Object.keys(cachedCovers).length > 0) {
        setCovers(prev => ({ ...prev, ...cachedCovers }));
      }

      // 2. Eksik/bayat kapakları sınırlı eşzamanlılıkla arka planda tazele
      if (staleLists.length === 0) return;

      const freshCovers: Record<string, string | null> = {};
      for (let i = 0; i < staleLists.length; i += CONCURRENCY) {
        const chunk = staleLists.slice(i, i + CONCURRENCY);
        const results = await Promise.all(chunk.map(l => fetchCover(l.id)));
        chunk.forEach((l, idx) => {
          freshCovers[String(l.id)] = results[idx];
          cache[String(l.id)] = { url: results[idx], itemCount: l.itemCount, fetchedAt: Date.now() };
        });
        if (enrichRunId.current !== runId) return;
      }

      writeCoverCache(cache);
      setCovers(prev => ({ ...prev, ...freshCovers }));
    })();
  }, [customLists]);

  // Yalnızca gerçekten hiç veri yokken ve kütüphane hâlâ yüklenirken "yükleniyor" say.
  const isLoading = isLibraryLoading && baseLists.length === 0;

  return { lists: baseLists, isLoading };
}

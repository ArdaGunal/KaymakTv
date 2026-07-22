import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LibraryItem } from './useLibraryTypeData';

/**
 * Kütüphane ekranlarının LOKAL süzme çekirdeği — medya tipinden BAĞIMSIZ.
 *
 * Diziler (4 kategori) ve filmler (3 kategori) arasında değişen tek şey
 * "hangi kategoriler var ve bir öğe hangisine düşer" sorusu. Arama, debounce,
 * taslak seçim, uygula/temizle ve süzme algoritması ikisinde de BİREBİR aynı —
 * bu yüzden burada tek yerde duruyor. Yeni bir medya tipi eklendiğinde yalnızca
 * kendi "durum indeksi" hook'u yazılır.
 *
 * Kural: burada ASLA ağ isteği yapılmaz, eldeki dizi bellekte süzülür.
 */

export const SEARCH_DEBOUNCE_MS = 180;

/** Türkçe'de "I/ı" ve "İ/i" ayrımı yüzünden arama karşılaştırması locale duyarlı yapılır. */
export const normalizeForSearch = (value: string | undefined) =>
  (value || '').toLocaleLowerCase('tr-TR').trim();

export interface MediaStatusIndex<TKey extends string> {
  /** trakt id → kategori. */
  statusOf: ReadonlyMap<number, TKey>;
  /**
   * Ekranın varsayılan listesinde BULUNMAYAN ama kategorilere ait olan öğeler
   * (ör. Diziler'de yalnızca izleme listesindekiler, Filmler'de izlenecekler).
   * Yalnızca kategori filtresi açıkken havuza katılırlar; aksi halde o
   * kategoriler hiçbir zaman sonuç döndüremezdi.
   */
  extraPool: LibraryItem[];
}

export function emptyStatusIndex<TKey extends string>(): MediaStatusIndex<TKey> {
  return { statusOf: new Map<number, TKey>(), extraPool: [] };
}

export interface MediaFilterState<TKey extends string> {
  /** TextInput'un anlık (debounce edilmemiş) değeri — yazarken takılma olmasın diye. */
  searchInput: string;
  setSearchInput: (value: string) => void;
  clearSearch: () => void;
  /** Debounce edilmiş, normalize edilmiş arama sorgusu — süzme bunu kullanır. */
  searchQuery: string;
  /** Uygulanmış kategori seçimi (menüdeki taslak seçim DEĞİL). */
  activeStatuses: TKey[];
  /** Menüdeki "Göster" butonu bunu çağırır — liste yalnızca o an güncellenir. */
  applyStatuses: (next: TKey[]) => void;
  clearAll: () => void;
}

/**
 * Arama + kategori seçimi durumu. `orderedKeys` yalnızca seçimin sırasını
 * normalize etmek için kullanılır (menüdeki tıklama sırası state'e sızmasın).
 */
export function useMediaFilterState<TKey extends string>(
  orderedKeys: readonly TKey[],
  enabled: boolean
): MediaFilterState<TKey> {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatuses, setActiveStatuses] = useState<TKey[]>([]);

  // Debounce: her tuş vuruşunda yüzlerce öğelik listeyi yeniden süzüp FlatList'i
  // baştan render etmek yerine kullanıcı yazmayı bıraktığında bir kez süzülür.
  useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(normalizeForSearch(searchInput)), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Ekran tipi değişirse (shows → movies) süzgeçler sıfırlanmalı; aksi halde
  // önceki ekrandan kalan sorgu yeni listeyi sessizce boşaltırdı.
  useEffect(() => {
    if (enabled) return;
    setSearchInput('');
    setSearchQuery('');
    setActiveStatuses([]);
  }, [enabled]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, []);

  const clearAll = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
    setActiveStatuses([]);
  }, []);

  const applyStatuses = useCallback(
    (next: TKey[]) => {
      // Menüdeki tıklama sırasını değil, sabit kategori sırasını koru — state'in
      // referansı yalnızca gerçekten değiştiğinde yenilensin diye normalize ediyoruz.
      setActiveStatuses(orderedKeys.filter((key) => next.includes(key)));
    },
    [orderedKeys]
  );

  return { searchInput, setSearchInput, clearSearch, searchQuery, activeStatuses, applyStatuses, clearAll };
}

/**
 * Saf süzme: kategori filtresi açıkken havuza `extraPool` katılır, sonra hem
 * kategoriye hem arama metnine göre elenir. Hiçbir filtre yoksa `data`'nın
 * KENDİ referansı döner (gereksiz yeniden render olmasın diye).
 */
export function filterLibraryItems<TKey extends string>(
  data: LibraryItem[],
  index: MediaStatusIndex<TKey>,
  activeStatuses: TKey[],
  searchQuery: string
): LibraryItem[] {
  const statusSet = activeStatuses.length > 0 ? new Set(activeStatuses) : null;
  if (!statusSet && !searchQuery) return data;

  const pool = statusSet ? [...data, ...index.extraPool] : data;

  return pool.filter((item) => {
    if (statusSet) {
      // Hiçbir kategoriye ait olmayan öğeler (ör. izlenip bitmiş, yeni bölüm
      // bekleyen diziler) kategori filtresi açıkken görünmez.
      const status = item.id != null ? index.statusOf.get(item.id) : undefined;
      if (!status || !statusSet.has(status)) return false;
    }
    if (searchQuery && !normalizeForSearch(item.title).includes(searchQuery)) return false;
    return true;
  });
}

export interface UseLibraryFiltersResult<TKey extends string> {
  /** Ekranın render edeceği süzülmüş liste. Filtre yokken referans olarak `data`'nın ta kendisi. */
  filteredData: LibraryItem[];
  searchInput: string;
  setSearchInput: (value: string) => void;
  clearSearch: () => void;
  activeStatuses: TKey[];
  applyStatuses: (next: TKey[]) => void;
  clearAll: () => void;
  /** Herhangi bir süzme etkin mi (boş sonuç ekranını doğru metinle göstermek için). */
  isFiltering: boolean;
}

/**
 * Durum indeksi hazır olduğunda ortak sonucu üretir. Medya tipine özel hook'lar
 * (`useLibraryShowFilters`, `useLibraryMovieFilters`) yalnızca kendi indekslerini
 * hesaplayıp buraya verir.
 */
export function useFilterResult<TKey extends string>(
  data: LibraryItem[],
  enabled: boolean,
  state: MediaFilterState<TKey>,
  index: MediaStatusIndex<TKey>
): UseLibraryFiltersResult<TKey> {
  const { searchQuery, activeStatuses } = state;

  const filteredData = useMemo(
    () => (enabled ? filterLibraryItems(data, index, activeStatuses, searchQuery) : data),
    [data, enabled, index, activeStatuses, searchQuery]
  );

  return {
    filteredData,
    searchInput: state.searchInput,
    setSearchInput: state.setSearchInput,
    clearSearch: state.clearSearch,
    activeStatuses,
    applyStatuses: state.applyStatuses,
    clearAll: state.clearAll,
    isFiltering: enabled && (searchQuery.length > 0 || activeStatuses.length > 0),
  };
}

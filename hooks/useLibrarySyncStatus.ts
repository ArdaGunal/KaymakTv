import { useLibrarySelector } from '../context/LibraryContext';
import { useAuth } from '../context/AuthContext';

/**
 * İlk senkronizasyon (ve her arka plan yenilemesi) sırasında UI'ın "bir şey
 * bozuk" izlenimi vermemesi için tek gerçek kaynak. `useLibraryStore`'daki
 * `isLoading`/`isMoviesLoading` bayraklarını `SyncStatusBanner` için tek bir
 * `isSyncing` sinyaline indirger.
 *
 * ⚠️ `isGuest` kontrolü ŞART — üstünkörü `isLoading || isMoviesLoading`
 * kullanmayın: `context/LibraryContext.tsx`'teki senkron zinciri
 * (`loadCache`/`fetchFreshData`) yalnızca gerçek bir `accessToken` varken
 * çalışır (bkz. `LibraryProvider`'ın `if (accessToken && !authIsLoading)`
 * koruması). Misafir oturumunda bu iki bayrak store'un başlangıç değerinde
 * (`true`) SONSUZA DEK takılı kalır — hiçbir kod yolu onları misafir için
 * `false`'a çekmez. Bu korumasız kullanılsaydı banner her misafirde
 * kalıcı olarak ekranda asılı kalırdı.
 */
export function useLibrarySyncStatus(): boolean {
  const { accessToken, isGuest } = useAuth();
  const { isLoading, isMoviesLoading } = useLibrarySelector((s) => ({
    isLoading: s.isLoading,
    isMoviesLoading: s.isMoviesLoading,
  }));

  return !!accessToken && !isGuest && (isLoading || isMoviesLoading);
}

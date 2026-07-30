import { useCallback, useState } from 'react';
import { getUserProfile, TraktUserProfile } from '../../../services/api/social';
import { useFollowState } from '../../../hooks/useFollowState';
import { extractTraktUsername } from '../utils/extractTraktUsername';

export function useUserSearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [profile, setProfile] = useState<TraktUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Takip et/bırak + bağlantı durumu artık paylaşımlı hook'ta (bkz.
  // hooks/useFollowState.ts) — Public Profile ekranı da aynısını kullanıyor.
  const { connectionState, isLoadingConnection, isFollowPending, toggleFollow } = useFollowState(
    profile?.ids?.slug ?? null
  );

  const clear = useCallback(() => {
    setQuery('');
    setProfile(null);
    setError(null);
  }, []);

  const search = useCallback(async () => {
    const username = extractTraktUsername(query);
    if (!username) return;

    setIsSearching(true);
    setError(null);
    setProfile(null);
    try {
      const foundProfile = await getUserProfile(username);
      setProfile(foundProfile);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('not_found');
      } else {
        setError('generic');
      }
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  return {
    query,
    setQuery,
    isSearching,
    profile,
    error,
    connectionState,
    isLoadingConnection,
    isFollowPending,
    search,
    clear,
    toggleFollow,
  };
}

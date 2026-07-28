import { useCallback, useState } from 'react';
import {
  getUserProfile,
  getMyFollowingSlugs,
  followTraktUser,
  unfollowTraktUser,
  TraktUserProfile,
} from '../../../services/api/social';
import { extractTraktUsername } from '../utils/extractTraktUsername';

export type ConnectionState = 'none' | 'following' | 'pending';

export function useUserSearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [profile, setProfile] = useState<TraktUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('none');
  const [isFollowPending, setIsFollowPending] = useState(false);

  const clear = useCallback(() => {
    setQuery('');
    setProfile(null);
    setError(null);
    setConnectionState('none');
  }, []);

  const search = useCallback(async () => {
    const username = extractTraktUsername(query);
    if (!username) return;

    setIsSearching(true);
    setError(null);
    setProfile(null);
    try {
      const [foundProfile, followingSlugs] = await Promise.all([
        getUserProfile(username),
        getMyFollowingSlugs().catch(() => [] as string[]),
      ]);
      setProfile(foundProfile);
      setConnectionState(followingSlugs.includes(foundProfile.ids.slug) ? 'following' : 'none');
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

  const toggleFollow = useCallback(async () => {
    if (!profile || isFollowPending) return;
    setIsFollowPending(true);

    try {
      if (connectionState === 'none') {
        const result = await followTraktUser(profile.ids.slug);
        setConnectionState(result.approvedAt ? 'following' : 'pending');
      } else {
        await unfollowTraktUser(profile.ids.slug);
        setConnectionState('none');
      }
    } catch (err: any) {
      // 409: zaten takip ediliyor veya istek zaten gönderilmiş — kullanıcıya
      // hata gibi göstermek yerine mevcut durumu "bağlı" kabul ediyoruz.
      if (err?.response?.status === 409 && connectionState === 'none') {
        setConnectionState('pending');
      }
    } finally {
      setIsFollowPending(false);
    }
  }, [profile, connectionState, isFollowPending]);

  return {
    query,
    setQuery,
    isSearching,
    profile,
    error,
    connectionState,
    isFollowPending,
    search,
    clear,
    toggleFollow,
  };
}

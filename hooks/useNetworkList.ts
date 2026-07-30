import { useState, useEffect, useCallback } from 'react';
import { getFollowers, getFollowing, TraktUserProfile } from '../services/api/social';
import { useAuth } from '../context/AuthContext';
import { useFollowStore } from '../store/followStore';

export function useNetworkList(slug: string | null, type: 'followers' | 'following') {
  const { accessToken, isGuest } = useAuth();
  const [data, setData] = useState<TraktUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [page, setPage] = useState(1);
  const { isFetched, isLoading: isStoreLoading, fetchFollowingSlugs } = useFollowStore();

  useEffect(() => {
    if (!accessToken || isGuest) return;
    if (!isFetched) {
      fetchFollowingSlugs();
    }
  }, [accessToken, isGuest, isFetched, fetchFollowingSlugs]);

  // Fetch list when slug/type changes
  useEffect(() => {
    if (!slug) return;
    
    let cancelled = false;
    setIsLoading(true);
    setPage(1);
    
    const fetchFn = type === 'followers' ? getFollowers : getFollowing;
    fetchFn(slug, 1, 20)
      .then((users) => {
        if (!cancelled) {
          setData(users);
          setHasNextPage(users.length === 20);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, type]);

  const fetchNextPage = useCallback(async () => {
    if (!slug || isFetchingNextPage || !hasNextPage || isLoading) return;

    setIsFetchingNextPage(true);
    const nextPage = page + 1;
    const fetchFn = type === 'followers' ? getFollowers : getFollowing;

    try {
      const users = await fetchFn(slug, nextPage, 20);
      setData((prev) => {
        // avoid duplicates
        const newUsers = users.filter((u) => !prev.some((p) => (p.ids?.slug || p.username) === (u.ids?.slug || u.username)));
        return [...prev, ...newUsers];
      });
      setPage(nextPage);
      setHasNextPage(users.length === 20);
    } catch (e) {
      console.warn('Load more failed', e);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [slug, type, page, isFetchingNextPage, hasNextPage, isLoading]);

  return { data, isLoading, fetchNextPage, isFetchingNextPage, isStoreLoading };
}

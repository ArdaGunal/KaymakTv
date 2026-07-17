import { useState, useCallback, useRef } from 'react';
import { getMediaComments } from '../services/traktApi';

const PAGE_LIMIT = 15;

export interface CommentData {
  id: number;
  comment: string;
  spoiler: boolean;
  likes: number;
  replies: number;
  user?: { username?: string; name?: string };
  created_at?: string;
}

export interface UseCommentsResult {
  comments: CommentData[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  loadComments: () => Promise<void>;
  loadMore: () => Promise<void>;
}

interface UseCommentsProps {
  mediaId: number;
  mediaType: 'show' | 'movie' | 'episode';
  season?: number;
  episode?: number;
  sort?: 'likes' | 'newest' | 'oldest';
}

export function useComments({
  mediaId,
  mediaType,
  season,
  episode,
  sort = 'likes',
}: UseCommentsProps): UseCommentsResult {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const pageRef = useRef(1);
  const isFetchingRef = useRef(false);

  const loadComments = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    pageRef.current = 1;

    try {
      const res = await getMediaComments(mediaId, mediaType, sort, 1, PAGE_LIMIT, season, episode);
      const items: CommentData[] = res.data || [];
      setComments(items);
      setTotalCount(res.pagination?.itemCount ?? items.length);
      setHasMore(res.pagination ? res.pagination.page < res.pagination.pageCount : false);
    } catch (err: any) {
      console.error('[useComments] loadComments error:', err);
      setError('Yorumlar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [mediaId, mediaType, sort, season, episode]);

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || loadingMore || !hasMore) return;
    isFetchingRef.current = true;
    setLoadingMore(true);

    const nextPage = pageRef.current + 1;

    try {
      const res = await getMediaComments(mediaId, mediaType, sort, nextPage, PAGE_LIMIT, season, episode);
      const items: CommentData[] = res.data || [];
      if (items.length > 0) {
        setComments(prev => [...prev, ...items]);
        pageRef.current = nextPage;
      }
      setHasMore(res.pagination ? nextPage < res.pagination.pageCount : false);
    } catch (err: any) {
      console.error('[useComments] loadMore error:', err);
    } finally {
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [mediaId, mediaType, sort, season, episode, loadingMore, hasMore]);

  return {
    comments,
    loading,
    loadingMore,
    error,
    hasMore,
    totalCount,
    loadComments,
    loadMore,
  };
}

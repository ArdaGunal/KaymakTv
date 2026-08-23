import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  fetchComments,
  addComment,
  deleteComment,
  setLike,
  getMyLikedCommentIds,
  FeedComment,
} from '../services/feedSocial';
import { getMySupabaseUserId } from '../services/userBlocks';
import { useFeedStore } from '../store/feedStore';

export interface UseFeedCommentsResult {
  comments: FeedComment[];
  isLoading: boolean;
  hasError: boolean;
  isSubmitting: boolean;
  myUserId: string | null;
  likedCommentIds: Set<string>;
  submitComment: (body: string, spoiler: boolean) => Promise<{ ok: true } | { ok: false; message: string }>;
  removeComment: (commentId: string) => Promise<void>;
  toggleCommentLike: (commentId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Bir aktivitenin yorum sheet'i için veri hook'u — Trakt'ın kendi yorum
 * sistemini kullanan `hooks/useComments.ts` ile KARIŞTIRILMASIN, bu
 * tamamen ayrı: KaymakTV'nin kendi Supabase `comments` tablosu (bkz.
 * docs/design/FEED_SOCIAL_PLAN.md).
 */
export function useFeedComments(activityId: string, isOpen: boolean): UseFeedCommentsResult {
  const { accessToken } = useAuth();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [list, myId] = await Promise.all([fetchComments(activityId), getMySupabaseUserId()]);
      setMyUserId(myId);
      setComments(list);
      if (myId && list.length > 0) {
        const liked = await getMyLikedCommentIds(
          myId,
          list.map((c) => c.id)
        );
        setLikedCommentIds(liked);
      } else {
        setLikedCommentIds(new Set());
      }
    } catch (error) {
      console.warn('[Feed] Yorumlar yüklenemedi:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    if (!isOpen) return;
    load();
  }, [isOpen, load]);

  const submitComment = useCallback(
    async (body: string, spoiler: boolean): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (!accessToken) return { ok: false, message: 'Oturum bulunamadı.' };
      setIsSubmitting(true);
      try {
        await addComment(accessToken, activityId, body, spoiler);
        // Yazan kişinin ad/avatarını yerel olarak bilmiyoruz (sunucu satırı
        // yalnızca id/createdAt döndürür) — tam, doğru bir kart için listeyi
        // yeniden çekmek, eksik alanlı sahte bir satır uydurmaktan daha
        // güvenilir. Yorum sık atılan bir eylem değil, maliyeti düşük.
        await load();
        const store = useFeedStore.getState();
        const current = store.activities.find((a) => a.id === activityId);
        if (current) {
          store.patchActivity(activityId, { commentCount: (current.commentCount ?? 0) + 1 });
        }
        return { ok: true };
      } catch (error: any) {
        console.warn('[Feed] Yorum gönderilemedi:', error);
        return { ok: false, message: error?.message || 'Yorum gönderilemedi.' };
      } finally {
        setIsSubmitting(false);
      }
    },
    [accessToken, activityId, load]
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      if (!accessToken) return;
      const previous = comments;
      setComments((list) => list.filter((c) => c.id !== commentId));
      const store = useFeedStore.getState();
      const current = store.activities.find((a) => a.id === activityId);
      if (current) {
        store.patchActivity(activityId, { commentCount: Math.max(0, (current.commentCount ?? 0) - 1) });
      }
      try {
        await deleteComment(accessToken, commentId);
      } catch (error) {
        console.warn('[Feed] Yorum silinemedi:', error);
        setComments(previous);
        if (current) store.patchActivity(activityId, { commentCount: current.commentCount });
      }
    },
    [accessToken, activityId, comments]
  );

  const toggleCommentLike = useCallback(
    async (commentId: string) => {
      if (!accessToken) return;
      const wasLiked = likedCommentIds.has(commentId);
      const nextLiked = !wasLiked;

      setLikedCommentIds((prev) => {
        const next = new Set(prev);
        if (nextLiked) next.add(commentId);
        else next.delete(commentId);
        return next;
      });
      setComments((list) =>
        list.map((c) =>
          c.id === commentId
            ? { ...c, likeCount: Math.max(0, c.likeCount + (nextLiked ? 1 : -1)) }
            : c
        )
      );

      try {
        await setLike(accessToken, 'comment', commentId, nextLiked);
      } catch (error) {
        console.warn('[Feed] Yorum beğenisi gönderilemedi:', error);
        // Geri al.
        setLikedCommentIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(commentId);
          else next.delete(commentId);
          return next;
        });
        setComments((list) =>
          list.map((c) =>
            c.id === commentId
              ? { ...c, likeCount: Math.max(0, c.likeCount + (wasLiked ? 1 : -1)) }
              : c
          )
        );
      }
    },
    [accessToken, likedCommentIds]
  );

  return {
    comments,
    isLoading,
    hasError,
    isSubmitting,
    myUserId,
    likedCommentIds,
    submitComment,
    removeComment,
    toggleCommentLike,
    refresh: load,
  };
}

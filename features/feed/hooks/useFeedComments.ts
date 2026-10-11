import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Başarıda `count`: yeniden yüklenen görünür yorum sayısı (kesin değer). */
  /** Hata metni DÖNMEZ — arayüz t() ile gösterir (M490: ham metin ekrana sızıyordu). */
  submitComment: (body: string, spoiler: boolean) => Promise<{ ok: true; count: number | null } | { ok: false }>;
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
  const begeniUcusta = useRef<Set<string>>(new Set());
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async (): Promise<FeedComment[] | null> => {
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
      return list;
    } catch (error) {
      console.warn('[Feed] Yorumlar yüklenemedi:', error);
      setHasError(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    if (!isOpen) return;
    load();
  }, [isOpen, load]);

  const submitComment = useCallback(
    async (body: string, spoiler: boolean): Promise<{ ok: true; count: number | null } | { ok: false }> => {
      if (!accessToken) return { ok: false };
      setIsSubmitting(true);
      try {
        await addComment(accessToken, activityId, body, spoiler);
        // Yazan kişinin ad/avatarını yerel olarak bilmiyoruz (sunucu satırı
        // yalnızca id/createdAt döndürür) — tam, doğru bir kart için listeyi
        // yeniden çekmek, eksik alanlı sahte bir satır uydurmaktan daha
        // güvenilir. Yorum sık atılan bir eylem değil, maliyeti düşük.
        const list = await load();
        // M476: KESİN değer yazılır, +1 DEĞİL. Sunucu tetikleyicisi sayacı
        // zaten artırıyor ve Realtime UPDATE'i kesin değeri getiriyor; o yankı
        // yeniden yükleme sırasında gelirse «+1» onu ikinci kez artırıyordu
        // (cihazda 1 yorum → «2» görüldü, 2026-10-10).
        const count = list ? list.length : null;
        if (count != null) useFeedStore.getState().patchActivity(activityId, { commentCount: count });
        return { ok: true, count };
      } catch (error: any) {
        console.warn('[Feed] Yorum gönderilemedi:', error);
        return { ok: false };
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
        // B-4 (M489): KESİN değer — geri gelen liste uzunluğu (gönderme yolundaki M476
        // kuralıyla aynı). Eskiden silme öncesi anlık sayaç yazılıyordu; bekleme sırasında
        // Realtime kesin sayıyı getirdiyse onu eziyordu.
        if (current) store.patchActivity(activityId, { commentCount: previous.length });
      }
    },
    [accessToken, activityId, comments]
  );

  const toggleCommentLike = useCallback(
    async (commentId: string) => {
      if (!accessToken) return;
      // B-4 (M489): yorum başına uçuş kilidi. Yoktu → hızlı çift dokunuşta «beğen» ve
      // «geri al» istekleri yarışıyor, sunucu ile ekran ayrışabiliyordu (kart beğenisinde
      // `isLiking` kilidi zaten vardı).
      if (begeniUcusta.current.has(commentId)) return;
      begeniUcusta.current.add(commentId);
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
      } finally {
        begeniUcusta.current.delete(commentId);
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
    refresh: async () => {
      await load();
    },
  };
}

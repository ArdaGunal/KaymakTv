import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  getMySupabaseUserId,
  getUserIdBySlug,
  amIBlocking,
  getBlockedUserIds,
  blockUser as blockUserApi,
  unblockUser as unblockUserApi,
} from '../services/userBlocks';
import { invalidateFeedCache, invalidateVisibleUserIds } from '../services/feedApi';

export interface UseBlockStateResult {
  isLoading: boolean;
  /** Ben mi onu engelledim, yoksa o mu beni — akış/profil görünürlüğü HER
   *  İKİ durumda da kilitlenir (bkz. docs/FEED_SOCIAL_PLAN.md §4.3). */
  isBlockedEitherWay: boolean;
  /** Menüde "Engelle" mi "Engeli Kaldır" mı gösterileceğine karar verir —
   *  yalnızca BENİM attığım engeli kaldırabilirim, karşı tarafınkini değil. */
  didIBlockThem: boolean;
  isMutating: boolean;
  toggleBlock: () => Promise<void>;
}

/**
 * Bir Trakt slug'ı için engel durumu — profil sayfasındaki "..." menüsü VE
 * kilit ekranı bunu paylaşır.
 */
export function useBlockState(traktSlug: string | null): UseBlockStateResult {
  const { accessToken, isGuest } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [didIBlockThem, setDidIBlockThem] = useState(false);
  const [isBlockedEitherWay, setIsBlockedEitherWay] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const refresh = useCallback(async () => {
    if (!traktSlug || !accessToken || isGuest) {
      setDidIBlockThem(false);
      setIsBlockedEitherWay(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [myId, targetId] = await Promise.all([getMySupabaseUserId(), getUserIdBySlug(traktSlug)]);
      if (!myId || !targetId || myId === targetId) {
        setDidIBlockThem(false);
        setIsBlockedEitherWay(false);
        return;
      }
      const [blockedSet, iBlockThem] = await Promise.all([getBlockedUserIds(), amIBlocking(myId, targetId)]);
      setDidIBlockThem(iBlockThem);
      setIsBlockedEitherWay(blockedSet.has(targetId));
    } catch (error) {
      console.warn('[Feed] Engel durumu okunamadı:', error);
    } finally {
      setIsLoading(false);
    }
  }, [traktSlug, accessToken, isGuest]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleBlock = useCallback(async () => {
    if (!traktSlug || !accessToken || isMutating) return;
    setIsMutating(true);
    try {
      if (didIBlockThem) {
        await unblockUserApi(accessToken, traktSlug);
      } else {
        await blockUserApi(accessToken, traktSlug);
      }
      // Akış/görünürlük önbellekleri (bkz. feedApi.ts) blok değişince bayat
      // kalmasın — bu iki dosya birbirini import ETMİYOR (döngü riski), bu
      // yüzden orkestrasyon burada, çağıran hook seviyesinde.
      invalidateVisibleUserIds();
      invalidateFeedCache();
      await refresh();
    } catch (error) {
      console.warn('[Feed] Engelleme işlemi başarısız:', error);
      throw error;
    } finally {
      setIsMutating(false);
    }
  }, [traktSlug, accessToken, didIBlockThem, isMutating, refresh]);

  return { isLoading, isBlockedEitherWay, didIBlockThem, isMutating, toggleBlock };
}

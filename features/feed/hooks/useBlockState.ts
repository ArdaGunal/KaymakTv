import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  getMySupabaseUserId,
  amIBlocking,
  getBlockedUserIds,
  blockUser as blockUserApi,
  unblockUser as unblockUserApi,
} from '../services/userBlocks';
import { invalidateFeedCache, invalidateVisibleUserIds } from '../services/feedApi';

export interface UseBlockStateResult {
  isLoading: boolean;
  /** Ben mi onu engelledim, yoksa o mu beni — akış/profil görünürlüğü HER
   *  İKİ durumda da kilitlenir (bkz. docs/design/FEED_SOCIAL_PLAN.md §4.3). */
  isBlockedEitherWay: boolean;
  /** Menüde "Engelle" mi "Engeli Kaldır" mı gösterileceğine karar verir —
   *  yalnızca BENİM attığım engeli kaldırabilirim, karşı tarafınkini değil. */
  didIBlockThem: boolean;
  isMutating: boolean;
  toggleBlock: () => Promise<void>;
}

/**
 * Bir kullanıcı için engel durumu — profil sayfasındaki düğme VE kilit ekranı
 * bunu paylaşır.
 *
 * 🪪 HEDEF ARTIK `users.id` (M339 · `BACKLOG` §F6). Eskiden Trakt slug'ı alıp
 * `getUserIdBySlug` ile çeviriyordu: Google-only kullanıcının slug'ı YOK → ne
 * engelleyebiliyor ne engellenebiliyordu. T3 çıkış ölçütünün üçüncüsü
 * ("engellenen takip edemiyor") bu yüzden Google-only hesaplar arasında
 * SINANAMIYORDU. Profil ekranı kimliği zaten `/social/profile`'dan alıyor —
 * çeviri adımına (ve onun Supabase sorgusuna) gerek kalmadı.
 */
export function useBlockState(targetUserId: string | null): UseBlockStateResult {
  const { accessToken, isGuest } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [didIBlockThem, setDidIBlockThem] = useState(false);
  const [isBlockedEitherWay, setIsBlockedEitherWay] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const refresh = useCallback(async () => {
    if (!targetUserId || !accessToken || isGuest) {
      setDidIBlockThem(false);
      setIsBlockedEitherWay(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const myId = await getMySupabaseUserId();
      if (!myId || myId === targetUserId) {
        setDidIBlockThem(false);
        setIsBlockedEitherWay(false);
        return;
      }
      const [blockedSet, iBlockThem] = await Promise.all([getBlockedUserIds(), amIBlocking(myId, targetUserId)]);
      setDidIBlockThem(iBlockThem);
      setIsBlockedEitherWay(blockedSet.has(targetUserId));
    } catch (error) {
      console.warn('[Feed] Engel durumu okunamadı:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, accessToken, isGuest]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleBlock = useCallback(async () => {
    if (!targetUserId || !accessToken || isMutating) return;
    setIsMutating(true);
    try {
      if (didIBlockThem) {
        await unblockUserApi(accessToken, { userId: targetUserId });
      } else {
        await blockUserApi(accessToken, { userId: targetUserId });
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
  }, [targetUserId, accessToken, didIBlockThem, isMutating, refresh]);

  return { isLoading, isBlockedEitherWay, didIBlockThem, isMutating, toggleBlock };
}

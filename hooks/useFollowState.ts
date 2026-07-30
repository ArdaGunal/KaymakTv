import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { followTraktUser, unfollowTraktUser } from '../services/api/social';
import { useFollowStore } from '../store/followStore';

export type ConnectionState = 'none' | 'following' | 'pending';

/**
 * useFollowState — Trakt'ın kendi takip (follow) API'sini saran paylaşımlı hook.
 *
 * Bu versiyonda Zustand tabanlı `followStore` kullanılarak Optimistic UI
 * ve uygulama genelinde "Takip Ediliyor" durumunun senkron kalması (Stale Cache engeli)
 * hedeflenmiştir. Arayüzün yalan söylememesi için mutasyonlarda Rollback yapısı mevcuttur.
 */
export function useFollowState(
  slug: string | null,
  skipFetch: boolean = false,
  initialConnectionState: ConnectionState = 'none'
) {
  const { accessToken, isGuest } = useAuth();
  const { t } = useTranslation('common');
  
  const { connectionStates, isFetched, fetchFollowingSlugs, setOptimisticState } = useFollowStore();

  let connectionState: ConnectionState = initialConnectionState;
  if (slug) {
     const storeState = connectionStates[slug];
     if (storeState !== undefined) {
         connectionState = storeState;
     } else if (isFetched) {
         // Liste API'den tamamen çekildiyse ve bu slug listede YOKSA, demek ki takip edilmiyor
         connectionState = 'none';
     }
  }

  const [isLoadingConnection, setIsLoadingConnection] = useState(!skipFetch);
  const [isFollowPending, setIsFollowPending] = useState(false);

  useEffect(() => {
    if (skipFetch) return;
    
    if (!slug || !accessToken || isGuest) {
      setIsLoadingConnection(false);
      return;
    }

    if (!isFetched) {
      setIsLoadingConnection(true);
      fetchFollowingSlugs().finally(() => {
         setIsLoadingConnection(false);
      });
    } else {
      setIsLoadingConnection(false);
    }
  }, [slug, accessToken, isGuest, skipFetch, isFetched, fetchFollowingSlugs]);

  const execUnfollow = async (targetSlug: string, previousState: ConnectionState) => {
    setIsFollowPending(true);
    // Optimistic Update (UI'ı anında none yap)
    setOptimisticState(targetSlug, 'none');
    
    try {
      await unfollowTraktUser(targetSlug);
    } catch (err) {
      console.warn('[useFollowState] Unfollow failed:', err);
      // Hata durumunda eski state'e geri çevir (Rollback)
      setOptimisticState(targetSlug, previousState);
    } finally {
      setIsFollowPending(false);
    }
  };

  const toggleFollow = useCallback(async () => {
    if (!slug || isFollowPending) return;

    if (!accessToken || isGuest) {
      Alert.alert(t('error', 'Hata'), t('guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }

    if (connectionState !== 'none') {
      // Takipten Çıkma Onayı (Confirmation Dialog)
      const previousState = connectionState;

      if (Platform.OS === 'web') {
        const confirmed = window.confirm(t('unfollowMessage', 'Takipten çıkmak istediğinize emin misiniz?'));
        if (confirmed) {
          await execUnfollow(slug, previousState);
        }
      } else {
        Alert.alert(
          t('unfollowTitle', 'Takipten Çık'),
          t('unfollowMessage', 'Takipten çıkmak istediğinize emin misiniz?'),
          [
            { text: t('cancel', 'İptal'), style: 'cancel' },
            { 
              text: t('unfollowConfirm', 'Çık'), 
              style: 'destructive', 
              onPress: () => execUnfollow(slug, previousState) 
            }
          ]
        );
      }
      return;
    }

    // Takip Etme İşlemi (Optimistic Update)
    const previousState = connectionState;
    setIsFollowPending(true);
    setOptimisticState(slug, 'following');

    try {
      const result = await followTraktUser(slug);
      const actualState = result.approvedAt ? 'following' : 'pending';
      setOptimisticState(slug, actualState);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setOptimisticState(slug, 'pending');
      } else {
        console.warn('[useFollowState] Follow failed:', err);
        // Hata durumunda geri al (Rollback)
        setOptimisticState(slug, previousState);
      }
    } finally {
      setIsFollowPending(false);
    }
  }, [slug, connectionState, isFollowPending, accessToken, isGuest, t, setOptimisticState]);

  return { connectionState, isLoadingConnection, isFollowPending, toggleFollow };
}

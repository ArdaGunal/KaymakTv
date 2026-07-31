import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { followTraktUser, unfollowTraktUser } from '../services/api/social';
import { useFollowStore } from '../store/followStore';
import { useNotificationStore } from '../store/notificationStore';
import { recordMutationResult } from '../utils/metrics';
import { confirmAsync, notify } from '../utils/confirmDialog';

export type ConnectionState = 'none' | 'following' | 'pending';

// Follow/unfollow başarısız olduğunda kullanıcıya görünür bir uyarı gösterir
// (bkz. "takip isteği gitmiyor" bug raporu — öncesinde hata yalnızca
// console.warn ile sessizce yutuluyordu). `notify()` (utils/confirmDialog.ts)
// projedeki TEK web/native Alert kaynağı — burada kendi kopyasını yazmak
// yerine o kullanılıyor (bkz. useProfilePrivacy.ts'te de aynı desen).
const showFollowErrorAlert = (t: (key: string, fallback: string) => string) => {
  notify(
    t('error', 'Hata'),
    t('actionFailedMessage', 'İşlem gerçekleştirilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.')
  );
};

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
  
  // Seçici (selector) ile abone olunuyor: `useFollowStore()` (parametresiz)
  // TÜM store'a abone olurdu — bir kullanıcının takip durumu değiştiğinde
  // ekrandaki (arama sonucu, takipçi/takip edilen listesi vb.) HER
  // useFollowState örneği gereksiz yere yeniden render olurdu. Yalnızca BU
  // slug'ın değerine abone olunca her kart yalnızca kendi durumu
  // değiştiğinde render olur — takipçi sayısı yüksek listelerde performans
  // farkı büyük.
  const storeConnectionState = useFollowStore(
    useCallback((s) => (slug ? s.connectionStates[slug] : undefined), [slug])
  );
  const isFetched = useFollowStore((s) => s.isFetched);
  const fetchFollowingSlugs = useFollowStore((s) => s.fetchFollowingSlugs);
  const setOptimisticState = useFollowStore((s) => s.setOptimisticState);

  let connectionState: ConnectionState = initialConnectionState;
  if (slug) {
     if (storeConnectionState !== undefined) {
         connectionState = storeConnectionState;
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
      recordMutationResult('unfollowUser', true);
    } catch (err) {
      console.warn('[useFollowState] Unfollow failed:', err);
      recordMutationResult('unfollowUser', false);
      // Hata durumunda eski state'e geri çevir (Rollback)
      setOptimisticState(targetSlug, previousState);
      // Önceden yalnızca console.warn ile sessizce yutuluyordu — kullanıcı
      // butona basıp hiçbir tepki görmüyordu. Artık en azından bir işlemin
      // başarısız olduğu görünür (bkz. "takip isteği gitmiyor" bug raporu).
      showFollowErrorAlert(t);
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
      // Takipten Çıkma Onayı — `utils/confirmDialog.ts`'teki merkezi
      // `confirmAsync` (web'de `window.confirm`, native'de iki butonlu
      // `Alert.alert`e düşer) — burada elle Platform.OS dallanması
      // YAZILMIYOR, o dosyanın kendi amacı zaten bunu önlemekti.
      const previousState = connectionState;
      const confirmed = await confirmAsync(
        t('unfollowTitle', 'Takipten Çık'),
        t('unfollowMessage', 'Takipten çıkmak istediğinize emin misiniz?'),
        t('unfollowConfirm', 'Çık'),
        t('cancel', 'İptal')
      );
      if (confirmed) {
        await execUnfollow(slug, previousState);
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
      // Onay bekleyen bir istek gönderdiysek hatırla — daha sonra karşı taraf
      // onaylayınca `notificationStore.refreshActivity()` bunu tespit edip
      // "takip isteğiniz onaylandı" bildirimi üretebilsin diye (bkz. store/notificationStore.ts).
      if (!result.approvedAt) useNotificationStore.getState().addPendingSentSlug(slug);
      recordMutationResult('followUser', true);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setOptimisticState(slug, 'pending');
        useNotificationStore.getState().addPendingSentSlug(slug);
        recordMutationResult('followUser', true);
      } else {
        console.warn('[useFollowState] Follow failed:', err);
        recordMutationResult('followUser', false);
        // Hata durumunda geri al (Rollback)
        setOptimisticState(slug, previousState);
        // Önceden yalnızca console.warn ile sessizce yutuluyordu — kullanıcı
        // butona basıp "takip ediliyor" görüp sonra hiçbir açıklama olmadan
        // eski haline döndüğünü görüyordu (bkz. "takip isteği gitmiyor" bug
        // raporu). Artık en azından bir hata olduğu görünür.
        showFollowErrorAlert(t);
      }
    } finally {
      setIsFollowPending(false);
    }
  }, [slug, connectionState, isFollowPending, accessToken, isGuest, t, setOptimisticState]);

  return { connectionState, isLoadingConnection, isFollowPending, toggleFollow };
}

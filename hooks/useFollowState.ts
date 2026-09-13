import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { followKaymakUser, unfollowKaymakUser } from '../services/api/kaymakSocial';
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
 * useFollowState — **BİZİM** takip grafımızı saran paylaşımlı hook.
 *
 * ==========================================================================
 * 🪪 ARTIK TRAKT'A GİTMİYOR (Faz T · T3.3, M337)
 * ==========================================================================
 * ⛔ ESKİ HÂLİ `followTraktUser`/`unfollowTraktUser` çağırıyordu ve YALNIZCA
 * `isGuest`'e bakıyordu, `authProvider`'a BAKMIYORDU. Sonucu: Google-only
 * kullanıcı "Takip Et"e basınca Kaymak oturum token'ı Trakt'a gidiyor ve
 * **401** dönüyordu (`FAZ_T3_TASLAK` §1.1 — M324'teki puanlama hatasının
 * AYNI SINIFI). Bu hook artık `/social/follow` · `/social/unfollow`
 * kullanıyor; sağlayıcıya göre dallanma YOK çünkü grafın tek otoritesi biz
 * olduk (karar §5.1).
 *
 * 🔑 PARAMETRE ARTIK `userId` (UUID), slug DEĞİL. Slug sosyal kimlik değil
 * ("EVRENSEL KAYMAK KİMLİĞİ") ve Google-only kullanıcıda HİÇ YOK.
 *
 * Zustand tabanlı `followStore` ile Optimistic UI ve uygulama genelinde
 * "Takip Ediliyor" durumunun senkron kalması (Stale Cache engeli)
 * hedefleniyor. Arayüzün yalan söylememesi için mutasyonlarda Rollback var.
 */
export function useFollowState(
  targetUserId: string | null,
  targetUsername: string | null = null,
  skipFetch: boolean = false,
  initialConnectionState: ConnectionState = 'none'
) {
  const { accessToken, isGuest } = useAuth();
  const { t } = useTranslation('common');
  
  // Seçici (selector) ile abone olunuyor: `useFollowStore()` (parametresiz)
  // TÜM store'a abone olurdu — bir kullanıcının takip durumu değiştiğinde
  // ekrandaki (arama sonucu, takipçi/takip edilen listesi vb.) HER
  // useFollowState örneği gereksiz yere yeniden render olurdu. Yalnızca BU
  // kimliğin değerine abone olunca her kart yalnızca kendi durumu
  // değiştiğinde render olur — takipçi sayısı yüksek listelerde performans
  // farkı büyük.
  const storeConnectionState = useFollowStore(
    useCallback((s) => (targetUserId ? s.connectionStates[targetUserId] : undefined), [targetUserId])
  );
  const isFetched = useFollowStore((s) => s.isFetched);
  const fetchFollowGraph = useFollowStore((s) => s.fetchFollowGraph);
  const setOptimisticState = useFollowStore((s) => s.setOptimisticState);

  let connectionState: ConnectionState = initialConnectionState;
  if (targetUserId) {
     if (storeConnectionState !== undefined) {
         connectionState = storeConnectionState;
     } else if (isFetched) {
         // Graf tamamen çekildiyse ve bu kimlik listede YOKSA, takip edilmiyor
         connectionState = 'none';
     }
  }

  const [isLoadingConnection, setIsLoadingConnection] = useState(!skipFetch);
  const [isFollowPending, setIsFollowPending] = useState(false);

  useEffect(() => {
    if (skipFetch) return;
    
    if (!targetUserId || !accessToken || isGuest) {
      setIsLoadingConnection(false);
      return;
    }

    if (!isFetched) {
      setIsLoadingConnection(true);
      fetchFollowGraph().finally(() => {
         setIsLoadingConnection(false);
      });
    } else {
      setIsLoadingConnection(false);
    }
  }, [targetUserId, accessToken, isGuest, skipFetch, isFetched, fetchFollowGraph]);

  const execUnfollow = async (userId: string, previousState: ConnectionState) => {
    setIsFollowPending(true);
    // Optimistic Update (UI'ı anında none yap)
    setOptimisticState(userId, 'none');

    try {
      // 🔑 TEK UÇ İKİ İŞİ YAPIYOR: takibi bırakır VE gönderilmiş bekleyen
      // isteği geri çeker. Bu yüzden burada "hangi durumdayım" dallanması
      // YOK — bayat bir ekranın yanlış ucu çağırması imkânsız.
      await unfollowKaymakUser(userId);
      recordMutationResult('unfollowUser', true);
    } catch (err) {
      console.warn('[useFollowState] Unfollow failed:', err);
      recordMutationResult('unfollowUser', false);
      // Hata durumunda eski state'e geri çevir (Rollback)
      setOptimisticState(userId, previousState);
      // Önceden yalnızca console.warn ile sessizce yutuluyordu — kullanıcı
      // butona basıp hiçbir tepki görmüyordu. Artık en azından bir işlemin
      // başarısız olduğu görünür (bkz. "takip isteği gitmiyor" bug raporu).
      showFollowErrorAlert(t);
    } finally {
      setIsFollowPending(false);
    }
  };

  const toggleFollow = useCallback(async () => {
    if (!targetUserId || isFollowPending) return;

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
        await execUnfollow(targetUserId, previousState);
      }
      return;
    }

    // Takip Etme İşlemi (Optimistic Update)
    const previousState = connectionState;
    setIsFollowPending(true);
    setOptimisticState(targetUserId, 'following');

    try {
      // 🔑 Sunucu hedefin gizliliğine göre `takip` ya da `istek` döndürüyor —
      // istemci bunu TAHMİN ETMİYOR. Gizli hesaba istek atan kullanıcıya
      // "takip ediyorsun" göstermek, arayüzün yalan söylemesi olurdu.
      const durum = await followKaymakUser(targetUserId);
      setOptimisticState(targetUserId, durum === 'istek' ? 'pending' : 'following');
      // Onay bekleyen bir istek gönderdiysek hatırla — daha sonra karşı taraf
      // onaylayınca `notificationStore.refreshActivity()` bunu tespit edip
      // "takip isteğiniz onaylandı" bildirimi üretebilsin diye (bkz. store/notificationStore.ts).
      // ⚠️ `targetUsername` de saklanıyor: onay anında profili AĞDAN çekme
      // adımını kaldırıyor (o adım Trakt'a gidiyordu ve Google-only
      // kullanıcıda çalışmazdı).
      if (durum === 'istek' && targetUsername) {
        useNotificationStore.getState().addPendingSentRequest(targetUserId, targetUsername);
      }
      recordMutationResult('followUser', true);
    } catch (err: any) {
      // ⛔ 409 ÖZEL DALI KALDIRILDI: Trakt "zaten istek gönderilmiş" için 409
      // dönüyordu. Bizim `/social/follow` ucu `ignore-duplicates` ile
      // idempotent — çift istek HATA değil, sessiz no-op + `success`.
      console.warn('[useFollowState] Follow failed:', err);
      recordMutationResult('followUser', false);
      // Hata durumunda geri al (Rollback)
      setOptimisticState(targetUserId, previousState);
      // Önceden yalnızca console.warn ile sessizce yutuluyordu — kullanıcı
      // butona basıp "takip ediliyor" görüp sonra hiçbir açıklama olmadan
      // eski haline döndüğünü görüyordu (bkz. "takip isteği gitmiyor" bug
      // raporu). Artık en azından bir hata olduğu görünür.
      showFollowErrorAlert(t);
    } finally {
      setIsFollowPending(false);
    }
  }, [targetUserId, targetUsername, connectionState, isFollowPending, accessToken, isGuest, t, setOptimisticState]);

  return { connectionState, isLoadingConnection, isFollowPending, toggleFollow };
}

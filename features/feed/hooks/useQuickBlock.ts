import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { confirmAsync } from '../utils/confirmDialog';
import { blockUser } from '../services/userBlocks';
import { invalidateFeedCache, invalidateVisibleUserIds } from '../services/feedApi';

/**
 * Kart/yorum menülerinden TEK YÖNLÜ engelleme — `useBlockState` (profil
 * sayfası) BİLİNÇLİ OLARAK kullanılmıyor: o hook her mount'ta "ben onu
 * engellemiş miyim" diye ayrı bir ağ isteği atıyor, bunu akıştaki HER karta
 * eklemek (potansiyel olarak onlarca kart) gereksiz bir istek patlaması
 * yaratırdı. Buna gerek yok çünkü feed'in kendisi zaten engellenen
 * kullanıcıların içeriğini görünürlükten filtreliyor (bkz. feedApi.ts) —
 * yani bir kart/yorum EKRANDA görünüyorsa o kullanıcı zaten engellenmiş
 * olamaz, menüde her zaman yalnızca "Engelle" gösterilir, "Engeli Kaldır"
 * hiç gerekmez.
 */
export function useQuickBlock() {
  const { t } = useTranslation(['feed', 'common']);
  const { accessToken, isGuest } = useAuth();
  const [isBlocking, setIsBlocking] = useState(false);

  const blockUserQuick = useCallback(
    async (traktSlug: string) => {
      if (!accessToken || isGuest || isBlocking) return;
      const confirmed = await confirmAsync(
        t('blockConfirmTitle', 'Kullanıcıyı Engelle?'),
        t(
          'blockConfirmMessage',
          'Bu kullanıcının aktivitelerini ve yorumlarını bir daha görmeyeceksin. Bu işlem Trakt hesabındaki takip durumunu ETKİLEMEZ.'
        ),
        t('block', 'Engelle'),
        t('cancel', 'Vazgeç')
      );
      if (!confirmed) return;
      setIsBlocking(true);
      try {
        await blockUser(accessToken, traktSlug);
        invalidateVisibleUserIds();
        invalidateFeedCache();
      } catch (error) {
        console.warn('[Feed] Hızlı engelleme başarısız:', error);
        Alert.alert(t('common:error'), t('common:actionFailedMessage'));
      } finally {
        setIsBlocking(false);
      }
    },
    [accessToken, isGuest, isBlocking, t]
  );

  return { blockUserQuick, isBlocking };
}

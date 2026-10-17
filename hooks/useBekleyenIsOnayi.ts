import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmAsync } from '../utils/confirmDialog';
import { bekleyenIsSayisi } from '../services/auth/cikisTemizligi';

/**
 * M525 (d) — hesap değişecekse (Trakt bağlama → oturum yeni Trakt'a geçer, Hesap Seç → bir hesap
 * silinir/oturum geçer) ve cihazda gönderilmemiş işaretleme varsa ÖNCE sor. D11 ile aynı karar:
 * *«kullanıcının çevrimdışı emeklerini sessizce silmek… sinirlendirir»*. Dönüş: devam edilsin mi.
 */
export function useBekleyenIsOnayi() {
  const { t } = useTranslation(['settings', 'common']);
  return useCallback(async (): Promise<boolean> => {
    const n = await bekleyenIsSayisi();
    if (n === 0) return true;
    return confirmAsync(
      t('settings:cikisBekleyenBaslik'),
      t('settings:hesapDegisimBekleyenMetin', { n }),
      t('settings:yineDeDevam'),
      t('common:cancel')
    );
  }, [t]);
}

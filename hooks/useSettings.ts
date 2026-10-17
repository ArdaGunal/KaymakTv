import { useCallback, useState } from 'react';
import { confirmAsync, notify } from '../utils/confirmDialog';
import { bekleyenIsSayisi } from '../services/auth/cikisTemizligi';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { deleteAccountData } from '../features/feed/services/accountDeletion';
import { kurulumKimliginiYenile } from '../services/api/telemetry';

export interface UseSettingsResult {
  isLoggingOut: boolean;
  isDeletingAccount: boolean;
  handleLogout: () => Promise<void>;
  handleDeleteAccount: () => Promise<void>;
  handleChangeLanguage: (lng: string) => void;
  currentLanguage: string;
}

export function useSettings(): UseSettingsResult {
  const { removeKeys, accessToken, isGuest } = useAuth();
  const { i18n, t } = useTranslation(['settings', 'common']);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleLogout = useCallback(async () => {
    // D8 / Faz 4d (M517): çıkış çevrimdışı kuyruğu da siler — gönderilmemiş iş varsa
    // önce açıkça uyar (kullanıcı: «çevrimdışı emeklerini sessizce silmek… sinirlendirir»).
    const bekleyen = await bekleyenIsSayisi();
    if (bekleyen > 0) {
      const devam = await confirmAsync(
        t('cikisBekleyenBaslik'),
        t('cikisBekleyenMetin', { n: bekleyen }),
        t('cikisYineDeCik'),
        t('common:cancel')
      );
      if (!devam) return;
    }
    setIsLoggingOut(true);
    try {
      await removeKeys();
      // removeKeys zaten state'i sıfırlıyor; router auth guard zaten login'e yönlendirecek
    } catch (error) {
      console.error('[useSettings] logout error:', error);
      notify(t('common:error'), t('logoutError', 'Çıkış yapılırken hata oluştu.'));
    } finally {
      setIsLoggingOut(false);
    }
  }, [removeKeys, t]);

  const handleDeleteAccount = useCallback(async () => {
    // Trakt hesabına HİÇ dokunulmaz (Trakt zaten silinemez, kendi API'si de
    // yok) — yalnızca KaymakTV'nin sunucusundaki (Supabase: users satırı,
    // CASCADE ile feed_activities + comments) ve cihazdaki veriler silinir.
    // Sunucu silme isteği BAŞARISIZ olursa yerel oturumu da temizlemiyoruz —
    // aksi halde kullanıcı verisi hâlâ sunucuda dururken "silindi" sanıp
    // tekrar denemezdi.
    setIsDeletingAccount(true);
    try {
      if (accessToken && !isGuest) {
        await deleteAccountData(accessToken);
      }
      await removeKeys();
      // DISCORD-01 (M529): hesap silmede kurulum kimliği de gider (çıkışta kalır; sayaçlar kalır).
      await kurulumKimliginiYenile();
    } catch (error) {
      console.error('[useSettings] deleteAccount error:', error);
      notify(t('common:error'), t('deleteAccountError', 'Veriler silinirken hata oluştu.'));
    } finally {
      setIsDeletingAccount(false);
    }
  }, [removeKeys, accessToken, isGuest, t]);

  const handleChangeLanguage = useCallback((lng: string) => {
    i18n.changeLanguage(lng);
  }, [i18n]);

  return {
    isLoggingOut,
    isDeletingAccount,
    handleLogout,
    handleDeleteAccount,
    handleChangeLanguage,
    currentLanguage: i18n.language,
  };
}

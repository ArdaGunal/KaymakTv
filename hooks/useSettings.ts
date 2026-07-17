import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export interface UseSettingsResult {
  isLoggingOut: boolean;
  isDeletingAccount: boolean;
  handleLogout: () => Promise<void>;
  handleDeleteAccount: () => Promise<void>;
  handleChangeLanguage: (lng: string) => void;
  currentLanguage: string;
}

export function useSettings(): UseSettingsResult {
  const { removeKeys } = useAuth();
  const router = useRouter();
  const { i18n, t } = useTranslation(['settings', 'common']);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await removeKeys();
      // removeKeys zaten state'i sıfırlıyor; router auth guard zaten login'e yönlendirecek
    } catch (error) {
      console.error('[useSettings] logout error:', error);
      Alert.alert(t('common:error'), t('logoutError', 'Çıkış yapılırken hata oluştu.'));
    } finally {
      setIsLoggingOut(false);
    }
  }, [removeKeys, t]);

  const handleDeleteAccount = useCallback(async () => {
    // "Hesap silme" mevcut sistemde yalnızca local verileri temizler.
    // Trakt hesabı etkilenmez.
    setIsDeletingAccount(true);
    try {
      await removeKeys();
    } catch (error) {
      console.error('[useSettings] deleteAccount error:', error);
      Alert.alert(t('common:error'), t('deleteAccountError', 'Veriler silinirken hata oluştu.'));
    } finally {
      setIsDeletingAccount(false);
    }
  }, [removeKeys, t]);

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

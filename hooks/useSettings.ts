import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { exportMetricsReport } from '../utils/metrics';

export interface UseSettingsResult {
  isLoggingOut: boolean;
  isDeletingAccount: boolean;
  isExportingMetrics: boolean;
  handleLogout: () => Promise<void>;
  handleDeleteAccount: () => Promise<void>;
  handleChangeLanguage: (lng: string) => void;
  handleExportMetrics: () => Promise<void>;
  currentLanguage: string;
}

export function useSettings(): UseSettingsResult {
  const { removeKeys } = useAuth();
  const router = useRouter();
  const { i18n, t } = useTranslation(['settings', 'common']);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isExportingMetrics, setIsExportingMetrics] = useState(false);

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

  // Faz 7 — son 24 saatlik telemetri (mutation başarı/hata sayaçları, API
  // gecikme histogramları) panoya kopyalanır. DevTools'un gerçek cihazlarda
  // erişilemez olmasının yerini tutan minimal bir "kara kutu" dışa aktarımı;
  // tam bir grafikli dashboard (planın "opsiyonel, düşük öncelik" dediği kısmı)
  // bilinçli olarak kapsam dışı bırakıldı — bkz. docs/HISTORY.md.
  const handleExportMetrics = useCallback(async () => {
    setIsExportingMetrics(true);
    try {
      const report = await exportMetricsReport();
      await Clipboard.setStringAsync(report);
      Alert.alert(t('common:success'), t('settings:exportPerformanceReportSuccess'));
    } catch (error) {
      console.error('[useSettings] exportMetrics error:', error);
      Alert.alert(t('common:error'), t('settings:exportPerformanceReportError'));
    } finally {
      setIsExportingMetrics(false);
    }
  }, [t]);

  return {
    isLoggingOut,
    isDeletingAccount,
    isExportingMetrics,
    handleLogout,
    handleDeleteAccount,
    handleChangeLanguage,
    handleExportMetrics,
    currentLanguage: i18n.language,
  };
}

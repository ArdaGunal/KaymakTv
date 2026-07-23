import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Activity, FileWarning, Globe, LogOut, Trash2 } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DeleteAccountModal from '../../components/settings/DeleteAccountModal';
import SettingsRow from '../../components/settings/SettingsRow';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { SettingsSection, SettingsSectionDivider } from '../../components/settings/SettingsSection';
import { TraktAccountSection } from '../../components/settings/TraktAccountSection';
import Snackbar from '../../components/Snackbar';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { exchangeAuthCode } from '../../services/traktApi';

// Sürüm numarasına bu kadar kez, aşağıdaki pencere içinde ard arda dokununca
// gizli "Geliştirici Modu" açılır/kapanır (Android'in "Yapı Numarası"na
// dokunma esprisiyle aynı mantık). Aynı jest tekrar uygulanınca modu
// KAPATIR — açma/kapama tek bir dokunma dizisiyle simetrik.
const DEV_MODE_REQUIRED_TAPS = 7;
const DEV_MODE_TAP_WINDOW_MS = 1500;

// Auth session web browser desteğini başlat
WebBrowser.maybeCompleteAuthSession();

const DESKTOP_BREAKPOINT = 768;

export default function SettingsScreen() {
  const { accessToken, saveTokens, isGuest } = useAuth();
  const { handleLogout, handleDeleteAccount, handleChangeLanguage, currentLanguage,
    isLoggingOut, isDeletingAccount, handleExportMetrics, isExportingMetrics } = useSettings();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const [isConnecting, setIsConnecting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  // ── Gizli Geliştirici Modu (sürüm numarasına 7 hızlı dokunma) ────────────
  // Kalıcı DEĞİL (AsyncStorage'a yazılmıyor): uygulama yeniden açıldığında
  // sıfırlanır — bu, "gizli" bir tanılama anahtarı için bilinçli bir tercih;
  // gerçek kullanıcının yanlışlıkla bunu açık bırakması söz konusu olmasın.
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [devModeToast, setDevModeToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const tapCountRef = useRef(0);
  const lastTapAtRef = useRef(0);

  const handleVersionTap = () => {
    const now = Date.now();
    // Pencere dışına taşan bir dokunuş, sayaç dizisini SIFIRLAR — kullanıcı
    // 3 kere dokunup ara verip 4 dokunma daha yaparsa bu 7 SAYILMAZ, "hızlı
    // ard arda" şartını gerçekten karşılamış olması gerekir.
    if (now - lastTapAtRef.current > DEV_MODE_TAP_WINDOW_MS) {
      tapCountRef.current = 0;
    }
    tapCountRef.current += 1;
    lastTapAtRef.current = now;
    if (tapCountRef.current >= DEV_MODE_REQUIRED_TAPS) {
      tapCountRef.current = 0;
      const next = !isDeveloperMode;
      setIsDeveloperMode(next);
      setDevModeToast({
        visible: true,
        message: next
          ? t('settings:developerModeUnlocked', '🔓 Geliştirici Konsolu Kilidi Açıldı')
          : t('settings:developerModeLocked', '🔒 Geliştirici Konsolu Gizlendi'),
      });
    }
  };

  const appVersion = Constants.expoConfig?.version ?? '1.1.1';

  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(protected)/(tabs)/explore');
  };

  // ── Trakt OAuth ─────────────────────────────────────────────────────────
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'kaymak', path: 'settings' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID || '',
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: false,
    },
    { authorizationEndpoint: 'https://trakt.tv/oauth/authorize' }
  );

  useEffect(() => {
    if (response?.type === 'success') {
      handleTokenExchange(response.params.code);
    } else if (response?.type === 'error') {
      Alert.alert(t('common:error'), t('loginCanceled'));
    }
  }, [response]);

  // Web redirect code capture
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        handleTokenExchange(code);
      }
    }
  }, []);

  const handleTraktLogin = () => {
    if (Platform.OS === 'web' && request?.url) {
      window.location.href = request.url;
    } else {
      promptAsync();
    }
  };

  const handleTokenExchange = async (code: string) => {
    setIsConnecting(true);
    try {
      const tokenData = await exchangeAuthCode(code, redirectUri);
      if (tokenData?.access_token) {
        await saveTokens(tokenData.access_token, tokenData.refresh_token);
        Alert.alert(t('common:success'), t('loginSuccessText'));
      }
    } catch {
      Alert.alert(t('common:error'), t('communicationError'));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    await handleDeleteAccount();
    setDeleteModalVisible(false);
  };

  const languageLabel = currentLanguage === 'tr' ? '🇹🇷 Türkçe' : '🇬🇧 English';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsHeader title={t('settings', 'Ayarlar')} isDesktop={isDesktop} onBack={navigateBack} />

        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          <TraktAccountSection
            isConnected={!!accessToken}
            isConnecting={isConnecting}
            canConnect={!!request}
            onConnect={handleTraktLogin}
            onGoToApp={navigateBack}
          />

          <SettingsSection title={t('appPreferences', 'Uygulama Tercihleri')}>
            <SettingsRow
              icon={<Globe size={20} color="#a78bfa" />}
              label={t('language', 'Dil')}
              tintColor="#a78bfa"
              value={languageLabel}
              showChevron
              onPress={() => {
                const next = currentLanguage === 'tr' ? 'en' : 'tr';
                handleChangeLanguage(next);
              }}
            />
          </SettingsSection>

          {/* Yalnızca gizli Geliştirici Modu açıkken görünür — bkz. sürüm
              numarasına 7 hızlı dokunma. Normal kullanıcı bu bölümü hiç görmez. */}
          {isDeveloperMode && (
            <SettingsSection title={t('settings:diagnostics')}>
              <SettingsRow
                icon={<Activity size={20} color="#38bdf8" />}
                label={t('settings:exportPerformanceReport')}
                tintColor="#38bdf8"
                onPress={handleExportMetrics}
                disabled={isExportingMetrics}
              />

              <SettingsSectionDivider />

              <SettingsRow
                icon={<FileWarning size={20} color="#f87171" />}
                label={t('settings:errorLogTitle')}
                tintColor="#f87171"
                showChevron
                onPress={() => router.push('/(protected)/error-log')}
              />
            </SettingsSection>
          )}

          <SettingsSection title="⚠️ Hesap Seçenekleri">
            <SettingsRow
              icon={<LogOut size={20} color="#fb923c" />}
              label={isGuest ? t('settings:exitGuestMode', 'Misafir Modundan Çık') : t('logoutReset', 'Çıkış Yap')}
              tintColor="#fb923c"
              onPress={handleLogout}
              disabled={isLoggingOut}
            />

            {/* Misafirin silinecek bir Trakt hesabı yok — bu satır (ve onay
                modalındaki "Trakt hesabınız etkilenmez" metni) misafir için
                anlamsız/yanıltıcı olurdu, bu yüzden yalnızca gerçek kullanıcıya
                gösterilir. Çıkış satırı zaten aynı yerel-veri temizliğini yapıyor. */}
            {!isGuest && (
              <>
                <SettingsSectionDivider />

                <SettingsRow
                  icon={<Trash2 size={20} color="#f87171" />}
                  label={t('settings:deleteAccount')}
                  tintColor="#f87171"
                  onPress={() => setDeleteModalVisible(true)}
                  disabled={isDeletingAccount}
                />
              </>
            )}
          </SettingsSection>

          {/* Görünüşte sıradan bir sürüm etiketi — 7 hızlı dokunuşluk gizli
              kapı. `activeOpacity={1}` bilinçli: normal bir metinmiş gibi
              durması gerekiyor, buton gibi "bastırılmış" görünmemeli. */}
          <TouchableOpacity
            onPress={handleVersionTap}
            activeOpacity={1}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
            style={styles.versionRow}
          >
            <Text style={styles.versionText}>
              {t('settings:appVersion', 'Sürüm {{version}}', { version: appVersion })}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <DeleteAccountModal
        visible={deleteModalVisible}
        loading={isDeletingAccount}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalVisible(false)}
      />

      <Snackbar
        visible={devModeToast.visible}
        message={devModeToast.message}
        onDismiss={() => setDevModeToast((prev) => ({ ...prev, visible: false }))}
        duration={2500}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 60,
  },
  scrollContentDesktop: {
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 24,
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  versionRow: {
    alignItems: 'center',
    marginTop: -8,
  },
  versionText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '500',
  },
});

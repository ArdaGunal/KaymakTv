import * as AuthSession from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Globe, LogOut, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DeleteAccountModal from '../../components/settings/DeleteAccountModal';
import SettingsRow from '../../components/settings/SettingsRow';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { SettingsSection, SettingsSectionDivider } from '../../components/settings/SettingsSection';
import { TraktAccountSection } from '../../components/settings/TraktAccountSection';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { exchangeAuthCode } from '../../services/traktApi';

// Auth session web browser desteğini başlat
WebBrowser.maybeCompleteAuthSession();

const DESKTOP_BREAKPOINT = 768;

export default function SettingsScreen() {
  const { accessToken, saveTokens } = useAuth();
  const { handleLogout, handleDeleteAccount, handleChangeLanguage, currentLanguage,
    isLoggingOut, isDeletingAccount } = useSettings();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const [isConnecting, setIsConnecting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

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

          <SettingsSection title="⚠️ Hesap Seçenekleri">
            <SettingsRow
              icon={<LogOut size={20} color="#fb923c" />}
              label={t('logoutReset', 'Çıkış Yap')}
              tintColor="#fb923c"
              onPress={handleLogout}
              disabled={isLoggingOut}
            />

            <SettingsSectionDivider />

            <SettingsRow
              icon={<Trash2 size={20} color="#f87171" />}
              label={t('settings:deleteAccount')}
              tintColor="#f87171"
              onPress={() => setDeleteModalVisible(true)}
              disabled={isDeletingAccount}
            />
          </SettingsSection>
        </View>
      </ScrollView>

      <DeleteAccountModal
        visible={deleteModalVisible}
        loading={isDeletingAccount}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalVisible(false)}
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
});

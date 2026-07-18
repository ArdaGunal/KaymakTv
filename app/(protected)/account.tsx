import * as AuthSession from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  CheckCircle2,
  Compass,
  Globe,
  LogOut,
  Trash2,
  UserCheck
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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

import LoadingIndicator from '../../components/LoadingIndicator';
import DeleteAccountModal from '../../components/settings/DeleteAccountModal';
import SettingsRow from '../../components/settings/SettingsRow';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { exchangeAuthCode } from '../../services/traktApi';

// Auth session web browser desteğini başlat
WebBrowser.maybeCompleteAuthSession();

const DESKTOP_BREAKPOINT = 768;

// ─── Section Wrapper ─────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SectionDivider() {
  return <View style={styles.rowDivider} />;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

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

  // ── Delete confirm ───────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    await handleDeleteAccount();
    setDeleteModalVisible(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────
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
        {/* Page Header */}
        <View style={[styles.pageHeader, isDesktop && styles.pageHeaderDesktop]}>
          <Text style={styles.pageTitle}>{t('settings', 'Ayarlar')}</Text>
        </View>

        <View style={[styles.content, isDesktop && styles.contentDesktop]}>

          {/* ── Hesap Ayarları ── */}
          <Section title={t('accountSettings', 'Hesap Ayarları')}>
            {accessToken ? (
              <>
                {/* Connected status */}
                <View style={styles.connectedBanner}>
                  <View style={styles.connectedDot} />
                  <Text style={styles.connectedText}>{t('settings:traktConnected')}</Text>
                  <CheckCircle2 size={18} color="#4ade80" />
                </View>

                <SectionDivider />

                <SettingsRow
                  icon={<Compass size={20} color="#60a5fa" />}
                  label={t('goToApp', 'Uygulamaya Git')}
                  tintColor="#60a5fa"
                  showChevron
                  onPress={() => {
                    if (router.canGoBack()) router.back();
                    else router.replace('/(protected)/(tabs)/explore');
                  }}
                />
              </>
            ) : (
              <>
                <View style={styles.notConnectedBanner}>
                  <Text style={styles.notConnectedTitle}>{t('settings:traktNotConnectedTitle')}</Text>
                  <Text style={styles.notConnectedSub}>{t('settings:traktNotConnectedSub')}</Text>
                </View>

                <SectionDivider />

                <TouchableOpacity
                  style={[styles.connectBtn, isConnecting && styles.btnDisabled]}
                  activeOpacity={0.82}
                  onPress={handleTraktLogin}
                  disabled={isConnecting || !request}
                >
                  {isConnecting ? (
                    <LoadingIndicator size="small" />
                  ) : (
                    <>
                      <UserCheck size={18} color="#fff" />
                      <Text style={styles.connectBtnText}>{t('settings:connectWithTrakt')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Section>

          {/* ── Uygulama Tercihleri ── */}
          <Section title={t('appPreferences', 'Uygulama Tercihleri')}>
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
          </Section>

          {/* ── Hesap seçenekleri ── */}
          <Section title="⚠️ Hesap Seçenekleri">
            <SettingsRow
              icon={<LogOut size={20} color="#fb923c" />}
              label={t('logoutReset', 'Çıkış Yap')}
              tintColor="#fb923c"
              onPress={handleLogout}
              disabled={isLoggingOut}
            />

            <SectionDivider />

            <SettingsRow
              icon={<Trash2 size={20} color="#f87171" />}
              label={t('settings:deleteAccount')}
              tintColor="#f87171"
              onPress={() => setDeleteModalVisible(true)}
              disabled={isDeletingAccount}
            />
          </Section>

        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <DeleteAccountModal
        visible={deleteModalVisible}
        loading={isDeletingAccount}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  pageHeaderDesktop: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  pageTitle: {
    color: '#f1f5f9',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
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
  // Section
  section: {
    gap: 6,
  },
  sectionTitle: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  sectionCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
  },
  // Connected state
  connectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  connectedText: {
    flex: 1,
    color: '#4ade80',
    fontWeight: '600',
    fontSize: 14,
  },
  // Not connected state
  notConnectedBanner: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 6,
  },
  notConnectedTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  notConnectedSub: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 20,
  },
  // Connect button
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    margin: 16,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 54,
  },
  connectBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

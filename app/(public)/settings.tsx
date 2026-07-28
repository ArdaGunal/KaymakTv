import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';

import { useRouter } from 'expo-router';
import { useTranslation, Trans } from 'react-i18next';
import { Globe, CheckSquare, Square } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { exchangeAuthCode } from '../../services/traktApi';
import { notify } from '../../utils/confirmDialog';
import LegalTermsModal from '../../components/settings/LegalTermsModal';
import LanguageMenuModal from '../../components/settings/LanguageMenuModal';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

// Auth session için web browser desteğini kur
WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const { saveTokens, loginAsGuest } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLangMenuVisible, setIsLangMenuVisible] = useState(false);
  const [isLegalModalVisible, setIsLegalModalVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const { t, i18n } = useTranslation(['settings', 'common', 'legal']);

  // Redirect URI (app.json'daki scheme ile eşleşmeli)
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'kaymak',
    path: 'settings',
  });

  // Trakt yetki isteğini ayarla
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID || '',
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: false,
    },
    {
      authorizationEndpoint: 'https://trakt.tv/oauth/authorize',
    }
  );

  // OAuth authorization code'ları TEK KULLANIMLIKTIR. Aşağıdaki iki yakalayıcı
  // (expo-auth-session'ın `response`'u ve web'e özel manuel URL okuması) aynı
  // kod için BİRLİKTE tetiklenebiliyordu; ikinci değişim Trakt'tan
  // `invalid_grant` alıp ilk (başarılı) girişin üzerine hata mesajı basıyordu.
  // Bu ref, bir kodun yalnızca bir kez değişilmesini garanti eder.
  const exchangedCodeRef = useRef<string | null>(null);

  // Tarayıcıdan dönüş yanıtını (Authorization Code) yakala
  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      handleTokenExchange(code);
    } else if (response?.type === 'error') {
      notify(t('common:error'), t('loginCanceled'));
    }
  }, [response]);

  // Web için Özel Yönlendirme Yakalayıcı (COOP hatalarını kesin çözmek için Pop-up yerine Top-Level yönlendirme)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const oauthError = urlParams.get('error');
      if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        handleTokenExchange(code);
      } else if (oauthError) {
        // Trakt onayı reddedildiğinde `?error=access_denied` ile döner —
        // eskiden bu durum hiç okunmuyordu, kullanıcı sessizce giriş
        // ekranında kalıyordu.
        window.history.replaceState({}, document.title, window.location.pathname);
        notify(t('common:error'), t('loginCanceled'));
      }
    }
  }, []);

  const handleTraktLogin = () => {
    if (Platform.OS === 'web' && request?.url) {
      // Pop-up açmak yerine sekmenin tamamını Trakt'a yönlendir (COOP bypass)
      window.location.href = request.url;
    } else {
      // Mobilde normal çalışmaya devam et
      promptAsync();
    }
  };

  // Kodu alıp Trakt API üzerinden Access Token'a çevir
  const handleTokenExchange = async (code: string) => {
    // Aynı kod ikinci kez değişilmeye çalışılmasın (bkz. exchangedCodeRef).
    if (exchangedCodeRef.current === code) return;
    exchangedCodeRef.current = code;

    setIsGenerating(true);
    try {
      // `exchangeAuthCode` artık yanıtı DOĞRULUYOR: access_token yoksa veya
      // proxy eksik olduğu için HTML döndüyse istisna fırlatır. Eskiden burada
      // `if (tokenData?.access_token)` vardı ve `else`'i YOKTU — token'sız yanıt
      // hiçbir iz bırakmadan yutuluyor, kullanıcı sebebini göremeden misafir
      // olarak kalıyordu. Artık her başarısızlık aşağıdaki catch'e düşer.
      const tokenData = await exchangeAuthCode(code, redirectUri);
      await saveTokens(tokenData.access_token, tokenData.refresh_token);
      router.replace('/(protected)/(tabs)/explore');
    } catch (error: any) {
      console.error('Token Exchange Hatası:', error);
      // Kod tüketilmiş olabilir ama giriş başarısız — kullanıcı tekrar
      // deneyebilsin diye kilidi aç.
      exchangedCodeRef.current = null;

      const raw = String(error?.message ?? '');
      // `Alert.alert` react-native-web'de TAM NO-OP olduğu için bu mesajların
      // HİÇBİRİ web'de görünmüyordu — `notify` web'de window.alert'e düşer.
      if (raw.startsWith('AUTH_PROXY_MISSING')) {
        notify(t('common:error'), t('settings:loginProxyMissing'));
      } else if (raw.startsWith('AUTH_NO_TOKEN') || raw.startsWith('AUTH_BAD_RESPONSE')) {
        notify(t('common:error'), t('settings:loginTokenError'));
      } else {
        notify(t('common:error'), t('communicationError'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Right Language Button */}
      <TouchableOpacity 
        style={styles.topRightLangButton}
        onPress={() => setIsLangMenuVisible(true)}
      >
        <Globe size={18} color="#94a3b8" />
        <Text style={styles.topRightLangText}>{i18n.language.toUpperCase()}</Text>
      </TouchableOpacity>

      <LanguageMenuModal
        visible={isLangMenuVisible}
        onClose={() => setIsLangMenuVisible(false)}
      />

      <View style={[styles.contentWrapper, isDesktop && styles.desktopCard]}>
        <View style={[styles.headerContainer, isDesktop && { alignItems: 'center', marginBottom: 40 }]}>
          <Text style={[styles.title, isDesktop && { fontSize: 36, textAlign: 'center' }]}>{t('traktAccount')}</Text>
          <Text style={[styles.subtitle, isDesktop && { textAlign: 'center', fontSize: 18 }]}>{t('traktSubtitle')}</Text>
        </View>

      <View style={styles.formContainer}>
          <>
            <Text style={styles.description}>
              {t('traktDescription')}
            </Text>

            <TouchableOpacity 
              style={[styles.button, (!request || !isChecked) ? styles.buttonDisabled : null]} 
              activeOpacity={0.8} 
              onPress={handleTraktLogin} 
              disabled={!request || isGenerating || !isChecked}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('loginTrakt')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.checkboxContainer} 
              activeOpacity={0.7} 
              onPress={() => setIsChecked(!isChecked)}
            >
              {isChecked ? (
                <CheckSquare size={20} color="#3b82f6" />
              ) : (
                <Square size={20} color="#64748b" />
              )}
              <Text style={styles.checkboxText}>
                <Trans
                  i18nKey="settings:termsAcceptance"
                  components={{ 1: <Text onPress={() => setIsLegalModalVisible(true)} style={styles.linkText} /> }}
                />
              </Text>
            </TouchableOpacity>

            {isGenerating && <Text style={styles.pollingText}>{t('pollingAuth')}</Text>}

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('common:orDivider')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.button, styles.guestButton]}
              activeOpacity={0.8}
              onPress={async () => {
                await loginAsGuest();
                router.replace('/(protected)/(tabs)/explore');
              }}
            >
              <Text style={styles.guestButtonText}>{t('common:landingGuest')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.backButton]}
              activeOpacity={0.8}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.guestButtonText}>{t('common:viewShowcase')}</Text>
            </TouchableOpacity>
          </>
        </View>
      </View>
      <LegalTermsModal
        visible={isLegalModalVisible}
        onClose={() => setIsLegalModalVisible(false)}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
    justifyContent: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  desktopCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 15,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    } as any),
  },
  headerContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
  },
  formContainer: {
    gap: 16,
  },
  description: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#3b82f680',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  guestButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 8,
  },
  guestButtonText: {
    color: '#cbd5e1',
    fontWeight: '500',
    fontSize: 15,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748b',
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 10,
    paddingHorizontal: 8,
  },
  checkboxText: {
    color: '#cbd5e1',
    fontSize: 13,
    flexShrink: 1,
  },
  linkText: {
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  pollingText: {
    color: '#94a3b8',
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  topRightLangButton: {
    position: 'absolute',
    top: 50,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    zIndex: 10,
  },
  topRightLangText: {
    color: '#e2e8f0',
    fontWeight: 'bold',
    fontSize: 14,
  },
  backButton: {
    backgroundColor: 'transparent',
    marginTop: 8,
  },
});

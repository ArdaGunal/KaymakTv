import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';

import { useRouter } from 'expo-router';
import { useTranslation, Trans } from 'react-i18next';
import { Globe, CheckSquare, Square } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { exchangeAuthCode } from '../../services/traktApi';
import { notify } from '../../utils/confirmDialog';
import LegalTermsModal from '../../components/settings/LegalTermsModal';
import LanguageMenuModal from '../../components/settings/LanguageMenuModal';
import { GoogleSignInSection } from '../../components/settings/GoogleSignInSection';
import { useGoogleTraktLink } from '../../hooks/useGoogleTraktLink';
import { styles } from '../../components/settings/settings.styles';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

// Auth session için web browser desteğini kur
WebBrowser.maybeCompleteAuthSession();

const OrDivider = ({ t }: { t: (key: string) => string }) => (
  <View style={styles.dividerContainer}>
    <View style={styles.dividerLine} />
    <Text style={styles.dividerText}>{t('common:orDivider')}</Text>
    <View style={styles.dividerLine} />
  </View>
);

export default function Login() {
  const { saveTokens, saveGoogleSession, loginAsGuest } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingGoogleOnly, setIsCreatingGoogleOnly] = useState(false);
  const [isLangMenuVisible, setIsLangMenuVisible] = useState(false);
  const [isLegalModalVisible, setIsLegalModalVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const { t, i18n } = useTranslation(['settings', 'common', 'legal']);
  // F8 — bkz. hooks/useGoogleTraktLink.ts başlığı.
  const {
    awaitingTraktLink,
    captureCredential: handleGoogleCredential,
    cancel: cancelGoogleLink,
    completeIfPending: completeGoogleLinkIfPending,
    completeWithoutTrakt,
  } = useGoogleTraktLink();

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

  // OAuth kodları TEK KULLANIMLIKTIR. Aşağıdaki iki yakalayıcı (expo-auth-session'ın
  // `response`'u + web'e özel URL okuması) aynı kod için BİRLİKTE tetiklenip
  // ikinci değişim `invalid_grant` ile ilk (başarılı) girişin üzerine yazabiliyordu.
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
        // Trakt reddedildiğinde `?error=access_denied` ile döner — eskiden
        // okunmuyordu, kullanıcı sessizce giriş ekranında kalıyordu.
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

      // F8 — bekleyen bir Google bağlama akışı varsa tamamlar (yoksa no-op).
      // ⚠️ Bağlama BAŞARISIZ olsa bile normal Trakt girişi ENGELLENMEZ —
      // kullanıcı Trakt kimliğini az önce kanıtladı, ondan esirgemek kötü olur.
      try {
        await completeGoogleLinkIfPending(tokenData.access_token);
      } catch (linkError: any) {
        console.error('[Google Sign-In] Hesap bağlama hatası:', linkError);
        notify(
          t('common:error'),
          linkError?.message || t('settings:googleLinkFailed', 'Google hesabın bağlanamadı, ama Trakt ile giriş yaptın.')
        );
      }

      await saveTokens(tokenData.access_token, tokenData.refresh_token);
      router.replace('/(protected)/(tabs)/explore');
    } catch (error: any) {
      console.error('Token Exchange Hatası:', error);
      // Kod tüketilmiş olabilir ama giriş başarısız — kullanıcı tekrar
      // deneyebilsin diye kilidi aç.
      exchangedCodeRef.current = null;

      const raw = String(error?.message ?? '');
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

  // create_new — bkz. docs/HISTORY.md Madde 221. Köprü kartında "Trakt'sız
  // Devam Et" seçildiğinde: Worker'da Google-only yeni bir hesap açar (veya
  // zaten varsa bulur), dönen Kaymak oturum token'ını `saveGoogleSession`
  // ile saklar. Gerçek Trakt akışından FARKLI olarak burada `redirect_uri`/
  // `code` yok — tek ağ isteği, aynı sayfada kalınır.
  const handleContinueWithoutTrakt = async () => {
    setIsCreatingGoogleOnly(true);
    try {
      const sessionToken = await completeWithoutTrakt();
      await saveGoogleSession(sessionToken);
      router.replace('/(protected)/(tabs)/explore');
    } catch (error: any) {
      console.error('[Google Sign-In] Trakt\'sız hesap oluşturma hatası:', error);
      notify(t('common:error'), error?.message || t('communicationError'));
    } finally {
      setIsCreatingGoogleOnly(false);
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

            {/* 2026-08-21 — kullanım koşulları onayı artık İKİ girişin de
                (Trakt + Google) ÜSTÜNDE, tek bir kapı olarak duruyor —
                eskiden Trakt butonuyla Google seçeneği arasına sıkışmış
                olması, Google'ın ikincil/gizli bir seçenekmiş gibi
                algılanmasının bir parçasıydı. */}
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

            {/* Trakt ve Google artık AYNI görsel ağırlıkta, art arda iki eşit
                seçenek olarak duruyor — köprü kartı (awaitingTraktLink) devrede
                iken Trakt butonu GİZLENİR, çünkü o an seçim zaten "Trakt'a
                bağlan mı, Trakt'sız mı devam edilsin" sorusuna dönüşmüş oluyor
                (bkz. GoogleSignInSection'ın kendi awaitingTraktLink dalı). */}
            {!awaitingTraktLink && (
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
            )}

            {isGenerating && <Text style={styles.pollingText}>{t('pollingAuth')}</Text>}

            {/* F8 — Google ile giriş (yalnızca web; iOS/Android bilinçli olarak ertelendi). */}
            {(awaitingTraktLink || Platform.OS === 'web') && (
              <>
                {!awaitingTraktLink && (
                  <View style={styles.miniDivider}>
                    <View style={styles.miniDividerLine} />
                    <Text style={styles.miniDividerText}>{t('common:orDivider')}</Text>
                    <View style={styles.miniDividerLine} />
                  </View>
                )}
                <GoogleSignInSection
                  isChecked={isChecked}
                  isGenerating={isGenerating}
                  canPromptTrakt={!!request}
                  awaitingTraktLink={awaitingTraktLink}
                  onCredential={(idToken, nonce) => handleGoogleCredential(idToken, nonce, handleTraktLogin)}
                  onContinueWithTrakt={handleTraktLogin}
                  onCancelLink={cancelGoogleLink}
                  onContinueWithoutTrakt={handleContinueWithoutTrakt}
                  isCreatingAccount={isCreatingGoogleOnly}
                />
              </>
            )}

            <OrDivider t={t} />

            <View style={styles.tertiaryRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={async () => {
                  await loginAsGuest();
                  router.replace('/(protected)/(tabs)/explore');
                }}
              >
                <Text style={styles.tertiaryLinkText}>{t('common:landingGuest')}</Text>
              </TouchableOpacity>
              <Text style={styles.tertiarySeparator}>·</Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.replace('/')}>
                <Text style={styles.tertiaryLinkText}>{t('common:viewShowcase')}</Text>
              </TouchableOpacity>
            </View>
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


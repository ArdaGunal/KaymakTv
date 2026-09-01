import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAppBack } from '../../hooks/useAppBack';
import { Activity, Bell, FileText, Globe, MessageCircle, Rss, ShieldCheck, User } from '../../components/icons';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LanguagePickerModal from '../../components/settings/LanguagePickerModal';
import LegalTermsModal from '../../components/settings/LegalTermsModal';
import ProfileUsernameSection from '../../components/settings/ProfileUsernameSection';
import ReportIssueModal from '../../components/settings/ReportIssueModal';
import SettingsRow from '../../components/settings/SettingsRow';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { SettingsSection, SettingsSectionDivider } from '../../components/settings/SettingsSection';
import { TraktAccountSection } from '../../components/settings/TraktAccountSection';
import { GoogleLinkSection } from '../../components/settings/GoogleLinkSection';
import ClearCacheRow from '../../components/settings/ClearCacheRow';
import Snackbar from '../../components/Snackbar';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';

// Sürüm numarasına ard arda dokununca gizli Geliştirici Paneli açılır
// (Android'in "Yapı Numarası"na dokunma esprisiyle aynı mantık). 5. dokunuşta
// bir uyarı belirir ("az kaldı"), 7. dokunuşta panel DOĞRUDAN açılır — ayrı
// bir "kilit aç" adımı yok, jest tek başına hem kilidi açar hem yönlendirir.
const DEV_MODE_WARNING_TAPS = 5;
const DEV_MODE_REQUIRED_TAPS = 7;
const DEV_MODE_TAP_WINDOW_MS = 1500;

const DESKTOP_BREAKPOINT = 768;

export default function SettingsScreen() {
  const { accessToken, isGuest, authProvider } = useAuth();
  const { handleChangeLanguage, currentLanguage } = useSettings();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);

  // ── Gizli Geliştirici Paneli (sürüm numarasına ard arda dokunma) ─────────
  // Kalıcı DEĞİL (AsyncStorage'a yazılmıyor): uygulama yeniden açıldığında
  // sıfırlanır — bu, "gizli" bir tanılama anahtarı için bilinçli bir tercih;
  // gerçek kullanıcının yanlışlıkla bunu açık bırakması söz konusu olmasın.
  // `isDeveloperMode` TEK YÖNLÜ açılır (bir daha gizlenmez): amaç artık "kilit
  // aç/kapa" değil, "Ayarlar'da kalıcı bir kısayol bırak" — kullanıcı panele
  // her dönüşte 7 kez dokunmak zorunda kalmasın.
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
      setIsDeveloperMode(true);
      // Panele DOĞRUDAN geçiliyor — ayrı bir "kilit açıldı" onayı beklemeye
      // gerek yok, yönlendirmenin kendisi zaten geri bildirimdir.
      router.push('/(protected)/dev-panel');
    } else if (tapCountRef.current === DEV_MODE_WARNING_TAPS) {
      setDevModeToast({
        visible: true,
        message: t('settings:devPanelOpeningHint', '🛠️ Geliştirici Paneli açılıyor... {{count}} dokunuş kaldı', {
          count: DEV_MODE_REQUIRED_TAPS - DEV_MODE_WARNING_TAPS,
        }),
      });
    }
  };

  const appVersion = Constants.expoConfig?.version ?? '2.0.3';

  const navigateBack = useAppBack();

  // ── Trakt girişi ────────────────────────────────────────────────────────
  // Bu ekranda OAuth YOK. Trakt'a kayıtlı yönlendirme adresi tek bir yola
  // (`/settings`) işaret ettiği için giriş akışı da TEK ekranda yaşamalı;
  // burada yalnızca o ekrana yönlendiriyoruz (bkz. TraktAccountSection).
  const goToLogin = () => router.push('/(public)/settings');

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
          {/* 🔴 `!!accessToken` DEĞİL (2026-08-22 canlı testinde bulundu):
              Google-only kullanıcıda (`create_new`, Madde 221) `accessToken`
              DOLU ama içindeki değer bir Trakt token'ı DEĞİL — Kaymak oturum
              token'ı. Eski koşul bu kullanıcıya "Trakt hesabı bağlı ✓"
              gösteriyordu; oysa hiç bağlı değil ve Kütüphane/Takvim ona
              "Trakt'a bağlan" diyordu — uygulama kendi içinde ÇELİŞİYORDU.
              Doğru kaynak `authProvider`: yalnızca gerçek Trakt token'ı
              yazıldığında 'trakt' olur (bkz. AuthContext.saveTokens). */}
          <TraktAccountSection
            isConnected={authProvider === 'trakt'}
            onGoToLogin={goToLogin}
          />

          {/* Yalnızca Google-only kullanıcı için görünür — kendi kendine
              yeterli bir bileşen, bkz. ProfileUsernameSection.tsx başlığı. */}
          <ProfileUsernameSection />

          {/* Google artık bir GİRİŞ yöntemi değil, Trakt'lı hesaba eklenen bir
              BAĞLAMA seçeneği (2026-08-23 ürün kararı). Bileşen kendi kapısını
              kendi tutuyor: yalnızca web + gerçek Trakt kullanıcısı görür,
              misafir GÖRMEZ (`link_trakt` Trakt token'ı zorunlu kılıyor).
              Gerekçe ve geri alma: docs/design/GOOGLE_AUTH_MIGRATION.md */}
          <GoogleLinkSection />

          <SettingsSection title={t('settings:accountPreferences', 'Hesap Tercihleri')}>
            <SettingsRow
              icon={<User size={20} color="#60a5fa" />}
              label={t('settings:accountSettings', 'Hesap Ayarları')}
              tintColor="#60a5fa"
              showChevron
              onPress={() => router.push('/(protected)/account-settings')}
            />
          </SettingsSection>

          <SettingsSection title={t('settings:appPreferences', 'Uygulama Tercihleri')}>
            <SettingsRow
              icon={<Globe size={20} color="#60a5fa" />}
              label={t('language', 'Dil')}
              tintColor="#60a5fa"
              value={languageLabel}
              showChevron
              onPress={() => setLanguageModalVisible(true)}
            />
            {/* Bildirimler ve Akış Ayarları (docs/design/notifications.md).
                Misafire GÖSTERİLMEZ: bildirimler ve akış ayarları kullanıcının
                Trakt hesabına dayanır, misafirin böyle bir hesabı yoktur. */}
            {!isGuest && accessToken && (
              <>
                <SettingsSectionDivider />
                <SettingsRow
                  icon={<Bell size={20} color="#3b82f6" />}
                  label={t('notifications:screenTitle', 'Bildirimler')}
                  tintColor="#3b82f6"
                  showChevron
                  onPress={() => router.push('/(protected)/notification-settings')}
                />
                <SettingsSectionDivider />
                <SettingsRow
                  icon={<Rss size={20} color="#c084fc" />}
                  label={t('settings:feedSettings', 'Akış Ayarları')}
                  tintColor="#c084fc"
                  showChevron
                  onPress={() => router.push('/(protected)/feed-settings')}
                />
              </>
            )}
            {/* TODO.md → Performans: F13'ten sonra (expo-image + disk cache)
                disk kullanımı arttı, bu buton artık anlamlı. Web'de
                kendi içinde null döner (bkz. ClearCacheRow başlığı). */}
            {Platform.OS !== 'web' && <SettingsSectionDivider />}
            <ClearCacheRow />
          </SettingsSection>

          {/* Google Play "Uygulama içeriği" gereksinimi: giriş yapmış bir
              kullanıcının onayladığı metne bir daha ulaşabilmesi gerekir —
              eskiden `LegalTermsModal` yalnızca (public)/settings.tsx'teki
              giriş ekranında vardı, Ayarlar'da hiç yoktu. Kullanım Koşulları
              in-app modal olarak kalıyor (mevcut bileşen); Gizlilik
              Politikası ise KENDİ URL'i olan (public)/gizlilik.tsx'e
              yönlendiriyor — Play Console'un istediği bağımsız, girişsiz
              erişilebilen bağlantı budur. */}
          <SettingsSection title={t('settings:legalSection', 'Yasal')}>
            <SettingsRow
              icon={<FileText size={20} color="#60a5fa" />}
              label={t('settings:termsOfUseRowLabel', 'Kullanım Koşulları')}
              tintColor="#60a5fa"
              showChevron
              onPress={() => setLegalModalVisible(true)}
            />

            <SettingsSectionDivider />

            <SettingsRow
              icon={<ShieldCheck size={20} color="#60a5fa" />}
              label={t('settings:privacyPolicyRowLabel', 'Gizlilik Politikası')}
              tintColor="#60a5fa"
              showChevron
              onPress={() => router.push('/(public)/gizlilik')}
            />
          </SettingsSection>

          {/* Tanılama artık HER ZAMAN görünür (eskiden yalnızca gizli
              Geliştirici Modu açıkken görünürdü) — "İstek/Öneri/Şikayet"
              satırı normal kullanıcı için de burada, her zaman en altta.
              "Geliştirici Paneli" satırı ise hâlâ yalnızca sürüm numarasına
              7 hızlı dokunmayla açılan gizli modda belirir (bkz. yukarıdaki
              handleVersionTap — o jest zaten panele DOĞRUDAN yönlendirir,
              bu satır yalnızca SONRAKİ ziyaretler için kalıcı bir kısayol). */}
          <SettingsSection title={t('settings:diagnostics', 'Destek & Geri Bildirim')}>
            {isDeveloperMode && (
              <>
                <SettingsRow
                  icon={<Activity size={20} color="#60a5fa" />}
                  label={t('settings:devPanelRowLabel', 'Geliştirici Paneli')}
                  tintColor="#60a5fa"
                  showChevron
                  onPress={() => router.push('/(protected)/dev-panel')}
                />

                <SettingsSectionDivider />
              </>
            )}

            <SettingsRow
              icon={<MessageCircle size={20} color="#60a5fa" />}
              label={t('settings:feedbackRowLabel', 'İstek / Öneri / Şikayet')}
              tintColor="#60a5fa"
              showChevron
              onPress={() => setReportModalVisible(true)}
            />
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


      <ReportIssueModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
      />

      <LegalTermsModal
        visible={legalModalVisible}
        onClose={() => setLegalModalVisible(false)}
      />

      <LanguagePickerModal
        visible={languageModalVisible}
        currentLanguage={currentLanguage}
        onSelect={handleChangeLanguage}
        onClose={() => setLanguageModalVisible(false)}
      />

      <Snackbar
        visible={devModeToast.visible}
        message={devModeToast.message}
        onDismiss={() => setDevModeToast((prev) => ({ ...prev, visible: false }))}
        duration={2500}
        // Sürüm etiketi ekranın EN ALTINDA — varsayılan alt konumdaki bir
        // toast tam onun üzerine biner ve kullanıcı 6./7. dokunuşu
        // YAPAMAZ hale gelir (bkz. docs/HISTORY.md). Üstte gösterilir.
        position="top"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0e131d',
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
    paddingTop: 12,
    gap: 20,
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  versionRow: {
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 8,
  },
  versionText: {
    color: '#424654',
    fontSize: 12,
    fontWeight: '500',
  },
});

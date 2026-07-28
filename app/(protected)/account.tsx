import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Activity, EyeOff, FileWarning, Globe, LogOut, MessageCircle, Star, Trash2, Tv } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DeleteAccountModal from '../../components/settings/DeleteAccountModal';
import LanguagePickerModal from '../../components/settings/LanguagePickerModal';
import ReportIssueModal from '../../components/settings/ReportIssueModal';
import SettingsRow from '../../components/settings/SettingsRow';
import SettingsSwitchRow from '../../components/settings/SettingsSwitchRow';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { SettingsSection, SettingsSectionDivider } from '../../components/settings/SettingsSection';
import { TraktAccountSection } from '../../components/settings/TraktAccountSection';
import Snackbar from '../../components/Snackbar';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { useFeedPrivacy } from '../../features/feed/hooks/useFeedPrivacy';

// Sürüm numarasına bu kadar kez, aşağıdaki pencere içinde ard arda dokununca
// gizli "Geliştirici Modu" açılır/kapanır (Android'in "Yapı Numarası"na
// dokunma esprisiyle aynı mantık). Aynı jest tekrar uygulanınca modu
// KAPATIR — açma/kapama tek bir dokunma dizisiyle simetrik.
const DEV_MODE_REQUIRED_TAPS = 7;
const DEV_MODE_TAP_WINDOW_MS = 1500;

const DESKTOP_BREAKPOINT = 768;

export default function SettingsScreen() {
  const { accessToken, isGuest } = useAuth();
  const { handleLogout, handleDeleteAccount, handleChangeLanguage, currentLanguage,
    isLoggingOut, isDeletingAccount, handleExportMetrics, isExportingMetrics } = useSettings();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const feedPrivacy = useFeedPrivacy();

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

  // ── Trakt girişi ────────────────────────────────────────────────────────
  // Bu ekranda OAuth YOK. Trakt'a kayıtlı yönlendirme adresi tek bir yola
  // (`/settings`) işaret ettiği için giriş akışı da TEK ekranda yaşamalı;
  // burada yalnızca o ekrana yönlendiriyoruz (bkz. TraktAccountSection).
  const goToLogin = () => router.push('/(public)/settings');

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
            onGoToLogin={goToLogin}
          />

          <SettingsSection title={t('settings:appPreferences', 'Uygulama Tercihleri')}>
            <SettingsRow
              icon={<Globe size={20} color="#60a5fa" />}
              label={t('language', 'Dil')}
              tintColor="#60a5fa"
              value={languageLabel}
              showChevron
              onPress={() => setLanguageModalVisible(true)}
            />
          </SettingsSection>

          {/* Misafirin bir Trakt hesabı yok — bu ayarın onun için hiçbir
              anlamı yok, bu yüzden yalnızca gerçek kullanıcıya gösterilir. */}
          {!isGuest && accessToken && (
            <SettingsSection title={t('settings:feedSection', 'Akış')}>
              {/* DB'de ayrı bir sütun DEĞİL — ikisi de kapalıysa türetilmiş
                  olarak açık görünür (bkz. useFeedPrivacy.ts: hideAll).
                  Açılınca ikisini birden kapatır, kapanınca ikisini birden
                  açar; alttaki ikisi bu açıkken devre dışı/soluk kalır. */}
              <SettingsSwitchRow
                icon={<EyeOff size={20} color="#60a5fa" />}
                label={t('settings:hideFromFeed', 'Aktivitemi Akışta Gizle')}
                hint={t('settings:hideFromFeedHint', 'Açıkken izlediklerin ve puanladıkların kimsenin akışında görünmez.')}
                tintColor="#60a5fa"
                value={feedPrivacy.hideAll}
                onValueChange={feedPrivacy.setHideAll}
                isLoading={feedPrivacy.isLoading}
                disabled={feedPrivacy.savingKey !== null}
              />

              <SettingsSectionDivider />

              <SettingsSwitchRow
                icon={<Tv size={20} color="#60a5fa" />}
                label={t('settings:publishWatches', 'İzlediklerimi Akışta Paylaş')}
                hint={t('settings:publishWatchesHint', 'Kapatırsan izleme aktiviten kimsenin akışında görünmez.')}
                tintColor="#60a5fa"
                value={feedPrivacy.settings.publishWatches}
                onValueChange={(v) => feedPrivacy.update('publishWatches', v)}
                isLoading={feedPrivacy.isLoading}
                disabled={feedPrivacy.savingKey !== null || feedPrivacy.hideAll}
              />

              <SettingsSectionDivider />

              <SettingsSwitchRow
                icon={<Star size={20} color="#60a5fa" />}
                label={t('settings:publishRatings', 'Puanlarımı Akışta Paylaş')}
                hint={t('settings:publishRatingsHint', 'Kapatırsan verdiğin puanlar kimsenin akışında görünmez.')}
                tintColor="#60a5fa"
                value={feedPrivacy.settings.publishRatings}
                onValueChange={(v) => feedPrivacy.update('publishRatings', v)}
                isLoading={feedPrivacy.isLoading}
                disabled={feedPrivacy.savingKey !== null || feedPrivacy.hideAll}
              />
            </SettingsSection>
          )}

          <SettingsSection title={t('settings:accountOptions', 'Hesap Seçenekleri')}>
            <SettingsRow
              icon={<LogOut size={20} color="#fb923c" />}
              label={isGuest ? t('settings:exitGuestMode', 'Misafir Modundan Çık') : t('logoutReset', 'Çıkış Yap')}
              tintColor="#fb923c"
              isDestructive
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
                  isDestructive
                  onPress={() => setDeleteModalVisible(true)}
                  disabled={isDeletingAccount}
                />
              </>
            )}
          </SettingsSection>

          {/* Tanılama artık HER ZAMAN görünür (eskiden yalnızca gizli
              Geliştirici Modu açıkken görünürdü) — "Hata Bildir" satırı normal
              kullanıcı için de burada, her zaman en altta. Performans Raporu
              ve Hata Günlüğü satırları ise hâlâ yalnızca sürüm numarasına 7
              hızlı dokunmayla açılan gizli Geliştirici Modu'nda belirir. */}
          <SettingsSection title={t('settings:diagnostics', 'Destek & Geri Bildirim')}>
            {isDeveloperMode && (
              <>
                <SettingsRow
                  icon={<Activity size={20} color="#60a5fa" />}
                  label={t('settings:exportPerformanceReport')}
                  tintColor="#60a5fa"
                  onPress={handleExportMetrics}
                  disabled={isExportingMetrics}
                />

                <SettingsSectionDivider />

                <SettingsRow
                  icon={<FileWarning size={20} color="#60a5fa" />}
                  label={t('settings:errorLogTitle')}
                  tintColor="#60a5fa"
                  showChevron
                  onPress={() => router.push('/(protected)/error-log')}
                />

                <SettingsSectionDivider />
              </>
            )}

            <SettingsRow
              icon={<MessageCircle size={20} color="#60a5fa" />}
              label={t('settings:reportIssueRowLabel', 'Bize Ulaşın / Hata Bildir')}
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

      <DeleteAccountModal
        visible={deleteModalVisible}
        loading={isDeletingAccount}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalVisible(false)}
      />

      <ReportIssueModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
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

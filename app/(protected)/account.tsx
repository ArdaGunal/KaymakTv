import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Activity, ExternalLink, EyeOff, FileText, Globe, Lock, LogOut, MessageCircle, PenLine, AlertTriangle, ShieldCheck, Star, Trash2, Tv, UserX } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking,
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
import LegalTermsModal from '../../components/settings/LegalTermsModal';
import ProfileUsernameSection from '../../components/settings/ProfileUsernameSection';
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
import { useProfilePrivacy } from '../../hooks/useProfilePrivacy';

// Sürüm numarasına ard arda dokununca gizli Geliştirici Paneli açılır
// (Android'in "Yapı Numarası"na dokunma esprisiyle aynı mantık). 5. dokunuşta
// bir uyarı belirir ("az kaldı"), 7. dokunuşta panel DOĞRUDAN açılır — ayrı
// bir "kilit aç" adımı yok, jest tek başına hem kilidi açar hem yönlendirir.
const DEV_MODE_WARNING_TAPS = 5;
const DEV_MODE_REQUIRED_TAPS = 7;
const DEV_MODE_TAP_WINDOW_MS = 1500;

const DESKTOP_BREAKPOINT = 768;

const TRAKT_PRIVACY_SETTINGS_URL = 'https://trakt.tv/settings/privacy';

export default function SettingsScreen() {
  const { accessToken, isGuest, authProvider } = useAuth();
  const { handleLogout, handleDeleteAccount, handleChangeLanguage, currentLanguage,
    isLoggingOut, isDeletingAccount } = useSettings();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const feedPrivacy = useFeedPrivacy();
  const profilePrivacy = useProfilePrivacy();

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

  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(protected)/(tabs)/explore');
  };

  // ── Trakt girişi ────────────────────────────────────────────────────────
  // Bu ekranda OAuth YOK. Trakt'a kayıtlı yönlendirme adresi tek bir yola
  // (`/settings`) işaret ettiği için giriş akışı da TEK ekranda yaşamalı;
  // burada yalnızca o ekrana yönlendiriyoruz (bkz. TraktAccountSection).
  const goToLogin = () => router.push('/(public)/settings');

  // Trakt gizlilik ayarları yalnızca trakt.tv üzerinden değiştirilebiliyor
  // (bkz. yukarıdaki "Gizlilik" bölümündeki not / docs/HISTORY.md Madde 134).
  const openTraktPrivacySettings = () => {
    Linking.openURL(TRAKT_PRIVACY_SETTINGS_URL).catch((err) => console.error('URL açılamadı:', err));
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
              {/* Y18: gizlilik ayarı kaydedilemediğinde GÖRÜNÜR uyarı.
                  Eskiden catch yalnızca console.warn atıyor, anahtar sessizce
                  eski hâline dönüyordu — kullanıcı fark etmezse gizlediğini
                  SANIYORDU. Bir gizlilik kontrolünde bu kabul edilemez.
                  Bölümün en üstünde, çünkü hangi anahtarın başarısız olduğundan
                  bağımsız olarak görülmesi gerekiyor. */}
              {!!feedPrivacy.saveError && (
                <View style={styles.privacyErrorBox}>
                  <AlertTriangle size={14} color="#f87171" />
                  <Text style={styles.privacyErrorText}>{feedPrivacy.saveError}</Text>
                </View>
              )}

              {/* ⚠️ BU BÖLÜMDEKİ DÖRT ANAHTAR DA "GİZLE" YÖNÜNDE:
                  AÇIK = GİZLİ. Bu bilinçli bir tutarlılık kararı.

                  ESKİDEN karışıktı: üstteki anahtar "Gizle" (açık=gizli),
                  alttaki üçü "Paylaş" (açık=görünür) idi — yani aynı ekranda
                  iki ZIT yön vardı. Daha kötüsü, "Gizle"yi açınca alttaki üç
                  anahtar `false`'a düşüp KAPALI görünüyordu: kullanıcı "her
                  şeyi gizledim" derken üç anahtarın kapanmasını görüyordu.
                  Kullanıcı bunu test sırasında bildirdi.

                  DB alanları hâlâ `publish_*` (true = paylaş) — veri modeli
                  DOĞRU ve DEĞİŞMEDİ, yalnızca UI onu tersine çevirip
                  gösteriyor (dönüşüm tam olarak bu dosyada, tek yerde).
                  Artık "Tüm Aktivitemi Gizle" açıkken alt üçü de AÇIK ve
                  soluk görünüyor — gördüğün şey anlatılan şeyle aynı.

                  DB'de ayrı bir "hepsini gizle" sütunu YOK — ÜÇÜ de kapalıysa
                  türetiliyor (bkz. useFeedPrivacy.ts: hideAll). */}
              <SettingsSwitchRow
                icon={<EyeOff size={20} color="#60a5fa" />}
                label={t('settings:hideFromFeed', 'Tüm Aktivitemi Gizle')}
                hint={t('settings:hideFromFeedHint', 'Açıkken izlediklerin, puanladıkların ve incelemelerin kimsenin akışında görünmez.')}
                tintColor="#60a5fa"
                value={feedPrivacy.hideAll}
                onValueChange={feedPrivacy.setHideAll}
                isLoading={feedPrivacy.isLoading}
                disabled={feedPrivacy.savingKey !== null}
              />

              <SettingsSectionDivider />

              {/* `hide` ↔ `publish` dönüşümü: switch AÇIK = gizli = publish false. */}
              <SettingsSwitchRow
                icon={<Tv size={20} color="#60a5fa" />}
                label={t('settings:hideWatches', 'İzlediklerimi Gizle')}
                hint={t('settings:hideWatchesHint', 'Açıkken izleme aktiviten kimsenin akışında görünmez.')}
                tintColor="#60a5fa"
                value={!feedPrivacy.settings.publishWatches}
                onValueChange={(hide) => feedPrivacy.update('publishWatches', !hide)}
                isLoading={feedPrivacy.isLoading}
                disabled={feedPrivacy.savingKey !== null}
              />

              <SettingsSectionDivider />

              <SettingsSwitchRow
                icon={<Star size={20} color="#60a5fa" />}
                label={t('settings:hideRatings', 'Puanlarımı Gizle')}
                hint={t('settings:hideRatingsHint', 'Açıkken verdiğin puanlar kimsenin akışında görünmez.')}
                tintColor="#60a5fa"
                value={!feedPrivacy.settings.publishRatings}
                onValueChange={(hide) => feedPrivacy.update('publishRatings', !hide)}
                isLoading={feedPrivacy.isLoading}
                disabled={feedPrivacy.savingKey !== null}
              />

              <SettingsSectionDivider />

              {/* 021 — üstteki ikisinden ÖNEMLİ BİR FARKI var ve hint bunu
                  açıkça söylüyor: kapatmak içeriği SİLMEZ, yalnızca akıştan
                  gizler. İzleme/puan kapatılınca satırlar gerçekten siliniyor
                  (Trakt'ın aynası, senkron geri getirir); inceleme ise elle
                  yazılmış, geri getirilemez içerik (Madde 165). */}
              <SettingsSwitchRow
                icon={<PenLine size={20} color="#60a5fa" />}
                label={t('settings:hideManual', 'İncelemelerimi Gizle')}
                hint={t('settings:hideManualHint', 'Açıkken incelemelerin ve gönderilerin akışta görünmez. Silinmezler — dizi ve film sayfalarında kalmaya devam eder.')}
                tintColor="#60a5fa"
                value={!feedPrivacy.settings.publishManual}
                onValueChange={(hide) => feedPrivacy.update('publishManual', !hide)}
                isLoading={feedPrivacy.isLoading}
                disabled={feedPrivacy.savingKey !== null}
              />

              <SettingsSectionDivider />

              <SettingsRow
                icon={<UserX size={20} color="#60a5fa" />}
                label={t('settings:blockedUsers', 'Engellenen Kullanıcılar')}
                tintColor="#60a5fa"
                showChevron
                onPress={() => router.push('/(protected)/blocked-users')}
              />
            </SettingsSection>
          )}

          {/* Trakt'ın hesap düzeyindeki Gizli/Açık Hesap ayarı — KaymakTV'nin
              kendi akış gizliliğinden (yukarıdaki "Akış" bölümü) BAĞIMSIZ.
              Misafirin bir Trakt hesabı yok, bu yüzden yalnızca gerçek
              kullanıcıya gösterilir (yukarıdaki "Akış" bölümüyle AYNI guard).

              ⛔ SALT OKUNUR — buraya bir Switch GERİ EKLEMEYİN (bkz.
              docs/HISTORY.md Madde 134): Trakt'ın public API'si
              `/users/settings`'e YAZMAYA izin vermiyor (yalnızca GET
              belgelenmiş; PUT first-party bir uç nokta ve üçüncü parti
              anahtarla her zaman 401 dönüyor). Eskiden burada bir Switch
              vardı ve çalışıyormuş gibi görünüyordu — gerçekte Trakt'a HİÇ
              yazmıyordu. Durum okunup gösteriliyor, değiştirmek için
              kullanıcı trakt.tv'ye yönlendiriliyor. */}
          {!isGuest && accessToken && (
            <SettingsSection title={t('settings:privacySection', 'Gizlilik')}>
              <SettingsRow
                icon={<Lock size={20} color="#60a5fa" />}
                label={t('settings:privateAccount', 'Hesap Gizliliği')}
                tintColor="#60a5fa"
                value={
                  profilePrivacy.isLoading
                    ? t('common:loading', 'Yükleniyor...')
                    : profilePrivacy.isPrivate
                    ? t('settings:privateAccountPrivate', 'Gizli')
                    : t('settings:privateAccountPublic', 'Açık')
                }
              />

              <SettingsSectionDivider />

              <SettingsRow
                icon={<ExternalLink size={20} color="#60a5fa" />}
                label={t('settings:privacyManageOnTrakt', "Gizlilik ayarlarını Trakt.tv'de yönet")}
                tintColor="#60a5fa"
                showChevron
                onPress={openTraktPrivacySettings}
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
  privacyErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.28)',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  privacyErrorText: {
    color: '#fca5a5',
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
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

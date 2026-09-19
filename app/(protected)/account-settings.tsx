import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useRouter } from 'expo-router';

import { useAppBack } from '../../hooks/useAppBack';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { SettingsSection, SettingsSectionDivider } from '../../components/settings/SettingsSection';
import SettingsRow from '../../components/settings/SettingsRow';
import SettingsSwitchRow from '../../components/settings/SettingsSwitchRow';
import DeleteAccountModal from '../../components/settings/DeleteAccountModal';
import { TraktAccountSection } from '../../components/settings/TraktAccountSection';
import TraktImportSection from '../../components/settings/TraktImportSection';
import { Lock, LogOut, Trash2 } from '../../components/icons';
import { confirmAsync, notify } from '../../utils/confirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { useProfilePrivacy } from '../../hooks/useProfilePrivacy';

const DESKTOP_BREAKPOINT = 768;

export default function AccountSettingsScreen() {
  const { t } = useTranslation(['settings', 'common']);
  const navigateBack = useAppBack();
  const { accessToken, isGuest, authProvider } = useAuth();
  const router = useRouter();
  const { handleLogout, handleDeleteAccount, isLoggingOut, isDeletingAccount } = useSettings();
  const profilePrivacy = useProfilePrivacy();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  // §C29 (M406) — gizlilik BİZDE. Açığa geçiş bekleyen istekleri otomatik
  // onaylıyor (kullanıcı kararı A) ve geri alınamıyor → önce onay.
  const gizliligiDegistir = async (yeni: boolean) => {
    if (!yeni) {
      const onay = await confirmAsync(
        t('settings:makePublicTitle', 'Hesabını herkese aç'),
        t(
          'settings:makePublicMessage',
          'Hesabın herkese açık olacak ve bekleyen tüm takip istekleri otomatik olarak onaylanacak.'
        ),
        t('settings:makePublicConfirm', 'Herkese Aç'),
        t('common:cancel', 'İptal')
      );
      if (!onay) return;
    }
    try {
      const { onaylananIstek } = await profilePrivacy.setPrivacy(yeni);
      if (onaylananIstek > 0) {
        notify(
          t('settings:privacySavedTitle', 'Hesabın artık herkese açık'),
          t('settings:requestsAutoApproved', {
            count: onaylananIstek,
            defaultValue: '{{count}} bekleyen takip isteği onaylandı.',
          })
        );
      }
    } catch (error: any) {
      notify(
        t('common:error', 'Hata'),
        error?.message || t('settings:privacyChangeFailed', 'Gizlilik ayarı kaydedilemedi.')
      );
    }
  };

  const handleDeleteConfirm = async () => {
    await handleDeleteAccount();
    setDeleteModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <SettingsHeader
        title={t('settings:accountSettings', 'Hesap Ayarları')}
        isDesktop={isDesktop}
        onBack={navigateBack}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          isDesktop && styles.contentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Bölüm 0: Trakt hesabı + veri aktarımı (kullanıcı kararı, 2026-09-12 —
            ana Ayarlar'dan buraya taşındı).
            🔴 `!!accessToken` DEĞİL: Google-only kullanıcıda `accessToken` DOLU ama
            Trakt token'ı değil; doğru kaynak `authProvider` (2026-08-22 canlı testi).
            Aktarım bölümü kendi kapısını kendi tutuyor (`useTraktImport.uygun`). */}
        {!isGuest && (
          <>
            <TraktAccountSection
              isConnected={authProvider === 'trakt'}
              onGoToLogin={() => router.push('/(public)/settings')}
            />
            <TraktImportSection />
          </>
        )}

        {/* Bölüm 1: Gizlilik — §C29 (M406): iki hesap türünde de BİZİM ayarımız.
            Eskiden Trakt'tan salt okunuyor ve «Trakt.tv'de yönet» bağlantısı
            veriliyordu; Google-only hesap hiç gizli olamıyordu. */}
        {!isGuest && accessToken && (
          <SettingsSection title={t('settings:privacySection', 'Gizlilik')}>
            <SettingsSwitchRow
              icon={<Lock size={20} color="#60a5fa" />}
              label={t('settings:privateAccountSwitch', 'Gizli hesap')}
              hint={t(
                'settings:privateAccountHint',
                'Gizli hesapta izlediklerini ve paylaşımlarını yalnızca onayladığın takipçiler görür.'
              )}
              tintColor="#60a5fa"
              value={profilePrivacy.isPrivate}
              onValueChange={gizliligiDegistir}
              disabled={profilePrivacy.isLoading || profilePrivacy.isSaving}
              isLoading={profilePrivacy.isLoading || profilePrivacy.isSaving}
            />
          </SettingsSection>
        )}

        {/* Bölüm 2: Hesap Seçenekleri */}
        <SettingsSection title={t('settings:accountOptions', 'Hesap Seçenekleri')}>
          <SettingsRow
            icon={<LogOut size={20} color="#fb923c" />}
            label={
              isGuest
                ? t('settings:exitGuestMode', 'Misafir Modundan Çık')
                : t('logoutReset', 'Çıkış Yap')
            }
            tintColor="#fb923c"
            isDestructive
            onPress={handleLogout}
            disabled={isLoggingOut}
          />

          {!isGuest && (
            <>
              <SettingsSectionDivider />

              <SettingsRow
                icon={<Trash2 size={20} color="#f87171" />}
                label={t('settings:deleteAccount', 'Hesabı Sil')}
                tintColor="#f87171"
                isDestructive
                onPress={() => setDeleteModalVisible(true)}
                disabled={isDeletingAccount}
              />
            </>
          )}
        </SettingsSection>
      </ScrollView>

      <DeleteAccountModal
        visible={deleteModalVisible}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalVisible(false)}
        loading={isDeletingAccount}
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
});

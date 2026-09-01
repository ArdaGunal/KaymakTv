import React, { useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAppBack } from '../../hooks/useAppBack';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { SettingsSection, SettingsSectionDivider } from '../../components/settings/SettingsSection';
import SettingsRow from '../../components/settings/SettingsRow';
import DeleteAccountModal from '../../components/settings/DeleteAccountModal';
import { Lock, ExternalLink, LogOut, Trash2 } from '../../components/icons';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { useProfilePrivacy } from '../../hooks/useProfilePrivacy';

const DESKTOP_BREAKPOINT = 768;
const TRAKT_PRIVACY_SETTINGS_URL = 'https://trakt.tv/settings/privacy';

export default function AccountSettingsScreen() {
  const { t } = useTranslation(['settings', 'common']);
  const navigateBack = useAppBack();
  const { accessToken, isGuest } = useAuth();
  const { handleLogout, handleDeleteAccount, isLoggingOut, isDeletingAccount } = useSettings();
  const profilePrivacy = useProfilePrivacy();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const openTraktPrivacySettings = () => {
    Linking.openURL(TRAKT_PRIVACY_SETTINGS_URL).catch((err) =>
      console.error('URL açılamadı:', err)
    );
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
        {/* Bölüm 1: Gizlilik (Trakt hesap gizliliği - Yalnızca giriş yapmış kullanıcı) */}
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

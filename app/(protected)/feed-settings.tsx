import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { useAppBack } from '../../hooks/useAppBack';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { SettingsSection, SettingsSectionDivider } from '../../components/settings/SettingsSection';
import SettingsSwitchRow from '../../components/settings/SettingsSwitchRow';
import SettingsRow from '../../components/settings/SettingsRow';
import { EyeOff, Tv, Star, PenLine, UserX, AlertTriangle } from '../../components/icons';
import { useFeedPrivacy } from '../../features/feed/hooks/useFeedPrivacy';

const DESKTOP_BREAKPOINT = 768;

export default function FeedSettingsScreen() {
  const { t } = useTranslation(['settings', 'common']);
  const navigateBack = useAppBack();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const feedPrivacy = useFeedPrivacy();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <SettingsHeader
        title={t('settings:feedSettings', 'Akış Ayarları')}
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
        {/* Hata uyarısı */}
        {!!feedPrivacy.saveError && (
          <View style={styles.privacyErrorBox}>
            <AlertTriangle size={14} color="#f87171" />
            <Text style={styles.privacyErrorText}>{feedPrivacy.saveError}</Text>
          </View>
        )}

        {/* Bölüm 1: Akış Gizliliği */}
        <SettingsSection
          title={t('settings:feedSection', 'Akış Gizliliği')}
          footerText={t(
            'settings:feedPrivacyFooter',
            'Gizlenen aktiviteler akışta gösterilmez. İncelemeler ise dizi ve film sayfalarında kalmaya devam eder.'
          )}
        >
          {/* Tüm Aktivitemi Gizle */}
          <SettingsSwitchRow
            icon={<EyeOff size={20} color="#c084fc" />}
            label={t('settings:hideFromFeed', 'Tüm Aktivitemi Gizle')}
            hint={t('settings:hideFromFeedHint', 'Açıkken izlediklerin, puanladıkların ve incelemelerin kimsenin akışında görünmez.')}
            tintColor="#c084fc"
            value={feedPrivacy.hideAll}
            onValueChange={feedPrivacy.setHideAll}
            isLoading={feedPrivacy.isLoading}
            disabled={feedPrivacy.savingKey !== null}
          />

          <SettingsSectionDivider />

          {/* İzlediklerimi Gizle */}
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

          {/* Puanlarımı Gizle */}
          <SettingsSwitchRow
            icon={<Star size={20} color="#fbbf24" />}
            label={t('settings:hideRatings', 'Puanlarımı Gizle')}
            hint={t('settings:hideRatingsHint', 'Açıkken verdiğin puanlar kimsenin akışında görünmez.')}
            tintColor="#fbbf24"
            value={!feedPrivacy.settings.publishRatings}
            onValueChange={(hide) => feedPrivacy.update('publishRatings', !hide)}
            isLoading={feedPrivacy.isLoading}
            disabled={feedPrivacy.savingKey !== null}
          />

          <SettingsSectionDivider />

          {/* İncelemelerimi Gizle */}
          <SettingsSwitchRow
            icon={<PenLine size={20} color="#34d399" />}
            label={t('settings:hideManual', 'İncelemelerimi Gizle')}
            hint={t('settings:hideManualHint', 'Açıkken incelemelerin ve gönderilerin akışta görünmez. Silinmezler — dizi ve film sayfalarında kalmaya devam eder.')}
            tintColor="#34d399"
            value={!feedPrivacy.settings.publishManual}
            onValueChange={(hide) => feedPrivacy.update('publishManual', !hide)}
            isLoading={feedPrivacy.isLoading}
            disabled={feedPrivacy.savingKey !== null}
          />
        </SettingsSection>

        {/* Bölüm 2: Topluluk & Engelleme */}
        <SettingsSection title={t('settings:communitySection', 'Topluluk')}>
          <SettingsRow
            icon={<UserX size={20} color="#f87171" />}
            label={t('settings:blockedUsers', 'Engellenen Kullanıcılar')}
            tintColor="#f87171"
            showChevron
            onPress={() => router.push('/(protected)/blocked-users')}
          />
        </SettingsSection>
      </ScrollView>
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
  privacyErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    borderRadius: 12,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  privacyErrorText: {
    color: '#fca5a5',
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
});

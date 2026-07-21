import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckCircle2, Compass, UserCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import LoadingIndicator from '../LoadingIndicator';
import SettingsRow from './SettingsRow';
import { SettingsSection, SettingsSectionDivider } from './SettingsSection';

interface TraktAccountSectionProps {
  isConnected: boolean;
  isConnecting: boolean;
  canConnect: boolean;
  onConnect: () => void;
  onGoToApp: () => void;
}

// "Hesap Ayarları" bölümü: Trakt bağlıysa durum banner'ı + uygulamaya dön
// satırı, değilse bağlanma daveti + buton. account.tsx'i 400 satır sınırının
// altında tutmak için ayrıştırıldı.
export function TraktAccountSection({ isConnected, isConnecting, canConnect, onConnect, onGoToApp }: TraktAccountSectionProps) {
  const { t } = useTranslation(['settings', 'common']);

  return (
    <SettingsSection title={t('accountSettings', 'Hesap Ayarları')}>
      {isConnected ? (
        <>
          <View style={styles.connectedBanner}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText}>{t('settings:traktConnected')}</Text>
            <CheckCircle2 size={18} color="#4ade80" />
          </View>

          <SettingsSectionDivider />

          <SettingsRow
            icon={<Compass size={20} color="#60a5fa" />}
            label={t('goToApp', 'Uygulamaya Git')}
            tintColor="#60a5fa"
            showChevron
            onPress={onGoToApp}
          />
        </>
      ) : (
        <>
          <View style={styles.notConnectedBanner}>
            <Text style={styles.notConnectedTitle}>{t('settings:traktNotConnectedTitle')}</Text>
            <Text style={styles.notConnectedSub}>{t('settings:traktNotConnectedSub')}</Text>
          </View>

          <SettingsSectionDivider />

          <TouchableOpacity
            style={[styles.connectBtn, isConnecting && styles.btnDisabled]}
            activeOpacity={0.82}
            onPress={onConnect}
            disabled={isConnecting || !canConnect}
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
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
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

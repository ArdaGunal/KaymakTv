import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { CheckCircle2, LogIn } from '../icons';
import { useTranslation } from 'react-i18next';
import { SettingsSection, SettingsSectionDivider } from './SettingsSection';

interface TraktAccountSectionProps {
  isConnected: boolean;
  onGoToLogin: () => void;
}

export function TraktAccountSection({ isConnected, onGoToLogin }: TraktAccountSectionProps) {
  const { t } = useTranslation(['settings', 'common']);

  return (
    <SettingsSection title={t('accountSettings', 'Hesap Ayarları')}>
      {isConnected ? (
        <View style={styles.connectedBanner}>
          <View style={styles.connectedDot} />
          <Text style={styles.connectedText}>{t('settings:traktConnected')}</Text>
          <CheckCircle2 size={18} color="#4ade80" />
        </View>
      ) : (
        <>
          <View style={styles.notConnectedBanner}>
            <Text style={styles.notConnectedTitle}>{t('settings:traktNotConnectedTitle')}</Text>
            <Text style={styles.notConnectedSub}>{t('settings:traktNotConnectedSub')}</Text>
          </View>

          <SettingsSectionDivider />

          <TouchableOpacity
            style={styles.connectBtn}
            activeOpacity={0.82}
            onPress={onGoToLogin}
            accessibilityRole="button"
          >
            <LogIn size={18} color="#fff" strokeWidth={2.2} />
            <Text style={styles.connectBtnText}>{t('settings:goToLogin', 'Giriş Yap')}</Text>
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
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '700',
  },
  notConnectedSub: {
    color: '#8c90a0',
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
    minHeight: 52,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  connectBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

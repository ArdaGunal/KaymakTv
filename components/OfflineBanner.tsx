import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { WifiOff } from './icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * Uygulama genelinde tek mount noktası (bkz. app/_layout.tsx —
 * `SoftUpdateBanner` ile AYNI desen). İnce, ekran genişliğinde, en üste
 * yapışık bir şerit — `SoftUpdateBanner`'ın yüzen kart tasarımından
 * BİLİNÇLİ OLARAK farklı (durum çubuğuna kadar uzanır) ki ikisi aynı anda
 * görünse bile görsel olarak çakışmasınlar.
 */
export default function OfflineBanner() {
  const isConnected = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');

  if (isConnected) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]} pointerEvents="none">
      <WifiOff size={13} color="#fff" />
      <Text style={styles.text}>{t('offlineBannerText', 'İnternet bağlantısı yok')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 6,
    backgroundColor: '#b91c1c',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

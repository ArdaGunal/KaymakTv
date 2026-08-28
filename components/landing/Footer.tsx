import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock } from '../icons';

export default function Footer() {
  const { t } = useTranslation('common');
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.divider} />

      {/* Marka */}
      <View style={styles.brandRow}>
        <View style={styles.brandDot} />
        <Text style={styles.brand}>KaymakTV</Text>
      </View>

      {/* Linkler */}
      <View style={styles.linkRow}>
        <TouchableOpacity onPress={() => router.push('/(public)/gizlilik')} activeOpacity={0.7}>
          <Text style={styles.link}>{t('product', 'Gizlilik Politikası')}</Text>
        </TouchableOpacity>
        <Text style={styles.linkDot}>·</Text>
        <TouchableOpacity onPress={() => router.push('/(public)/kullanim-kosullari')} activeOpacity={0.7}>
          <Text style={styles.link}>{t('other', 'Kullanım Koşulları')}</Text>
        </TouchableOpacity>
      </View>

      {/* Telif */}
      <Text style={styles.copyright}>{t('footerRights')}</Text>

      {/* Veri notu */}
      <View style={styles.dataRow}>
        <Lock size={12} color="#424654" strokeWidth={2} />
        <Text style={styles.dataText}>{t('dataLocal')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#090e18',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 32,
    maxWidth: 480,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 20,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5c8cf5',
    opacity: 0.8,
  },
  brand: {
    color: '#dee2f1',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  link: {
    color: '#8c90a0',
    fontSize: 12.5,
    fontWeight: '600',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  linkDot: {
    color: '#424654',
    fontSize: 12,
  },
  copyright: {
    color: '#424654',
    fontSize: 11.5,
    marginBottom: 10,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dataText: {
    color: '#424654',
    fontSize: 11,
    letterSpacing: 0.1,
  },
});

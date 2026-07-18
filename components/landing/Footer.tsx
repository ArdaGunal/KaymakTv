import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';

export default function Footer() {
  const { t } = useTranslation('common');
  return (
    <View style={styles.container}>
      <View style={styles.divider} />
      <Text style={styles.brand}>KaymakTV</Text>
      <Text style={styles.text}>{t('footerRights')}</Text>
      <Text style={styles.subText}>{t('footerData')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  divider: {
    width: 48,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  brand: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  text: {
    color: '#475569',
    fontSize: 13,
    marginBottom: 6,
  },
  subText: {
    color: '#334155',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
  },
});

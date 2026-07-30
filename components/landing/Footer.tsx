import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';

export default function Footer() {
  const { t } = useTranslation('common');

  return (
    <View style={styles.container}>
      <View style={styles.divider} />

      {/* Marka */}
      <View style={styles.brandRow}>
        <View style={styles.brandDot} />
        <Text style={styles.brand}>KaymakTV</Text>
      </View>

      <Text style={styles.tagline}>İzlediklerinin kaymağını çıkar.</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{t('footerRights')}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{t('footerData')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 28,
    maxWidth: 400,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3b82f6',
  },
  brand: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  tagline: {
    color: '#334155',
    fontSize: 12.5,
    marginBottom: 18,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    alignItems: 'center',
  },
  metaText: {
    color: '#1e293b',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  metaDot: {
    color: '#1e293b',
    fontSize: 11,
  },
});

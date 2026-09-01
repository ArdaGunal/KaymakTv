import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SettingsSectionProps {
  title?: string;
  footerText?: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, footerText, children }: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      {title && <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>}
      <View style={styles.sectionCard}>{children}</View>
      {footerText && <Text style={styles.footerText}>{footerText}</Text>}
    </View>
  );
}

export function SettingsSectionDivider() {
  return <View style={styles.rowDivider} />;
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#8c90a0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  sectionCard: {
    backgroundColor: 'rgba(27, 32, 42, 0.75)',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 66,
    marginRight: 0,
  },
  footerText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    paddingHorizontal: 4,
  },
});

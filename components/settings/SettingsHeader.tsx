import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft } from '../icons';
import { useTranslation } from 'react-i18next';

interface SettingsHeaderProps {
  title: string;
  isDesktop: boolean;
  onBack: () => void;
  rightSlot?: React.ReactNode;
}

export function SettingsHeader({ title, isDesktop, onBack, rightSlot }: SettingsHeaderProps) {
  const { t } = useTranslation('common');

  return (
    <View style={[styles.header, isDesktop && styles.headerDesktop]}>
      <TouchableOpacity
        style={[styles.backButton, isDesktop && styles.backButtonDesktop]}
        onPress={onBack}
        activeOpacity={0.75}
        accessibilityRole="button"
      >
        <ChevronLeft size={isDesktop ? 18 : 22} color="#f1f5f9" strokeWidth={2.2} />
        {isDesktop && <Text style={styles.backButtonText}>{t('back', 'Geri')}</Text>}
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {rightSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerDesktop: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 0,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    color: '#dee2f1',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonDesktop: {
    width: 'auto',
    height: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    ...({ cursor: 'pointer', transition: 'all 0.2s ease' } as any),
  },
  backButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
});

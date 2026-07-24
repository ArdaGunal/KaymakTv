import { Check, X } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SUPPORTED_LANGUAGES } from '../../locales/languageDetector';

interface LanguagePickerModalProps {
  visible: boolean;
  currentLanguage: string;
  onSelect: (lng: string) => void;
  onClose: () => void;
}

// Yeni bir dil eklendiğinde (locales/languageDetector.ts'teki
// SUPPORTED_LANGUAGES + locales/resources.ts'e dosya eklenmesi yeterli) burada
// bir meta girişi eklemek isteğe bağlıdır — eksikse kod + 🌐 ile otomatik
// düşer, liste yine de doğru çalışır.
const LANGUAGE_META: Record<string, { label: string; flag: string }> = {
  tr: { label: 'Türkçe', flag: '🇹🇷' },
  en: { label: 'English', flag: '🇬🇧' },
};

export default function LanguagePickerModal({
  visible,
  currentLanguage,
  onSelect,
  onClose,
}: LanguagePickerModalProps) {
  const { t } = useTranslation('settings');
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.title}>{t('languagePickerTitle', 'Dil Seç')}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {SUPPORTED_LANGUAGES.map((code) => {
            const meta = LANGUAGE_META[code] ?? { label: code.toUpperCase(), flag: '🌐' };
            const isSelected = currentLanguage === code;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => {
                  onSelect(code);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.flag}>{meta.flag}</Text>
                <Text style={styles.label}>{meta.label}</Text>
                {isSelected && <Check size={18} color="#3b82f6" strokeWidth={2.5} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
  },
  rowSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  flag: {
    fontSize: 20,
  },
  label: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
});

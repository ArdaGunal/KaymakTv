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
const LANGUAGE_META: Record<string, { label: string; flag: string; iso2?: string }> = {
  tr: { label: 'Türkçe', flag: '🇹🇷', iso2: 'TR' },
  en: { label: 'English', flag: '🇬🇧', iso2: 'GB' },
};

// Web'de emoji bayrakları macOS/Windows kombinasyonlarında render edilemiyor.
// Flagcdn.com, CDN tabanlı ücretsiz ve her tarayıcıda çalışan SVG bayrakları sağlıyor.
// Mobilde native emoji render kullanılmaya devam eder.
function FlagImage({ iso2, emoji }: { iso2?: string; emoji: string }) {
  if (Platform.OS === 'web' && iso2) {
    // @ts-ignore — web-only: RN'de img elemanı yok ama web bundle'da düzgün render olur
    return (
      <img
        src={`https://flagcdn.com/32x24/${iso2.toLowerCase()}.png`}
        width={28}
        height={20}
        alt={iso2}
        style={{ borderRadius: 3, objectFit: 'cover' }}
      />
    );
  }
  return <Text style={styles.flag}>{emoji}</Text>;
}

export default function LanguagePickerModal({
  visible,
  currentLanguage,
  onSelect,
  onClose,
}: LanguagePickerModalProps) {
  const { t } = useTranslation('settings');
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={[styles.overlay, isWeb && styles.overlayWeb]}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />

        {/* Web: Merkezi dialog kutusu | Mobil: Alt çekmece (bottom sheet) */}
        <View style={[
          styles.sheet,
          isWeb ? styles.sheetWeb : { paddingBottom: Math.max(insets.bottom, 20) }
        ]}>
          {/* Mobil'e özgü kaydırma çubukçuğu */}
          {!isWeb && <View style={styles.grabber} />}

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
                <FlagImage iso2={meta.iso2} emoji={meta.flag} />
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
  // Web'de ortada küçük bir dialog kutusu gibi görünür
  overlayWeb: {
    justifyContent: 'center',
    alignItems: 'center',
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
  // Web'de tam dialog kutusu
  sheetWeb: {
    width: 360,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
    // Bottom sheet radius'unu override et
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...({ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' } as any),
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

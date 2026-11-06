import { Check, X } from '../icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import OrtaPencere from '../modals/OrtaPencere';

import { DILLER } from '../../locales/diller';

interface LanguagePickerModalProps {
  visible: boolean;
  currentLanguage: string;
  onSelect: (lng: string) => void;
  onClose: () => void;
}

// Diller, adları ve bayrakları dil kaydından (`locales/diller.json`) gelir —
// yeni dil eklemek için bu dosyaya dokunmak gerekmez.

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

  // 2.6.8 MENU-01: telefonda da ekranın ortasında (eskiden yalnız web'de).
  return (
    <OrtaPencere visible={visible} onClose={onClose} maxWidth={360}>
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

      {DILLER.map((dil) => {
        const code = dil.kod;
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
            <FlagImage iso2={dil.bayrakUlke} emoji={dil.bayrak} />
            <Text style={styles.label}>{dil.ad}</Text>
            {isSelected && <Check size={18} color="#3b82f6" strokeWidth={2.5} />}
          </TouchableOpacity>
        );
      })}
    </OrtaPencere>
  );
}

const styles = StyleSheet.create({
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

import React from 'react';
import { View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../locales/languageDetector';

interface LanguageMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Giriş/karşılama ekranının sağ üstündeki dil seçicisi (küçük, ortalanmış
 * menü). Ayarlar içindeki `LanguagePickerModal`'dan görsel olarak AYRIDIR
 * (o bir bottom-sheet); bilinçli olarak birleştirilmediler çünkü ikisi farklı
 * bağlamlarda farklı bir yerleşim bekliyor.
 *
 * Diller `SUPPORTED_LANGUAGES`'ten okunur — eskiden 'tr' ve 'en' bu ekranda
 * ELLE kodlanmıştı, yani üçüncü bir dil eklendiğinde burada sessizce eksik
 * kalırdı.
 */
const LANGUAGE_LABEL_KEYS: Record<string, string> = {
  tr: 'turkish',
  en: 'english',
};

export default function LanguageMenuModal({ visible, onClose }: LanguageMenuModalProps) {
  const { t, i18n } = useTranslation('settings');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          {/* Menünün kendisine dokunmak kapatmamalı. */}
          <TouchableWithoutFeedback>
            <View style={styles.menu}>
              <Text style={styles.title}>{t('language')}</Text>

              {SUPPORTED_LANGUAGES.map((code) => {
                const isActive = i18n.language === code;
                const labelKey = LANGUAGE_LABEL_KEYS[code];
                return (
                  <TouchableOpacity
                    key={code}
                    style={[styles.item, isActive && styles.itemActive]}
                    onPress={() => {
                      i18n.changeLanguage(code);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.itemText, isActive && styles.itemTextActive]}>
                      {labelKey ? t(labelKey) : code.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    width: 250,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '600',
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemActive: {
    backgroundColor: '#3b82f6',
  },
  itemText: {
    color: '#cbd5e1',
    fontSize: 16,
  },
  itemTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

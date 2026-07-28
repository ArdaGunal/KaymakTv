import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface LegalTermsModalProps {
  visible: boolean;
  onClose: () => void;
}

interface LegalSection {
  heading: string;
  text: string;
}

/**
 * Kullanım Koşulları metnini gösteren modal. İçerik tamamen `legal` i18n
 * namespace'inden (`legal:title` + `legal:sections` dizisi) gelir — yeni bir
 * madde eklemek için yalnızca locale dosyaları güncellenir, burası değişmez.
 *
 * Ayrı bir bileşene çıkarıldı: aynı blok bir dönem hem `(public)/settings.tsx`
 * hem `TraktAccountSection.tsx` içinde KOPYALANMIŞTI ve `(public)/settings.tsx`
 * projenin 400 satır sınırını aşmıştı.
 */
export default function LegalTermsModal({ visible, onClose }: LegalTermsModalProps) {
  const { t } = useTranslation(['legal', 'common']);
  const sections = t('legal:sections', { returnObjects: true }) as LegalSection[];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>{t('legal:title')}</Text>
          <ScrollView style={styles.scroll}>
            {(Array.isArray(sections) ? sections : []).map((section, index) => (
              <View key={index} style={styles.section}>
                <Text style={styles.heading}>{section.heading}</Text>
                <Text style={styles.body}>{section.text}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeButtonText}>{t('common:close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  panel: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 560,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    color: '#e2e8f0',
    fontSize: 18,
    marginBottom: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scroll: {
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  heading: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  body: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22,
  },
  closeButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

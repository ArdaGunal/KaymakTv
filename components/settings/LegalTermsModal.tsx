import { nativeColor } from '../../constants/mobilePalette';
import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TUM_YASAL_BELGELER, YASAL_BELGELER, bolumleriCoz, type YasalBelge } from '../../utils/yasalBelge';

interface LegalTermsModalProps {
  visible: boolean;
  onClose: () => void;
  /** Gösterilecek belgeler; verilmezse üçü (`TUM_YASAL_BELGELER`). Giriş ekranı her
   *  bağlantıda tek belge açar (M611: belgeler ayrı ayrı tıklanabilir olmalı). */
  belgeler?: YasalBelge[];
}

/**
 * Yasal belgeleri uygulama içinde gösteren pencere: Kullanım Koşulları, Topluluk
 * Kuralları, Gizlilik Politikası. Pencere sayfa değiştirmez; giriş ekranındaki kutu
 * işareti ve bekleyen giriş isteği yerinde kalır. İçerik `legal` çeviri ad alanında;
 * harita `utils/yasalBelge.ts`.
 *
 * Ayrı bir bileşene çıkarıldı: aynı blok bir dönem hem `(public)/settings.tsx`
 * hem `TraktAccountSection.tsx` içinde KOPYALANMIŞTI ve `(public)/settings.tsx`
 * projenin 400 satır sınırını aşmıştı.
 */
export default function LegalTermsModal({ visible, onClose, belgeler = TUM_YASAL_BELGELER }: LegalTermsModalProps) {
  const { t } = useTranslation(['legal', 'common']);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <ScrollView style={styles.scroll}>
            {belgeler.map((belge) => (
              <View key={belge} style={styles.document}>
                <Text style={styles.title}>{t(YASAL_BELGELER[belge].baslik)}</Text>
                {bolumleriCoz(t(YASAL_BELGELER[belge].bolumler, { returnObjects: true })).map((section, index) => (
                  <View key={index} style={styles.section}>
                    <Text style={styles.heading}>{section.heading}</Text>
                    <Text style={styles.body}>{section.text}</Text>
                  </View>
                ))}
              </View>
            ))}
            <Text style={styles.updated}>{t('legal:updatedAt')}</Text>
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
    backgroundColor: nativeColor('raised', '#1e293b'),
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 560,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: nativeColor('border', '#334155'),
  },
  title: {
    color: nativeColor('text', '#e2e8f0'),
    fontSize: 18,
    marginBottom: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scroll: {
    marginBottom: 16,
  },
  document: {
    marginBottom: 12,
  },
  updated: {
    color: nativeColor('muted', '#94a3b8'),
    fontSize: 12,
    marginBottom: 8,
  },
  section: {
    marginBottom: 16,
  },
  heading: {
    color: nativeColor('text', '#e2e8f0'),
    fontSize: 14,
    lineHeight: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  body: {
    color: nativeColor('body', '#cbd5e1'),
    fontSize: 14,
    lineHeight: 22,
  },
  closeButton: {
    backgroundColor: nativeColor('primary', '#3b82f6'),
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: nativeColor('text', '#ffffff'),
    fontWeight: 'bold',
    fontSize: 16,
  },
});

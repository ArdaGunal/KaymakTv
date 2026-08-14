import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';

interface NoteFullTextModalProps {
  visible: boolean;
  text: string;
  onClose: () => void;
}

/**
 * Uzun bir alıntı/gönderi metninin tamamını gösteren küçük, salt-okunur
 * modal — kullanıcının isteği: "tüm sayfayı kaplamayacak şekilde" (bkz.
 * FeedActivityNote.tsx'teki "Devamını Gör" tetikleyicisi). Kartların
 * kendisi 4 satırla sınırlı kalır, uzun metin akışı yer kaplamaz; okumak
 * isteyen bu modalı açar.
 */
export default function NoteFullTextModal({ visible, text, onClose }: NoteFullTextModalProps) {
  const { t } = useTranslation('feed');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent={Platform.OS === 'android'}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('fullTextTitle', 'Tam Metin')}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.text}>{text}</Text>
              </ScrollView>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '700',
  },
  scroll: {
    flexGrow: 0,
  },
  text: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
});

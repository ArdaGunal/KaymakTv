import React from 'react';
import { View, Text, Modal, TouchableWithoutFeedback, StyleSheet, Platform, Pressable } from 'react-native';
import StarSlider from './StarSlider';
import { X } from './icons';
import { MOBILE_PALETTE, nativeColor } from '../constants/mobilePalette';
import { useTranslation } from 'react-i18next';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  myRating: number | null | undefined;
  onRate: (val: number) => Promise<void>;
  onRemoveRating?: () => Promise<void>;
}

export default function RatingModal({
  visible,
  onClose,
  title,
  myRating,
  onRate,
  onRemoveRating
}: RatingModalProps) {
  const { t } = useTranslation('media');
  const native = Platform.OS !== 'web';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalContent, native && styles.nativeContent]}>
              <View style={[styles.header, native && styles.nativeHeader]}>
                <Text style={[styles.title, native && styles.nativeTitle]}>{title}</Text>
                {native && <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
                  <X size={21} color={MOBILE_PALETTE.muted} />
                </Pressable>}
              </View>
              <StarSlider 
                initialRating={myRating} 
                onRate={onRate} 
                onRemove={myRating && onRemoveRating ? onRemoveRating : undefined}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: nativeColor('background', '#0B1120'),
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  nativeContent: { backgroundColor: MOBILE_PALETTE.surface, borderWidth: 1, borderColor: MOBILE_PALETTE.border, width: '100%', maxWidth: 360, alignSelf: 'center', alignItems: 'stretch' },
  header: { alignItems: 'center' },
  nativeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  nativeTitle: { color: MOBILE_PALETTE.text, marginBottom: 18, flexShrink: 1 },
});

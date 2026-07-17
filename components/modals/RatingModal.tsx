import React from 'react';
import { Modal, Pressable, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import StarSlider from '../StarSlider';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  userRating?: number | null;
  onRate: (rating: number) => void;
  onRemoveRating?: () => void;
}

export default function RatingModal({
  visible,
  onClose,
  userRating,
  onRate,
  onRemoveRating,
}: RatingModalProps) {
  const { t } = useTranslation(['media']);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={[styles.modalOverlay, styles.centeredOverlay]} onPress={onClose}>
        <Pressable style={styles.modalContentWrapper} onPress={(e) => e.stopPropagation()}>
          <BlurView intensity={90} tint="dark" style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('giveRating')}</Text>
            <StarSlider 
              initialRating={(userRating !== undefined && userRating !== null) ? userRating : 0} 
              onRate={(val) => { 
                onRate(val);
                onClose();
              }}
              onRemove={(userRating !== undefined && userRating !== null && onRemoveRating) ? () => { 
                onRemoveRating();
                onClose();
              } : undefined}
            />
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  centeredOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContentWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 360,
  },
  modalContent: {
    backgroundColor: 'rgba(23, 32, 51, 0.7)',
    padding: 24,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
});

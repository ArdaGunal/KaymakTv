import React from 'react';
import { View, Text, Modal, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import StarSlider from './StarSlider';
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.title}>{title}</Text>
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
    backgroundColor: '#0B1120',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});

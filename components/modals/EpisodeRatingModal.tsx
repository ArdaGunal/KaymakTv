import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { BlurView } from 'expo-blur';
import StarSlider from '../StarSlider';
import { useTranslation } from 'react-i18next';

interface EpisodeRatingModalProps {
  visible: boolean;
  onClose: () => void;
  initialRating?: number | null;
  onRate: (rating: number) => void;
  onRemove?: () => void;
}

export default function EpisodeRatingModal({
  visible,
  onClose,
  initialRating,
  onRate,
  onRemove
}: EpisodeRatingModalProps) {
  const { t } = useTranslation(['media']);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.modalOverlay, styles.centeredOverlay]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContentWrapper}>
              <BlurView intensity={90} tint="dark" style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('rateEpisode')}</Text>
                <StarSlider 
                  initialRating={initialRating ?? 0} 
                  onRate={onRate} 
                  onRemove={onRemove}
                />
              </BlurView>
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

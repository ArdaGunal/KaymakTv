import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableWithoutFeedback, Platform, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import StarSlider from '../StarSlider';
import { useTranslation } from 'react-i18next';
import { X } from '../icons';
import { MOBILE_PALETTE, nativeColor } from '../../constants/mobilePalette';

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
  const native = Platform.OS !== 'web';
  const content = <>
    <View style={[styles.header, native && styles.nativeHeader]}>
      <Text style={[styles.modalTitle, native && styles.nativeTitle]}>{t('rateEpisode')}</Text>
      {native && <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
        <X size={21} color={MOBILE_PALETTE.muted} />
      </Pressable>}
    </View>
    <StarSlider initialRating={initialRating ?? 0} onRate={onRate} onRemove={onRemove} />
  </>;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.modalOverlay, styles.centeredOverlay]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalContentWrapper, native && styles.nativeWrapper]}>
              {native ? <View style={[styles.modalContent, styles.nativeContent]}>{content}</View> :
                <BlurView intensity={90} tint="dark" style={styles.modalContent}>{content}</BlurView>}
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
  nativeWrapper: { borderRadius: 20, borderWidth: 1, borderColor: MOBILE_PALETTE.border },
  nativeContent: { backgroundColor: MOBILE_PALETTE.surface, padding: 22 },
  header: { marginBottom: 24 },
  nativeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: {
    color: nativeColor('text', '#ffffff'),
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  nativeTitle: { color: MOBILE_PALETTE.text, textAlign: 'left', marginBottom: 0 },
});

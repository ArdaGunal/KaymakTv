import React from 'react';
import { Modal, Pressable, Text, StyleSheet, Platform, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { X } from '../icons';
import { MOBILE_PALETTE, nativeColor } from '../../constants/mobilePalette';
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
  const native = Platform.OS !== 'web';

  const content = (
    <>
      <View style={[styles.header, native && styles.nativeHeader]}>
        <Text style={[styles.modalTitle, native && styles.nativeTitle]}>{t('giveRating')}</Text>
        {native && <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
          <X size={21} color={MOBILE_PALETTE.muted} />
        </Pressable>}
      </View>
      <StarSlider
        initialRating={userRating ?? 0}
        onRate={(val) => { onRate(val); onClose(); }}
        onRemove={userRating != null && onRemoveRating ? () => { onRemoveRating(); onClose(); } : undefined}
      />
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalOverlay, styles.centeredOverlay]} onPress={onClose}>
        <Pressable style={[styles.modalContentWrapper, native && styles.nativeWrapper]} onPress={(e) => e.stopPropagation()}>
          {native ? <View style={[styles.modalContent, styles.nativeContent]}>{content}</View> :
            <BlurView intensity={90} tint="dark" style={styles.modalContent}>{content}</BlurView>}
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

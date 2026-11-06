import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTranslation } from 'react-i18next';
import StarSlider from '../StarSlider';
import { Check } from '../icons';
import { notify } from '../../utils/confirmDialog';
import { gorunenBaslik } from '../../utils/gorunenBaslik';
import { useLibraryStore } from '../../store/useLibraryStore';

interface CelebrationOverlayProps {
  finishedShow: { name: string; id: number };
  /** Puanı kaydeder (1–10); düşerse FIRLATIR — panel hatayı gösterir, yeniden denenebilir. */
  onRate: (val: number) => Promise<void>;
  onClose: () => void;
}

/**
 * «Diziyi bitirdin» paneli — mobil ve masaüstü web TEK bileşen (2.6.8 KUTLAMA-02).
 * Sade kart: onay işareti, dizi adı, yıldızlar panelin İÇİNDE (ikinci pencere yok),
 * «Kapat». Hafif konfeti (80 parçacık, yalnız native). Dışarı dokunma ve Android
 * geri tuşu kapatır. Ne zaman ÇIKMADIĞI `EpisodeCheckButton` + `utils/duyurulanBolum.ts`'te.
 */
export default function CelebrationOverlay({ finishedShow, onRate, onClose }: CelebrationOverlayProps) {
  const { t, i18n } = useTranslation(['media', 'common']);
  const { width } = useWindowDimensions();
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const mesgul = useRef(false);
  // Kart adı büyük harfli gelir (takip kartı); cümle içinde normal yazım (BASLIK kuralı).
  const dizi = useLibraryStore((s) => s.watchedShows.find((w: any) => w?.show?.ids?.trakt === finishedShow.id)?.show);
  const ad = (dizi && gorunenBaslik(dizi, i18n.language)) || finishedShow.name;

  const puanla = async (val: number) => {
    if (mesgul.current) return;
    mesgul.current = true;
    setKaydediliyor(true);
    try {
      await onRate(val);
      onClose();
    } catch {
      notify(t('common:error'), t('common:ratingSaveError'));
      mesgul.current = false;
      setKaydediliyor(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('close')} />
        <View style={[styles.card, { width: Math.min(360, width - 32) }]}>
          <View style={styles.badge}>
            <Check size={28} color="#60A5FA" strokeWidth={3} />
          </View>
          <Text style={styles.title}>{t('congrats')}</Text>
          <Text style={styles.subtitle} numberOfLines={3}>{t('showFinishedLine', { name: ad })}</Text>

          <View style={styles.divider} />

          <Text style={styles.rateLabel}>{t('howWasShow')}</Text>
          {kaydediliyor ? (
            <ActivityIndicator size="small" color="#60A5FA" style={styles.saving} />
          ) : (
            <StarSlider onRate={puanla} />
          )}

          <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.closePressed]}>
            <Text style={styles.closeText}>{t('close')}</Text>
          </Pressable>
        </View>
        {Platform.OS !== 'web' && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ConfettiCannon count={80} origin={{ x: width / 2, y: -20 }} fallSpeed={2600} fadeOut />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(2, 6, 23, 0.72)' },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 12,
    alignItems: 'center',
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 21, color: '#94A3B8', textAlign: 'center' },
  divider: { alignSelf: 'stretch', height: 1, backgroundColor: '#1F2937', marginVertical: 20 },
  rateLabel: { fontSize: 14, fontWeight: '600', color: '#E2E8F0', marginBottom: 4 },
  saving: { marginVertical: 48 },
  closeButton: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 999 },
  closePressed: { backgroundColor: 'rgba(148, 163, 184, 0.12)' },
  closeText: { fontSize: 15, fontWeight: '600', color: '#94A3B8' },
});

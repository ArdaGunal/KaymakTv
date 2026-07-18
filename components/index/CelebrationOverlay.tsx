import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import InlineRater from '../InlineRater';

const { width } = Dimensions.get('window');

interface CelebrationOverlayProps {
  finishedShow: { name: string; id: number };
  onRate: (val: number) => Promise<void> | void;
  onClose: () => void;
  howWasShowLabel: string;
  congratsLabel: string;
  showFinishedLabel: string;
  closeLabel: string;
}

export default function CelebrationOverlay({
  finishedShow,
  onRate,
  onClose,
  howWasShowLabel,
  congratsLabel,
  showFinishedLabel,
  closeLabel,
}: CelebrationOverlayProps) {
  return (
    <View style={styles.confettiOverlay}>
      {Platform.OS !== 'web' && (
        <ConfettiCannon count={200} origin={{ x: width / 2, y: -20 }} fallSpeed={3000} fadeOut={true} />
      )}
      <View style={styles.congratsContainer}>
        <Text style={styles.congratsTitle}>{congratsLabel}</Text>
        <Text style={styles.congratsText}>{finishedShow.name} {showFinishedLabel}</Text>

        <View style={styles.ratingBox}>
          <Text style={styles.ratingBoxTitle}>{howWasShowLabel}</Text>
          <InlineRater
            onRate={async (val) => {
              await onRate(val);
              setTimeout(onClose, 800);
            }}
          />
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>{closeLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  confettiOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  congratsContainer: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 24, borderRadius: 16, alignItems: 'center' },
  congratsTitle: { fontSize: 28, fontWeight: 'bold', color: '#3B82F6', marginBottom: 8 },
  congratsText: { fontSize: 16, color: '#ffffff', textAlign: 'center' },
  ratingBox: { marginTop: 24, padding: 16, backgroundColor: '#262626', borderRadius: 8, alignItems: 'center' },
  ratingBoxTitle: { color: '#fff', fontWeight: 'bold', marginBottom: 8 },
  closeButton: { marginTop: 16, padding: 8 },
  closeButtonText: { color: '#a3a3a3' },
});

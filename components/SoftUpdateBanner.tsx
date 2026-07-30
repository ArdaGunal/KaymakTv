import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSoftUpdate } from '../hooks/useSoftUpdate';

export default function SoftUpdateBanner() {
  if (Platform.OS === 'web') return null;

  const { showBanner, onSnooze, onUpdate } = useSoftUpdate();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');
  
  const translateY = useSharedValue(-150);

  useEffect(() => {
    if (showBanner) {
      translateY.value = withSpring(insets.top + 10, { damping: 14, stiffness: 90 });
    } else {
      translateY.value = withTiming(-150, { duration: 300 });
    }
  }, [showBanner, insets.top]);

  const handleSnooze = () => {
    // Animasyonla yukarı kaydır, bitince onSnooze çağır
    translateY.value = withTiming(-150, { duration: 300 }, () => {
      runOnJS(onSnooze)();
    });
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  // Eğer banner gizliyse ve animasyon bittiyse (yukarıdaysa) tamamen yok et
  if (!showBanner && translateY.value === -150) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={styles.message}>
        {t('softUpdateMessage', 'Yeni sürüm mevcut, lütfen uygulamayı güncelleyin.')}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.snoozeButton} onPress={handleSnooze}>
          <Text style={styles.snoozeText}>{t('remindLater', 'Daha Sonra Hatırlat')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.updateButton} onPress={onUpdate}>
          <Text style={styles.updateText}>{t('updateNow', 'Şimdi Güncelle')}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  message: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  snoozeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  snoozeText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  updateButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  updateText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});

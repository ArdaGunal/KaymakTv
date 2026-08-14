import React, { memo, useEffect, useRef } from 'react';
import { Animated, Text, View, Switch, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface LiveModeToggleProps {
  enabled: boolean;
  onToggle: (value: boolean) => void;
}

/** Açıkken panel arka planda birkaç saniyede bir sessizce (RefreshControl
 * döngüsü GÖSTERMEDEN — bkz. `silentRefresh`, usePerfLog.ts) verileri
 * tazeler. Anahtarın kendisi burada YOK — zamanlayıcı `dev-panel.tsx`'te
 * (tek bir `setInterval`, ekran kapanınca temizlenir); bu bileşen SAF bir
 * gösterge + Switch'tir. */
const LiveModeToggle = memo(({ enabled, onToggle }: LiveModeToggleProps) => {
  const { t } = useTranslation('settings');
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, pulse]);

  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        <Animated.View style={[styles.dot, { opacity: enabled ? pulse : 0.3, backgroundColor: enabled ? '#22c55e' : '#475569' }]} />
        <Text style={styles.label}>{t('devPanelLiveMode', 'Canlı İzleme')}</Text>
        <Text style={styles.hint}>{t('devPanelLiveModeHint', '(4sn\'de bir tazeler)')}</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ false: '#334155', true: '#3b82f6' }}
        thumbColor="#f8fafc"
      />
    </View>
  );
});

export default LiveModeToggle;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    color: '#64748b',
    fontSize: 11,
  },
});

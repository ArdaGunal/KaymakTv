import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { BAR_MAX_MS } from '../../utils/perfLog';

interface DurationBarProps {
  durationMs: number;
  color: string;
}

/** İnce bir "ne kadar sürdü" çubuğu — `BAR_MAX_MS`e (sabit tavan, bkz.
 * utils/perfLog.ts) oranla dolar. Listenin o anki en yavaş kaydına göre
 * BİLİNÇLİ OLARAK ölçeklenmez: aksi halde tek bir uç değer diğer tüm
 * çubukları görünmez kılar ve liste her değiştiğinde çubukların anlamı kayardı. */
const DurationBar = memo(({ durationMs, color }: DurationBarProps) => {
  const widthPct = Math.max(4, Math.min(100, (durationMs / BAR_MAX_MS) * 100));

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${widthPct}%`, backgroundColor: color }]} />
    </View>
  );
});

export default DurationBar;

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/** C5 · Akışın zaman ayracı: küçük etiket + ince çizgi (sade; büyük başlık DEĞİL). */
export default function DaySeparator({ label }: { label: string }) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 10, paddingHorizontal: 2 },
  label: { color: '#64748b', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#22304A' },
});

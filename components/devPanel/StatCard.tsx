import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatCardProps {
  value: number;
  label: string;
  /** Sıfırdan farklıyken vurgulanacak renk (ör. hata kartında kırmızı) —
   * değer 0 iken her zaman nötr gri kalır, boş bir istatistik dikkat çekmemeli. */
  accentColor?: string;
}

const StatCard = memo(({ value, label, accentColor }: StatCardProps) => (
  <View style={styles.card}>
    <Text style={[styles.value, value > 0 && accentColor ? { color: accentColor } : null]}>
      {value}
    </Text>
    <Text style={styles.label}>{label}</Text>
  </View>
));

export default StatCard;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: '800',
  },
  label: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

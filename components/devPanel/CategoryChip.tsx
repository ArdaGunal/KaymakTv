import React, { memo } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';

interface CategoryChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

// Kategori adları (network/startup) BİLİNÇLİ OLARAK çevrilmez — bir "dev
// jargonu" etiketi olarak kalır (bkz. dev-panel.tsx'teki not).
const CategoryChip = memo(({ label, active, onPress }: CategoryChipProps) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
  </TouchableOpacity>
));

export default CategoryChip;

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#3b82f6',
  },
  text: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  textActive: {
    color: '#ffffff',
  },
});

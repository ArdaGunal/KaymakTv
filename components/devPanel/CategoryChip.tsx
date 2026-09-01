import React, { memo } from 'react';
import { Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

interface CategoryChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(27, 32, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderColor: '#3b82f6',
  },
  text: {
    color: '#8c90a0',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textActive: {
    color: '#60a5fa',
    fontWeight: '700',
  },
});

import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';

interface StatCardProps {
  value: number;
  label: string;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const StatCard = memo(({ value, label, accentColor, style }: StatCardProps) => {
  const isActive = value > 0 && !!accentColor;

  return (
    <View
      style={[
        styles.card,
        isActive && {
          borderColor: hexToRgba(accentColor!, 0.4),
          backgroundColor: hexToRgba(accentColor!, 0.08),
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.value,
          isActive ? { color: accentColor } : styles.valueNeutral,
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.label,
          isActive && { color: hexToRgba(accentColor!, 0.9) },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
});

export default StatCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(27, 32, 42, 0.75)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 48,
  },
  value: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: -0.3,
  },
  valueNeutral: {
    color: '#f1f5f9',
  },
  label: {
    color: '#8c90a0',
    fontSize: 10.5,
    fontWeight: '600',
    textAlign: 'center',
  },
});

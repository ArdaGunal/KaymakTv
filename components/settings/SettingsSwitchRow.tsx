import React from 'react';
import { View, Text, StyleSheet, Switch, ActivityIndicator } from 'react-native';

interface SettingsSwitchRowProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  tintColor?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export default function SettingsSwitchRow({
  icon,
  label,
  hint,
  tintColor,
  value,
  onValueChange,
  disabled = false,
  isLoading = false,
}: SettingsSwitchRowProps) {
  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <View style={[styles.iconSlot, tintColor && { backgroundColor: tintColor + '22' }]}>{icon}</View>

      <View style={styles.textWrap}>
        <Text style={[styles.label, tintColor && { color: tintColor }]} numberOfLines={1}>
          {label}
        </Text>
        {hint && (
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color="#3b82f6" />
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: '#334155', true: '#3b82f6' }}
          thumbColor="#f1f5f9"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 14,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  iconSlot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '500',
  },
  hint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
});

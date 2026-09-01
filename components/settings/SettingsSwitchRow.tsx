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
      <View
        style={[
          styles.iconSlot,
          { backgroundColor: tintColor ? tintColor + '18' : 'rgba(92, 140, 245, 0.12)' },
        ]}
      >
        {icon}
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color="#5c8cf5" />
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: '#263044', true: '#3b82f6' }}
          thumbColor="#ffffff"
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
    paddingVertical: 10,
    gap: 14,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  iconSlot: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  hint: {
    color: '#8c90a0',
    fontSize: 12.5,
    lineHeight: 17,
  },
});

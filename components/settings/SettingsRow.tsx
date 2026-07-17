import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  tintColor?: string;
  disabled?: boolean;
}

export default function SettingsRow({
  icon,
  label,
  value,
  onPress,
  showChevron = false,
  tintColor,
  disabled = false,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={disabled || !onPress}
    >
      <View style={[styles.iconSlot, tintColor && { backgroundColor: tintColor + '22' }]}>
        {icon}
      </View>

      <Text style={[styles.label, tintColor && { color: tintColor }]} numberOfLines={1}>
        {label}
      </Text>

      <View style={styles.trailing}>
        {value ? (
          <Text style={styles.value}>{value}</Text>
        ) : null}
        {showChevron && (
          <ChevronRight size={16} color={tintColor ?? '#475569'} />
        )}
      </View>
    </TouchableOpacity>
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
  label: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '500',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  value: {
    color: '#64748b',
    fontSize: 14,
  },
});

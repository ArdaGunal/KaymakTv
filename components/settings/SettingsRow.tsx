import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from '../icons';

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  tintColor?: string;
  isDestructive?: boolean;
  disabled?: boolean;
}

export default function SettingsRow({
  icon,
  label,
  description,
  value,
  onPress,
  showChevron = false,
  tintColor,
  isDestructive = false,
  disabled = false,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={disabled || !onPress}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.iconSlot,
          {
            backgroundColor: isDestructive
              ? 'rgba(248, 113, 113, 0.14)'
              : tintColor
              ? tintColor + '18'
              : 'rgba(92, 140, 245, 0.12)',
          },
        ]}
      >
        {icon}
      </View>

      <View style={styles.textContainer}>
        <Text
          style={[
            styles.label,
            isDestructive ? styles.destructiveText : null,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        {showChevron && <ChevronRight size={18} color="#64748b" strokeWidth={2} />}
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
    paddingVertical: 10,
    gap: 14,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  iconSlot: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textContainer: {
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
  destructiveText: {
    color: '#f87171',
  },
  description: {
    color: '#8c90a0',
    fontSize: 12.5,
    lineHeight: 17,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  value: {
    color: '#8c90a0',
    fontSize: 14,
    fontWeight: '500',
  },
});

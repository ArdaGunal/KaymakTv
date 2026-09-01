import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { ChevronRight } from '../icons';

export interface SettingItemProps {
  icon: React.ReactNode;
  iconColor?: string;
  title: string;
  description?: string;
  type?: 'navigation' | 'switch' | 'value' | 'button';
  value?: string;
  switchValue?: boolean;
  onSwitchChange?: (val: boolean) => void;
  onPress?: () => void;
  isDestructive?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  isLast?: boolean;
}

export function SettingItem({
  icon,
  iconColor = '#5c8cf5',
  title,
  description,
  type = 'navigation',
  value,
  switchValue = false,
  onSwitchChange,
  onPress,
  isDestructive = false,
  disabled = false,
  isLoading = false,
  isLast = false,
}: SettingItemProps) {
  const isPressable = (type === 'navigation' || type === 'button' || type === 'value') && !!onPress;

  const content = (
    <View style={[styles.row, disabled && styles.disabled]}>
      {/* Sol Blok: İkon Rozeti + Başlık & Açıklama */}
      <View style={styles.leftBlock}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isDestructive
                ? 'rgba(248, 113, 113, 0.14)'
                : `${iconColor}18`,
            },
          ]}
        >
          {icon}
        </View>

        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              isDestructive && styles.destructiveText,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {description ? (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Sağ Blok: Aksiyon Türüne Göre İçerik */}
      <View style={styles.rightBlock}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#5c8cf5" />
        ) : type === 'switch' ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            disabled={disabled}
            trackColor={{ false: '#263044', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        ) : (
          <View style={styles.valueRow}>
            {value ? <Text style={styles.valueText}>{value}</Text> : null}
            {type === 'navigation' && <ChevronRight size={18} color="#64748b" strokeWidth={2} />}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View>
      {isPressable ? (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          disabled={disabled}
          accessibilityRole="button"
        >
          {content}
        </TouchableOpacity>
      ) : (
        content
      )}
      {!isLast && <View style={styles.divider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  disabled: {
    opacity: 0.45,
  },
  leftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  iconContainer: {
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
  title: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  description: {
    color: '#8c90a0',
    fontSize: 12.5,
    lineHeight: 17,
  },
  destructiveText: {
    color: '#f87171',
  },
  rightBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valueText: {
    color: '#8c90a0',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 66,
    marginRight: 0,
  },
});

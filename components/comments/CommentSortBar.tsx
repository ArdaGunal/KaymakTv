import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Flame, Clock, History, LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { CommentSort } from '../../hooks/useComments';

interface CommentSortBarProps {
  value: CommentSort;
  onChange: (sort: CommentSort) => void;
}

const OPTIONS: ReadonlyArray<{ key: CommentSort; Icon: LucideIcon; labelKey: string }> = [
  { key: 'likes', Icon: Flame, labelKey: 'sortMostLiked' },
  { key: 'newest', Icon: Clock, labelKey: 'sortNewest' },
  { key: 'oldest', Icon: History, labelKey: 'sortOldest' },
];

// Trakt'ın `/comments/{sort}` uç noktası bu üç değeri destekliyor
// (`services/api/comments.ts` → `getMediaComments`). Sıralama tek seçimli
// olduğu (aynı anda yalnızca biri aktif) için `LibraryFilterModal`'daki
// çoklu-seçim + modal deseni yerine tek satırlık, anlık tepkili bir chip
// grubu tercih edildi — web ve mobilde aynı bileşen, ek Platform dallanması
// gerekmiyor.
export default function CommentSortBar({ value, onChange }: CommentSortBarProps) {
  const { t } = useTranslation('common');

  return (
    <View style={styles.row}>
      {OPTIONS.map(({ key, Icon, labelKey }) => {
        const active = value === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(key)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Icon size={13} color={active ? '#04121f' : '#94a3b8'} />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(labelKey)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  chipActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#04121f',
  },
});

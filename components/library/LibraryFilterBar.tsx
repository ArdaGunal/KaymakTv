import React, { memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';

interface LibraryFilterBarProps {
  value: string;
  onChangeText: (value: string) => void;
  onClear: () => void;
  onOpenFilters: () => void;
  /** Uygulanmış kategori sayısı — 0'dan büyükse butonda rozet gösterilir. */
  activeFilterCount: number;
  placeholder: string;
  /** "Toplam: 136 Diziler" ya da süzme etkinken "136 dizide 12 sonuç". */
  caption: string;
  filterLabel: string;
  /** Geniş ekran (web/masaüstü) yerleşimi. */
  wide?: boolean;
}

/**
 * Kütüphane listelerinin kompakt üst barı: lokal arama + filtre butonu tek satırda,
 * altında tek satırlık sayaç. Sadece görüntüler — hiçbir süzme mantığı içermez
 * (o `useLibraryFilters` hook'unda) ve medya tipini de bilmez.
 */
function LibraryFilterBar({
  value,
  onChangeText,
  onClear,
  onOpenFilters,
  activeFilterCount,
  placeholder,
  caption,
  filterLabel,
  wide = false,
}: LibraryFilterBarProps) {
  const hasFilters = activeFilterCount > 0;

  return (
    <View style={[styles.container, wide && styles.containerWide]}>
      <View style={styles.row}>
        <View style={[styles.inputWrap, wide && styles.inputWrapWide]}>
          <Search size={wide ? 18 : 16} color="#64748b" />
          <TextInput
            style={[styles.input, wide && styles.inputWide]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#5b6472"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            // Web'de tarayıcının kendi "clear" ikonu bizimkiyle çakışıyordu.
            {...(Platform.OS === 'web' ? ({ type: 'text' } as any) : null)}
          />
          {value.length > 0 ? (
            <TouchableOpacity onPress={onClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.filterButton, wide && styles.filterButtonWide, hasFilters && styles.filterButtonActive]}
          onPress={onOpenFilters}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={filterLabel}
        >
          <SlidersHorizontal size={wide ? 20 : 18} color={hasFilters ? '#0b1120' : '#e2e8f0'} />
          {hasFilters ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
    </View>
  );
}

export default memo(LibraryFilterBar);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#101010',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  containerWide: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#262626',
  },
  inputWrapWide: {
    height: 44,
    maxWidth: 420,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderColor: '#1f2937',
  },
  input: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 14,
    padding: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  inputWide: {
    fontSize: 15,
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#262626',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  filterButtonWide: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderColor: '#1f2937',
  },
  filterButtonActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  badgeText: {
    color: '#e0f2fe',
    fontSize: 10,
    fontWeight: '700',
  },
  caption: {
    marginTop: 8,
    color: '#8b93a1',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});

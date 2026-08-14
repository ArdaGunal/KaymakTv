import React, { memo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

/** Performans ve Hata Günlüğü sekmelerinin PAYLAŞTIĞI arama kutusu — arama
 * durumu (state) her sekmenin KENDİSİNDE tutulur (bkz. PerformanceTab.tsx /
 * ErrorsTab.tsx), bu bileşen SAF bir giriş alanıdır. */
const SearchBar = memo(({ value, onChangeText, placeholder }: SearchBarProps) => (
  <View style={styles.wrapper}>
    <Search size={15} color="#64748b" />
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#64748b"
      autoCorrect={false}
      autoCapitalize="none"
    />
    {value.length > 0 && (
      <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={15} color="#64748b" />
      </TouchableOpacity>
    )}
  </View>
));

export default SearchBar;

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    height: 38,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 13,
    height: '100%',
  },
});

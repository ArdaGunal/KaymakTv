import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export default function SearchBar({ value, onChangeText, placeholder, debounceMs = 500 }: SearchBarProps) {
  const { t } = useTranslation('common');
  const [localValue, setLocalValue] = useState(value);
  const actualPlaceholder = placeholder || t('searchPlaceholder');

  // Parent'tan gelen değer değişirse local state'i güncelle
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Kullanıcı yazdıkça local state'i güncelle ve debounce başlat
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChangeText(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [localValue, onChangeText, debounceMs, value]);

  const handleClear = () => {
    setLocalValue('');
    onChangeText('');
  };

  return (
    <View style={styles.container}>
      <Search color="#9ca3af" size={20} style={styles.icon} />
      <TextInput
        style={styles.input}
        value={localValue}
        onChangeText={setLocalValue}
        placeholder={actualPlaceholder}
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {localValue.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <X color="#9ca3af" size={20} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#2A364F',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginVertical: 12,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
});

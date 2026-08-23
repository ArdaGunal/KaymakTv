import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Search, X } from '../../../components/icons';
import { useTranslation } from 'react-i18next';

interface UserSearchBarProps {
  query: string;
  onChangeQuery: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  isSearching: boolean;
  hasResult: boolean;
}

export default function UserSearchBar({
  query,
  onChangeQuery,
  onSubmit,
  onClear,
  isSearching,
  hasResult,
}: UserSearchBarProps) {
  const { t } = useTranslation('feed');

  return (
    <View style={styles.box}>
      <TouchableOpacity onPress={onSubmit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Search size={18} color="#64748b" />
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={onChangeQuery}
        onSubmitEditing={onSubmit}
        placeholder={t('searchPlaceholder', 'Kullanıcı adı veya Trakt profil linki')}
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {isSearching ? (
        <ActivityIndicator size="small" color="#3b82f6" />
      ) : query.length > 0 || hasResult ? (
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={18} color="#64748b" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 14,
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

export type SearchTabType = 'show' | 'movie';

interface SearchTabsProps {
  activeTab: SearchTabType;
  onTabChange: (tab: SearchTabType) => void;
  style?: StyleProp<ViewStyle>;
}

export default function SearchTabs({ activeTab, onTabChange, style }: SearchTabsProps) {
  const { t } = useTranslation('navigation');
  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'show' && styles.activeTab]}
        onPress={() => onTabChange('show')}
        activeOpacity={0.8}
      >
        <Text style={[styles.tabText, activeTab === 'show' && styles.activeTabText]}>
          {t('shows')}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, activeTab === 'movie' && styles.activeTab]}
        onPress={() => onTabChange('movie')}
        activeOpacity={0.8}
      >
        <Text style={[styles.tabText, activeTab === 'movie' && styles.activeTabText]}>
          {t('movies')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  tabText: {
    color: '#a3a3a3',
    fontWeight: '600',
    fontSize: 13,
  },
  activeTabText: {
    color: '#3B82F6',
  },
});

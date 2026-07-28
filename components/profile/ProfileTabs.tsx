import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

export type ProfileTabKey = 'summary' | 'activity';

interface ProfileTabsProps {
  activeTab: ProfileTabKey;
  onChange: (tab: ProfileTabKey) => void;
}

export default function ProfileTabs({ activeTab, onChange }: ProfileTabsProps) {
  const { t } = useTranslation('media');

  const tabs: { key: ProfileTabKey; label: string }[] = [
    { key: 'summary', label: t('profileSummaryTab', 'Özet') },
    { key: 'activity', label: t('profileActivityTab', 'Aktiviteler') },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.tabBtn}>
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
            <View style={[styles.indicator, isActive && styles.indicatorActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#f1f5f9',
  },
  indicator: {
    marginTop: 10,
    height: 2.5,
    width: '60%',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: '#3b82f6',
  },
});

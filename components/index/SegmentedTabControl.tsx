import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SegmentedTabControlProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  watchlistLabel: string;
  upcomingLabel: string;
}

export default function SegmentedTabControl({ activeTab, onTabChange, watchlistLabel, upcomingLabel }: SegmentedTabControlProps) {
  return (
    <View style={styles.segmentedControlContainer}>
      <TouchableOpacity
        style={[styles.segmentedTab, activeTab === 'izleme' && styles.segmentedTabActive]}
        onPress={() => onTabChange('izleme')}
        activeOpacity={0.8}
      >
        <Text style={[styles.segmentedTabText, activeTab === 'izleme' && styles.segmentedTabTextActive]}>{watchlistLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segmentedTab, activeTab === 'yaklasan' && styles.segmentedTabActive]}
        onPress={() => onTabChange('yaklasan')}
        activeOpacity={0.8}
      >
        <Text style={[styles.segmentedTabText, activeTab === 'yaklasan' && styles.segmentedTabTextActive]}>{upcomingLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentedControlContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 4,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  segmentedTabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // Soft Glass Effect
  },
  segmentedTabText: {
    fontWeight: '600',
    color: '#a3a3a3',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  segmentedTabTextActive: {
    color: '#3B82F6',
    fontWeight: 'bold',
  },
});

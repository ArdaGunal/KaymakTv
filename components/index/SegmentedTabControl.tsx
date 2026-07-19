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
  // Modern segmented control: koyu cam yüzey + ince kenarlık, aktif sekme dolu mavi hap
  segmentedControlContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: '#2563EB',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  segmentedTabText: {
    fontWeight: '600',
    color: '#94a3b8',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  segmentedTabTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

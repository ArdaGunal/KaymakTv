import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import EpisodeCard from '../EpisodeCard';

interface TrendingFallbackListProps {
  data: any[];
  onShowFinished: (showName: string, showId: number) => void;
  insets: EdgeInsets;
  trendLabel: string;
}

export default function TrendingFallbackList({ data, onShowFinished, insets, trendLabel }: TrendingFallbackListProps) {
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <EpisodeCard data={item} onShowFinished={onShowFinished} />}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      style={styles.scrollView}
      initialNumToRender={5}
      maxToRenderPerBatch={5}
      windowSize={3}
      ListHeaderComponent={
        <View style={styles.filterRow}>
          <View style={styles.filterPill}>
            <Text style={styles.filterPillText}>{trendLabel}</Text>
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, paddingHorizontal: 12 },
  scrollContent: { paddingTop: 12 },
  filterRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 },
  filterPill: { backgroundColor: 'rgba(82, 82, 82, 0.5)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 9999 },
  filterPillText: { color: '#ffffff', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
});

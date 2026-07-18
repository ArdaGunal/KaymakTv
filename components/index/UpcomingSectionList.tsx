import React from 'react';
import { View, Text, SectionList, RefreshControl, StyleSheet } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import EpisodeCard from '../EpisodeCard';

interface UpcomingSectionListProps {
  sections: { title: string; data: any[] }[];
  onShowFinished: (showName: string, showId: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
  insets: EdgeInsets;
  emptyLabel: string;
}

export default function UpcomingSectionList({ sections, onShowFinished, refreshing, onRefresh, insets, emptyLabel }: UpcomingSectionListProps) {
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <EpisodeCard data={item} onShowFinished={onShowFinished} />}
      renderSectionHeader={({ section: { title } }) => (
        <Text style={styles.calendarDateHeader}>{title}</Text>
      )}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      stickySectionHeadersEnabled={false}
      initialNumToRender={5}
      maxToRenderPerBatch={5}
      windowSize={3}
      ListEmptyComponent={
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#ffffff"
          colors={['#ffffff']}
          progressBackgroundColor="#262626"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 12 },
  calendarDateHeader: { color: '#a3a3a3', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginTop: 16, marginBottom: 12, marginLeft: 4 },
  emptyText: { color: '#64748b', textAlign: 'center', paddingVertical: 20, fontStyle: 'italic' },
});

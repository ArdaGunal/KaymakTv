import React from 'react';
import { Text, SectionList, RefreshControl, StyleSheet } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import EpisodeCard from '../EpisodeCard';
import { MOBILE_PALETTE } from '../../constants/mobilePalette';

interface UpcomingSectionListProps {
  sections: { title: string; data: any[] }[];
  refreshing: boolean;
  onRefresh: () => void;
  insets: EdgeInsets;
  emptyLabel: string;
}

export default function UpcomingSectionList({ sections, refreshing, onRefresh, insets, emptyLabel }: UpcomingSectionListProps) {
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <EpisodeCard data={item} />}
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
          tintColor={MOBILE_PALETTE.steel}
          colors={[MOBILE_PALETTE.steel]}
          progressBackgroundColor={MOBILE_PALETTE.surface}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 12 },
  calendarDateHeader: { color: MOBILE_PALETTE.muted, fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginTop: 16, marginBottom: 12, marginLeft: 4 },
  emptyText: { color: MOBILE_PALETTE.mutedDeep, textAlign: 'center', paddingVertical: 20, fontStyle: 'italic' },
});

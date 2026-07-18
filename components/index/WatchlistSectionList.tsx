import React from 'react';
import { View, Text, TouchableOpacity, SectionList, RefreshControl, StyleSheet } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, PlayCircle, Bookmark, Clock } from 'lucide-react-native';
import EpisodeCard from '../EpisodeCard';

type CollapsedState = { upNext: boolean; inactive: boolean; dropped: boolean; watchlist: boolean };

interface WatchlistSection {
  title: string;
  key: string;
  data: any[];
  count: number;
}

interface WatchlistSectionListProps {
  sections: WatchlistSection[];
  collapsed: CollapsedState;
  onToggleCategory: (category: keyof CollapsedState) => void;
  onShowFinished: (showName: string, showId: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
  insets: EdgeInsets;
  emptyLabel: string;
}

export default function WatchlistSectionList({
  sections,
  collapsed,
  onToggleCategory,
  onShowFinished,
  refreshing,
  onRefresh,
  insets,
  emptyLabel,
}: WatchlistSectionListProps) {
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <EpisodeCard data={item} onShowFinished={onShowFinished} />}
      renderSectionHeader={({ section }) => {
        let Icon = PlayCircle;
        if (section.key === 'watchlist') Icon = Bookmark;
        if (section.key === 'inactive') Icon = Clock;

        const isCollapsed = collapsed[section.key as keyof CollapsedState];

        return (
          <TouchableOpacity
            style={styles.categoryHeader}
            activeOpacity={0.7}
            onPress={() => onToggleCategory(section.key as keyof CollapsedState)}
          >
            <View style={styles.categoryHeaderLeft}>
              <Icon size={20} color="#94A3B8" style={styles.categoryIcon} />
              <Text style={styles.categoryTitle}>{section.title}</Text>
            </View>
            <View style={styles.categoryHeaderRight}>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{section.count}</Text>
              </View>
              {isCollapsed ? <ChevronDown size={20} color="#a3a3a3" /> : <ChevronUp size={20} color="#a3a3a3" />}
            </View>
          </TouchableOpacity>
        );
      }}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      style={styles.scrollView}
      stickySectionHeadersEnabled={false}
      initialNumToRender={5}
      maxToRenderPerBatch={5}
      windowSize={3}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#ffffff"
          colors={['#ffffff']}
          progressBackgroundColor="#262626"
        />
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, paddingHorizontal: 12 },
  scrollContent: { paddingTop: 12 },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#172033', // Midnight slate box
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A364F',
  },
  categoryHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  categoryHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  categoryIcon: { marginRight: 12 },
  categoryTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  badgeContainer: {
    backgroundColor: '#3B82F6', // Highlight color
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: { color: '#64748b', textAlign: 'center', paddingVertical: 20, fontStyle: 'italic' },
});

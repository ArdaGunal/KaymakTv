import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, SectionList, RefreshControl, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import { ChevronDown, PlayCircle, Bookmark, Clock } from 'lucide-react-native';
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

// Her kategorinin kendi ikon rengi — başlıklar tek tip gri yerine ayırt edilebilir.
const SECTION_META: Record<string, { Icon: React.ComponentType<any>; tint: string; bg: string }> = {
  upNext: { Icon: PlayCircle, tint: '#60a5fa', bg: 'rgba(59, 130, 246, 0.12)' },
  watchlist: { Icon: Bookmark, tint: '#c084fc', bg: 'rgba(168, 85, 247, 0.12)' },
  inactive: { Icon: Clock, tint: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)' },
};

// Chevron artık anlık yön değiştirmiyor; 220ms'lik bir dönüşle açılıp kapanıyor.
function SectionHeader({
  section,
  isCollapsed,
  onToggle,
}: {
  section: WatchlistSection;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const rotateAnim = useRef(new Animated.Value(isCollapsed ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isCollapsed ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isCollapsed, rotateAnim]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const meta = SECTION_META[section.key] ?? SECTION_META.upNext;
  const Icon = meta.Icon;

  return (
    <TouchableOpacity style={styles.categoryHeader} activeOpacity={0.7} onPress={onToggle}>
      <View style={styles.categoryHeaderLeft}>
        <View style={[styles.categoryIconBox, { backgroundColor: meta.bg }]}>
          <Icon size={16} color={meta.tint} />
        </View>
        <Text style={styles.categoryTitle}>{section.title}</Text>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{section.count}</Text>
        </View>
      </View>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <ChevronDown size={20} color="#64748b" />
      </Animated.View>
    </TouchableOpacity>
  );
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
      renderSectionHeader={({ section }) => (
        <SectionHeader
          section={section}
          isCollapsed={collapsed[section.key as keyof CollapsedState]}
          onToggle={() => onToggleCategory(section.key as keyof CollapsedState)}
        />
      )}
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
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  categoryHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  categoryIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  badgeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 10,
    minWidth: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: { color: '#64748b', textAlign: 'center', paddingVertical: 20, fontStyle: 'italic' },
});

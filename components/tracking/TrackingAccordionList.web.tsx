import React, { memo, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import { ChevronDown, PlayCircle, Bookmark, Clock, PauseCircle } from 'lucide-react-native';
import EpisodeCard from '../EpisodeCard';
import type { ShowCategories, TrackingCard } from '../../store/tracking/trackingLogic';
import type { TrackingCategoryKey, CollapsedMap } from '../../store/tracking/useTrackingStore';

const SECTION_META: Record<TrackingCategoryKey, { Icon: React.ComponentType<any>; tint: string; bg: string }> = {
  upNext: { Icon: PlayCircle, tint: '#60a5fa', bg: 'rgba(59, 130, 246, 0.12)' },
  paused: { Icon: PauseCircle, tint: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)' },
  notStarted: { Icon: Bookmark, tint: '#c084fc', bg: 'rgba(168, 85, 247, 0.12)' },
  dropped: { Icon: Clock, tint: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)' },
};

const SECTION_ORDER: TrackingCategoryKey[] = ['upNext', 'paused', 'notStarted', 'dropped'];
// Web'de kartlar tek sütun yerine grid'e (yan yana) dizilir.
const CARD_MIN_WIDTH = 340;

interface SectionBlock {
  key: TrackingCategoryKey;
  title: string;
  items: TrackingCard[];
  collapsed: boolean;
}

interface TrackingAccordionListWebProps {
  categories: ShowCategories;
  collapsed: CollapsedMap;
  onToggle: (key: TrackingCategoryKey) => void;
  labels: Record<TrackingCategoryKey, string>;
  onShowFinished: (showName: string, showId: number) => void;
  onToggleDropped: (id: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
  insets: EdgeInsets;
  emptyLabel: string;
}

const SectionHeader = memo(function SectionHeader({
  sectionKey,
  title,
  count,
  collapsed,
  onToggle,
}: {
  sectionKey: TrackingCategoryKey;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: (key: TrackingCategoryKey) => void;
}) {
  const rotateAnim = useRef(new Animated.Value(collapsed ? 0 : 1)).current;

  React.useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: collapsed ? 0 : 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [collapsed, rotateAnim]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const meta = SECTION_META[sectionKey];
  const Icon = meta.Icon;

  return (
    <TouchableOpacity style={styles.categoryHeader} activeOpacity={0.75} onPress={() => onToggle(sectionKey)}>
      <View style={styles.categoryHeaderLeft}>
        <View style={[styles.categoryIconBox, { backgroundColor: meta.bg }]}>
          <Icon size={18} color={meta.tint} />
        </View>
        <Text style={styles.categoryTitle}>{title}</Text>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      </View>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <ChevronDown size={22} color="#64748b" />
      </Animated.View>
    </TouchableOpacity>
  );
});

// Bir kategori bloğu: başlık + (açıksa) kartların grid dizilimi. Web'de geniş
// ekran avantajını kullanmak için kartlar flexWrap ile yan yana tile edilir.
const SectionBlockView = memo(function SectionBlockView({
  block,
  onToggle,
  onShowFinished,
  onToggleDropped,
}: {
  block: SectionBlock;
  onToggle: (key: TrackingCategoryKey) => void;
  onShowFinished: (showName: string, showId: number) => void;
  onToggleDropped: (id: number) => void;
}) {
  return (
    <View style={styles.sectionBlock}>
      <SectionHeader
        sectionKey={block.key}
        title={block.title}
        count={block.items.length}
        collapsed={block.collapsed}
        onToggle={onToggle}
      />
      {!block.collapsed && (
        <View style={styles.grid}>
          {block.items.map((card) => (
            <View key={`${block.key}-${card.id}`} style={styles.gridCell}>
              <EpisodeCard data={card} onShowFinished={onShowFinished} onToggleDropped={onToggleDropped} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

function TrackingAccordionListWeb({
  categories,
  collapsed,
  onToggle,
  labels,
  onShowFinished,
  onToggleDropped,
  refreshing,
  onRefresh,
  insets,
  emptyLabel,
}: TrackingAccordionListWebProps) {
  const blocks = useMemo<SectionBlock[]>(() => {
    const out: SectionBlock[] = [];
    for (const key of SECTION_ORDER) {
      const items = categories[key];
      if (items.length === 0) continue;
      out.push({ key, title: labels[key], items, collapsed: collapsed[key] });
    }
    return out;
  }, [categories, collapsed, labels]);

  const renderItem = useCallback(
    ({ item }: { item: SectionBlock }) => (
      <SectionBlockView block={item} onToggle={onToggle} onShowFinished={onShowFinished} onToggleDropped={onToggleDropped} />
    ),
    [onToggle, onShowFinished, onToggleDropped]
  );

  const keyExtractor = useCallback((item: SectionBlock) => item.key, []);

  return (
    <FlatList
      data={blocks}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
      windowSize={5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
      ListEmptyComponent={<Text style={styles.emptyText}>{emptyLabel}</Text>}
    />
  );
}

export default memo(TrackingAccordionListWeb);

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: {
    paddingTop: 12,
    paddingHorizontal: 24,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  sectionBlock: { marginBottom: 20 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  gridCell: {
    flexGrow: 1,
    flexBasis: CARD_MIN_WIDTH,
    maxWidth: 520,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    ...(Platform.OS === 'web' && { cursor: 'pointer' } as any),
  },
  categoryHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  categoryIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  badgeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 12,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#cbd5e1', fontSize: 13, fontWeight: '700' },
  emptyText: { color: '#64748b', textAlign: 'center', paddingVertical: 24, fontStyle: 'italic' },
});

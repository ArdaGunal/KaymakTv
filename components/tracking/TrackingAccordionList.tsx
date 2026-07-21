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
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import { ChevronDown, PlayCircle, Bookmark, Clock, PauseCircle } from 'lucide-react-native';
import EpisodeCard from '../EpisodeCard';
import type { ShowCategories, TrackingCard } from '../../store/tracking/trackingLogic';
import type { TrackingCategoryKey, CollapsedMap } from '../../store/tracking/useTrackingStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Yalnızca opacity + easeInEaseOut: scale içeren preset'ler Android'de
// virtualized listelerde takılma yapıyordu.
const COLLAPSE_ANIMATION = {
  duration: 220,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

const SECTION_META: Record<TrackingCategoryKey, { Icon: React.ComponentType<any>; tint: string; bg: string }> = {
  upNext: { Icon: PlayCircle, tint: '#60a5fa', bg: 'rgba(59, 130, 246, 0.12)' },
  paused: { Icon: PauseCircle, tint: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)' },
  notStarted: { Icon: Bookmark, tint: '#c084fc', bg: 'rgba(168, 85, 247, 0.12)' },
  dropped: { Icon: Clock, tint: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)' },
};

const SECTION_ORDER: TrackingCategoryKey[] = ['upNext', 'paused', 'notStarted', 'dropped'];

type Row =
  | { type: 'header'; key: TrackingCategoryKey; title: string; count: number; collapsed: boolean }
  | { type: 'card'; key: string; card: TrackingCard };

interface TrackingAccordionListProps {
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
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [collapsed, rotateAnim]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const meta = SECTION_META[sectionKey];
  const Icon = meta.Icon;

  return (
    <TouchableOpacity style={styles.categoryHeader} activeOpacity={0.7} onPress={() => onToggle(sectionKey)}>
      <View style={styles.categoryHeaderLeft}>
        <View style={[styles.categoryIconBox, { backgroundColor: meta.bg }]}>
          <Icon size={16} color={meta.tint} />
        </View>
        <Text style={styles.categoryTitle}>{title}</Text>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      </View>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <ChevronDown size={20} color="#64748b" />
      </Animated.View>
    </TouchableOpacity>
  );
});

function TrackingAccordionList({
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
}: TrackingAccordionListProps) {
  // Animasyon süresi boyunca yeni dokunuşları yut — yarıda kesilen
  // LayoutAnimation, listeyi "takılı" bırakabiliyordu.
  const toggleLockRef = useRef(0);

  const handleToggle = useCallback(
    (key: TrackingCategoryKey) => {
      const now = Date.now();
      if (now - toggleLockRef.current < COLLAPSE_ANIMATION.duration + 40) return;
      toggleLockRef.current = now;
      LayoutAnimation.configureNext(COLLAPSE_ANIMATION);
      onToggle(key);
    },
    [onToggle]
  );

  // Düz (flattened) satır listesi: kapalı bölümlerin kartları hiç eklenmez, bu
  // yüzden collapse tamamen veri seviyesinde — ekstra ölçüm/clipping yok.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const key of SECTION_ORDER) {
      const items = categories[key];
      if (items.length === 0) continue;
      out.push({ type: 'header', key, title: labels[key], count: items.length, collapsed: collapsed[key] });
      if (!collapsed[key]) {
        for (const card of items) out.push({ type: 'card', key: `${key}-${card.id}`, card });
      }
    }
    return out;
  }, [categories, collapsed, labels]);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.type === 'header') {
        return (
          <SectionHeader
            sectionKey={item.key}
            title={item.title}
            count={item.count}
            collapsed={item.collapsed}
            onToggle={handleToggle}
          />
        );
      }
      return <EpisodeCard data={item.card} onShowFinished={onShowFinished} onToggleDropped={onToggleDropped} />;
    },
    [handleToggle, onShowFinished, onToggleDropped]
  );

  const keyExtractor = useCallback((item: Row) => item.key, []);

  return (
    <FlatList
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={5}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews={Platform.OS === 'android'}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#ffffff"
          colors={['#ffffff']}
          progressBackgroundColor="#262626"
        />
      }
      ListEmptyComponent={<Text style={styles.emptyText}>{emptyLabel}</Text>}
    />
  );
}

export default memo(TrackingAccordionList);

const styles = StyleSheet.create({
  list: { flex: 1, paddingHorizontal: 12 },
  content: { paddingTop: 12 },
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
  badgeText: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  emptyText: { color: '#64748b', textAlign: 'center', paddingVertical: 20, fontStyle: 'italic' },
});

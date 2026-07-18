import React, { useCallback, memo } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import LoadingIndicator from '../components/LoadingIndicator';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import MediaPoster from '../components/MediaPoster';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { generateMediaSlug } from '../utils/slugHelper';
import { useLibraryTypeData, getLibraryTitleKey, LibraryItem } from '../hooks/useLibraryTypeData';

const { width } = Dimensions.get('window');
const SPACING = 8;
const NUM_COLUMNS = 3;
const CARD_WIDTH = (width - (SPACING * (NUM_COLUMNS + 1))) / NUM_COLUMNS;
const CARD_HEIGHT = CARD_WIDTH * 1.5;
const ROW_HEIGHT = CARD_HEIGHT + SPACING;

interface GridItemProps {
  item: LibraryItem;
  type: string | string[] | undefined;
  onPress: (item: LibraryItem) => void;
}

const LibraryGridItem = memo(({ item, type, onPress }: GridItemProps) => (
  <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => onPress(item)}>
    {type === 'lists' ? (
      <View style={[styles.poster, styles.listPlaceholder]}>
        <Text style={styles.listPlaceholderText}>{item.title}</Text>
      </View>
    ) : (
      <MediaPoster
        tmdbId={item.tmdbId}
        type={type === 'shows' || type === 'favShows' ? 'show' : 'movie'}
        title={item.title}
        style={styles.poster}
      />
    )}
  </TouchableOpacity>
));

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { t } = useTranslation('navigation');

  const { data, loading } = useLibraryTypeData(type, accessToken);

  const handleItemPress = useCallback((item: LibraryItem) => {
    if (!item.id) return;
    if (type === 'lists') {
      router.push(`/list/${item.id}?name=${encodeURIComponent(item.title || '')}`);
    } else {
      const routeType = type === 'shows' || type === 'favShows' ? 'show' : 'movie';
      const slug = generateMediaSlug(item.id, undefined, item.title);
      router.push(`/${routeType}/${slug}?tmdbId=${item.tmdbId || ''}`);
    }
  }, [type, router]);

  const renderItem = useCallback(({ item }: { item: LibraryItem }) => (
    <LibraryGridItem item={item} type={type} onPress={handleItemPress} />
  ), [type, handleItemPress]);

  const getItemLayout = useCallback((_data: any, index: number) => {
    const row = Math.floor(index / NUM_COLUMNS);
    return { length: ROW_HEIGHT, offset: ROW_HEIGHT * row, index };
  }, []);

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t(getLibraryTitleKey(type))}</Text>
        <View style={{ width: 28 }} />
      </View>

      {!loading && data.length > 0 ? (
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>{t('totalCount', { count: data.length, title: t(getLibraryTitleKey(type)) })}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <LoadingIndicator size="large" color="#ffffff" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContainer}
          getItemLayout={getItemLayout}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          updateCellsBatchingPeriod={50}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#171717',
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  statsText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    padding: SPACING,
    paddingBottom: 40,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    margin: SPACING / 2,
    backgroundColor: '#262626',
    borderRadius: 6,
    overflow: 'hidden',
    borderBottomWidth: 4,
    borderBottomColor: '#8b5cf6', // TV Time mor çizgisi (Vurgu)
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  listPlaceholder: {
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  listPlaceholderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../../context/AuthContext';
import MediaPoster from '../../../components/MediaPoster';
import { generateMediaSlug } from '../../../utils/slugHelper';
import LoadingIndicator from '../../../components/LoadingIndicator';
import { useResponsive } from '../../../hooks/useResponsive';
import LibraryMobile from '../../../screens/LibraryMobile';
import { useLibraryTypeData, getLibraryTitleKey, LibraryItem } from '../../../hooks/useLibraryTypeData';

const SPACING = 16;
const NUM_COLUMNS = 6;

interface GridItemProps {
  item: LibraryItem;
  type: string | string[] | undefined;
  onPress: (item: LibraryItem) => void;
}

const LibraryGridItemWeb = memo(({ item, type, onPress }: GridItemProps) => (
  <TouchableOpacity
    style={styles.card}
    {...{ className: 'web-library-card' }}
    activeOpacity={0.8}
    onPress={() => onPress(item)}
  >
    <View style={styles.imageContainer}>
      <MediaPoster
        tmdbId={item.tmdbId}
        type={type === 'shows' || type === 'favShows' ? 'show' : 'movie'}
        title={item.title}
        style={styles.poster}
      />
      <View style={styles.hoverOverlay} {...{ className: 'hover-overlay' }} />
    </View>
    <Text style={styles.titleText} numberOfLines={1}>{item.title}</Text>
  </TouchableOpacity>
));

export default function LibraryScreenWeb() {
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { t } = useTranslation('navigation');

  const { data, loading } = useLibraryTypeData(isDesktop ? type : undefined, accessToken);

  const handleItemPress = useCallback((item: LibraryItem) => {
    if (!item.id) return;
    const routeType = type === 'shows' || type === 'favShows' ? 'show' : 'movie';
    const slug = generateMediaSlug(item.id, undefined, item.title);
    router.push(`/${routeType}/${slug}?tmdbId=${item.tmdbId || ''}`);
  }, [type, router]);

  const renderItem = useCallback(({ item }: { item: LibraryItem }) => (
    <LibraryGridItemWeb item={item} type={type} onPress={handleItemPress} />
  ), [type, handleItemPress]);

  if (!isDesktop) {
    return <LibraryMobile />;
  }

  const title = t(getLibraryTitleKey(type));

  return (
    <View style={styles.safeArea}>
      <style dangerouslySetInnerHTML={{ __html: `
        .web-library-card:hover { transform: scale(1.05); z-index: 10; }
        .web-library-card:hover .hover-overlay { background-color: rgba(255,255,255,0.1) !important; }
      `}} />
      <View style={styles.webContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color="#ffffff" size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <LoadingIndicator />
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
            renderItem={renderItem}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
            initialNumToRender={18}
            maxToRenderPerBatch={18}
            windowSize={9}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
  },
  webContainer: {
    width: '100%',
    maxWidth: 1200,
    flex: 1,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    backgroundColor: '#1f2937',
    borderRadius: 20,
    ...( { cursor: 'pointer', transition: 'all 0.2s ease' } as any)
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100
  },
  row: {
    justifyContent: 'flex-start',
    gap: SPACING,
    marginBottom: SPACING * 2,
  },
  card: {
    width: `calc(16.666% - ${SPACING * 5 / 6}px)`,
    ...( { cursor: 'pointer', transition: 'transform 0.3s ease' } as any)
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 2/3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  poster: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0)',
    ...( { transition: 'background-color 0.3s ease' } as any)
  },
  titleText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});

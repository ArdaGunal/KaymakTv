import React, { memo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import MediaPoster from './MediaPoster';
import { generateMediaSlug } from '../utils/slugHelper';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.28;
const CARD_HEIGHT = CARD_WIDTH * 1.5; // 2:3 aspect ratio (poster)
const GAP = 12;

interface HorizontalShowListProps {
  title: string;
  titleIcon?: React.ReactNode;
  data: any[];
  onShowAll?: () => void;
  type?: 'show' | 'movie' | 'list';
}

const keyExtractor = (item: any, index: number) => `${item.id}-${index}`;

// Sabit kart boyutu bilindiği için FlatList ölçüm yapmadan direkt konumlandırır.
const getItemLayout = (_data: any, index: number) => ({
  length: CARD_WIDTH + GAP,
  offset: (CARD_WIDTH + GAP) * index,
  index,
});

const HorizontalShowList = memo(({ title, titleIcon, data, onShowAll, type = 'show' }: HorizontalShowListProps) => {
  const router = useRouter();

  const handleCardPress = useCallback((item: any) => {
    const traktId = item.rawTraktId || item.id || item.show?.ids?.trakt || item.movie?.ids?.trakt;
    const tmdbId = item.tmdbId || item.show?.ids?.tmdb || item.movie?.ids?.tmdb || '';
    const itemTitle = item.title || item.show?.title || item.movie?.title;
    const itemSlug = item.slug || item.show?.ids?.slug || item.movie?.ids?.slug;

    if (type === 'list') {
      router.push(`/list/${traktId}?name=${encodeURIComponent(item.title)}`);
    } else if (traktId) {
      const slug = generateMediaSlug(traktId, itemSlug, itemTitle);
      router.push(`/${type}/${slug}?tmdbId=${tmdbId}`);
    }
  }, [type, router]);

  const renderCard = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => handleCardPress(item)}
    >
      {type === 'list' ? (
        <View style={[styles.poster, styles.listPosterFallback]}>
          <Text style={styles.listPosterText}>{item.title}</Text>
        </View>
      ) : (
        <MediaPoster
          tmdbId={item.tmdbId || item.show?.ids?.tmdb || item.movie?.ids?.tmdb}
          type={type as 'show' | 'movie'}
          title={item.title || item.show?.title || item.movie?.title}
          style={styles.poster}
        />
      )}
    </TouchableOpacity>
  ), [type, handleCardPress]);

  if (!data || data.length === 0) {
    return null; // Eğer veri yoksa kategoriyi hiç gösterme
  }

  return (
    <View style={styles.container}>
      {/* Başlık ve İkon Satırı */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {titleIcon && <View style={styles.iconContainer}>{titleIcon}</View>}
          <Text style={styles.title}>{title}</Text>
        </View>
        <TouchableOpacity style={styles.seeAllButton} onPress={onShowAll}>
          <ChevronRight size={20} color="#a3a3a3" />
        </TouchableOpacity>
      </View>

      {/* Yatay Liste (FlatList ile optimize edildi, yüzlerce resimde kasmaması için) */}
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={renderCard}
        getItemLayout={getItemLayout}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={3}
        removeClippedSubviews={Platform.OS !== 'web'}
      />
    </View>
  );
});

export default HorizontalShowList;

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeAllButton: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: GAP, // FlatList 'gap' destekler (React Native >= 0.71) — getItemLayout ile senkron
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#172033',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2A364F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  placeholderText: {
    color: '#a3a3a3',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  listPosterFallback: {
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  listPosterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  }
});

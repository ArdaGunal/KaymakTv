import React, { memo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import MediaPoster from './MediaPoster';
import { generateMediaSlug } from '../utils/slugHelper';
import SectionHeader from './profile/SectionHeader';
import {
  POSTER_CARD_WIDTH as CARD_WIDTH,
  POSTER_CARD_HEIGHT as CARD_HEIGHT,
  CARD_GAP as GAP,
  SECTION_PADDING_H,
  SECTION_SPACING,
} from './profile/profileMetrics';

interface HorizontalShowListProps {
  title: string;
  titleIcon?: React.ReactNode;
  /** Başlık rozetinin rengi — `titleIcon` verildiğinde onunla uyumlu olmalı. */
  titleTint?: string;
  data: any[];
  onShowAll?: () => void;
  seeAllLabel?: string;
  type?: 'show' | 'movie' | 'list';
}

const keyExtractor = (item: any, index: number) => `${item.id}-${index}`;

// Sabit kart boyutu bilindiği için FlatList ölçüm yapmadan direkt konumlandırır.
const getItemLayout = (_data: any, index: number) => ({
  length: CARD_WIDTH + GAP,
  offset: (CARD_WIDTH + GAP) * index,
  index,
});

const HorizontalShowList = memo(({
  title,
  titleIcon,
  titleTint,
  data,
  onShowAll,
  seeAllLabel = 'Tümü',
  type = 'show',
}: HorizontalShowListProps) => {
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
      <SectionHeader
        title={title}
        icon={titleIcon}
        iconTint={titleTint}
        onSeeAll={onShowAll}
        seeAllLabel={seeAllLabel}
      />

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
    marginBottom: SECTION_SPACING,
  },
  listContent: {
    paddingHorizontal: SECTION_PADDING_H,
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

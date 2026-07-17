import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import MediaPoster from './MediaPoster';
import { generateMediaSlug } from '../utils/slugHelper';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.28;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

interface HorizontalMediaListProps {
  title: string;
  titleIcon?: React.ReactNode;
  data: any[];
  onShowAll?: () => void;
  type?: 'show' | 'movie'; // Media tipini belirlemek için
}

export default function HorizontalMediaList({ title, titleIcon, data, onShowAll, type = 'show' }: HorizontalMediaListProps) {
  const router = useRouter();

  if (!data || data.length === 0) {
    return null;
  }

  const renderCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => {
        const traktId = item.rawTraktId || item.id || item.ids?.trakt || item.show?.ids?.trakt || item.movie?.ids?.trakt;
        const tmdbId = item.tmdbId || item.ids?.tmdb || item.show?.ids?.tmdb || item.movie?.ids?.tmdb || '';
        const title = item.title || item.show?.title || item.movie?.title;
        const itemSlug = item.ids?.slug || item.show?.ids?.slug || item.movie?.ids?.slug;
        if (traktId) {
          const slug = generateMediaSlug(traktId, itemSlug, title);
          router.push(`/${type}/${slug}?tmdbId=${tmdbId}`);
        }
      }}
    >
      <MediaPoster 
        tmdbId={item.tmdbId || item.ids?.tmdb || item.show?.ids?.tmdb || item.movie?.ids?.tmdb} 
        type={type} 
        title={item.title || item.show?.title || item.movie?.title} 
        style={styles.poster} 
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {titleIcon && <View style={styles.iconContainer}>{titleIcon}</View>}
          <Text style={styles.title}>{title}</Text>
        </View>
        {onShowAll && (
          <TouchableOpacity style={styles.seeAllButton} onPress={onShowAll}>
            <ChevronRight size={20} color="#a3a3a3" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList 
        data={data}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={renderCard}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={3}
      />
    </View>
  );
}

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
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#262626',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#a3a3a3',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

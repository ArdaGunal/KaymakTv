import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EpisodeCard from '../../../components/EpisodeCard';
import MovieCard from '../../../components/movies/MovieCard';
import ListCard from '../../../components/ListCard.web';
import { viewAllStore } from '../../../utils/viewAllStore';

const SPACING = 16;
const NUM_COLUMNS = 6;

export default function ViewAllWebScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { type } = useLocalSearchParams();
  
  const data = viewAllStore.data || [];
  const title = viewAllStore.title || 'Tümü';

  useEffect(() => {
    // If user refreshed the page and state was lost, redirect back to home
    if (data.length === 0) {
      router.replace('/');
    }
  }, [data.length]);

  const renderItem = ({ item }: { item: any }) => {
    return (
      <View style={styles.cardWrapper}>
        {type === 'lists' ? (
          <ListCard data={item} />
        ) : type === 'shows' ? (
          <EpisodeCard data={item} />
        ) : (
          <MovieCard data={item} />
        )}
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.webContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color="#ffffff" size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>

        <FlatList
          data={data}
          keyExtractor={(item, index) => (item.id ? item.id.toString() : index.toString())}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
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
  cardWrapper: { 
    width: `calc(16.666% - ${SPACING * 5 / 6}px)` as any,
  }
});

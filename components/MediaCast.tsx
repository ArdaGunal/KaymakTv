import React from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { getPersonPhoto } from '../services/tmdbApi';

interface MediaCastProps {
  cast: any[];
}

export default function MediaCast({ cast }: MediaCastProps) {
  if (!cast || cast.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Oyuncular</Text>
      <FlatList
        data={cast}
        horizontal
        keyExtractor={(item, index) => item.person?.ids?.trakt?.toString() || index.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => {
          const profilePath = item.person?.images?.profiles?.[0]?.file_path; // Eğer TMDB eklendiyse (genelde trakt döndürmez)
          // Fakat Trakt genellikle people API'sinde resim vermez. 
          // Not: İdealde bunu TMDB'den çekiyoruz, ama Trakt'tan gelen datada resim yoksa gri kutu çıkar.
          
          return (
            <View style={styles.castCard}>
              <View style={styles.castImageContainer}>
                {/* Gelecekte TMDB entegrasyonu için ayrılmış alan */}
                <View style={styles.castImagePlaceholder} />
              </View>
              <Text style={styles.castName} numberOfLines={2}>{item.person?.name}</Text>
              <Text style={styles.castCharacter} numberOfLines={2}>{item.characters?.[0]}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  castCard: {
    width: 100,
    marginRight: 16,
    alignItems: 'flex-start',
  },
  castImageContainer: {
    width: 100,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#172033',
    marginBottom: 8,
    overflow: 'hidden',
  },
  castImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#172033',
  },
  castName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  castCharacter: {
    color: '#a3a3a3',
    fontSize: 12,
  },
});

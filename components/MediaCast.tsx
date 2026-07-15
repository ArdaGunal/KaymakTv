import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { getPersonPhoto } from '../services/tmdbApi';

interface MediaCastProps {
  cast: any[];
  onActorPress?: (actorId: number) => void;
}

export default function MediaCast({ cast, onActorPress }: MediaCastProps) {
  if (!cast || cast.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Oyuncular</Text>
      <FlatList
        data={cast}
        horizontal
        keyExtractor={(item, index) => item.person?.ids?.tmdb?.toString() || item.person?.ids?.trakt?.toString() || index.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => {
          const profilePath = item.person?.images?.profiles?.[0]?.file_path;
          const photoUrl = getPersonPhoto(profilePath);
          
          const actorTmdbId = item.person?.ids?.tmdb;
          const actorTraktId = item.person?.ids?.trakt;
          const actorId = actorTmdbId || actorTraktId;

          const CardContent = (
            <>
              <View style={styles.castImageContainer}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.castImage} />
                ) : (
                  <View style={styles.castImagePlaceholder} />
                )}
              </View>
              <Text style={styles.castName} numberOfLines={2}>{item.person?.name}</Text>
              <Text style={styles.castCharacter} numberOfLines={2}>{item.characters?.[0]}</Text>
            </>
          );
          
          return onActorPress ? (
            <TouchableOpacity 
              style={styles.castCard} 
              onPress={() => onActorPress(actorId)}
              activeOpacity={0.7}
            >
              {CardContent}
            </TouchableOpacity>
          ) : (
            <View style={styles.castCard}>
              {CardContent}
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
  castImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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

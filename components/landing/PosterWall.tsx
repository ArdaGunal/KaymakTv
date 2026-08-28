import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

interface PosterWallProps {
  posters: string[];
}

// Hero'nun arkasına serilen bulanık afiş duvarı. Gerçek poster sayısı
// (ağdan gelen trend liste boyutuna göre) TILE_COUNT'tan azsa listeyi
// döngüsel olarak tekrarlar — boş/eksik hücre bırakmaz.
const TILE_COUNT = 24;

export default function PosterWall({ posters }: PosterWallProps) {
  if (posters.length === 0) return null;

  const tiles = Array.from({ length: TILE_COUNT }, (_, i) => posters[i % posters.length]);

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.grid}>
        {tiles.map((uri, index) => (
          <Image
            key={index}
            source={{ uri }}
            style={styles.tile}
            contentFit="cover"
            blurRadius={2}
            transition={300}
          />
        ))}
      </View>

      <LinearGradient
        colors={['rgba(14,19,29,0.55)', 'rgba(14,19,29,0.88)', '#0e131d']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(14,19,29,0.35)', 'rgba(14,19,29,0)', 'rgba(14,19,29,0.35)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '112%',
    marginLeft: '-6%',
  },
  tile: {
    width: '16.66%',
    aspectRatio: 2 / 3,
    backgroundColor: '#1b202a',
  },
});

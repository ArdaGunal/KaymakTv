import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { getPersonPhoto } from '../services/tmdbApi';
import PersonSheet from './person/PersonSheet';

interface MediaCastProps {
  cast: any[];
}

/** Oyuncu şeridi. 2.6.5 madde 9: karta dokununca uygulama içi `PersonSheet` açılır. */
export default function MediaCast({ cast }: MediaCastProps) {
  const { t } = useTranslation('media');
  const [secili, setSecili] = useState<{ id: number; name?: string } | null>(null);
  if (!cast || cast.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('castTitle', 'Oyuncular')}</Text>
      <FlatList
        data={cast}
        horizontal
        keyExtractor={(item, index) => item.person?.ids?.tmdb?.toString() || item.person?.ids?.trakt?.toString() || index.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => {
          const profilePath = item.person?.images?.profiles?.[0]?.file_path;
          const photoUrl = getPersonPhoto(profilePath);
          
          // Kişi bilgisi TMDB'den gelir — TMDB kimliği olmayan kart dokunulamaz.
          const actorTmdbId = Number(item.person?.ids?.tmdb) || null;

          const CardContent = (
            <>
              <View style={styles.castImageContainer}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.castImage} contentFit="cover" cachePolicy="disk" />
                ) : (
                  <View style={styles.castImagePlaceholder} />
                )}
              </View>
              <Text style={styles.castName} numberOfLines={2}>{item.person?.name}</Text>
              <Text style={styles.castCharacter} numberOfLines={2}>{item.characters?.[0]}</Text>
            </>
          );
          
          return actorTmdbId ? (
            <TouchableOpacity
              style={styles.castCard}
              onPress={() => setSecili({ id: actorTmdbId, name: item.person?.name })}
              activeOpacity={0.7}
              accessibilityRole="button"
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
      <PersonSheet personId={secili?.id ?? null} initialName={secili?.name} onClose={() => setSecili(null)} />
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

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MediaPoster from '../../../components/MediaPoster';
import { FeedMediaType } from '../types';

export interface PickedMedia {
  showId: number;
  mediaType: FeedMediaType;
  showTitle: string;
  tmdbId?: number;
}

interface MediaPickerRowProps {
  /** Trakt `/search/{type}` sonucu — `ShowCard.tsx` ile AYNI ham şekil
   *  (`{show: {...}}` veya `{movie: {...}}`), yeniden yorumlanmadı. */
  data: any;
  onPress: (media: PickedMedia) => void;
}

/**
 * Akış arama/keşif ekranlarındaki `ShowCard`'ın AKSİNE (o detay sayfasına
 * yönlendirir + kütüphane butonları taşır) bu satır yalnızca SEÇMEK için —
 * dokununca hiçbir yere gidilmez, seçilen yapım compose ekranına döner.
 * Bilerek küçük/amaca özel: `ShowCard`'ı bu iş için değiştirmek, onu
 * kullanan onlarca yeri riske atardı.
 */
export default function MediaPickerRow({ data, onPress }: MediaPickerRowProps) {
  const media = data?.show || data?.movie;
  if (!data || !media?.ids?.trakt) return null;

  const type: FeedMediaType = data.movie ? 'movie' : 'show';
  const traktId = media.ids.trakt;
  const tmdbId = media.ids.tmdb || undefined;
  const title = media.title || '';
  const year = media.year;

  const handlePress = () => {
    onPress({ showId: traktId, mediaType: type, showTitle: title, tmdbId });
  };

  return (
    <TouchableOpacity style={styles.row} onPress={handlePress} activeOpacity={0.7}>
      <MediaPoster tmdbId={tmdbId} type={type} title={title} style={styles.poster} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {!!year && <Text style={styles.year}>{year}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  poster: {
    width: 40,
    height: 58,
    borderRadius: 6,
    backgroundColor: '#0B1120',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  year: {
    color: '#64748b',
    fontSize: 12,
  },
});

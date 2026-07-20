import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ViewStyle, StyleProp } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { getShowPoster, getMoviePoster, peekPosterCache } from '../services/tmdbApi';

interface MediaPosterProps {
  tmdbId?: number;
  type?: 'show' | 'movie';
  title?: string;
  style?: StyleProp<ImageStyle | ViewStyle>;
  placeholderTextLines?: number;
}

// Izgara/liste ekranlarında hücreler kaydırma sırasında sürekli mount/unmount
// olur (virtualization). Önbellekte olan bir posteri senkron kontrol etmeden
// önce isLoading'i true yapmak, her yeniden mount'ta bir "spinner flaşı"na
// sebep oluyordu — özellikle listenin sonunda hızlı geri-sekmede (overscroll)
// onlarca hücre birden yeniden mount olunca "habire yükleniyor" hissi veriyordu.
const initialStateFor = (tmdbId: number | undefined, type: 'show' | 'movie') => {
  if (!tmdbId) return { imageUrl: null, isLoading: false };
  const cached = peekPosterCache(type, tmdbId);
  if (cached.hit) return { imageUrl: cached.url, isLoading: false };
  return { imageUrl: null, isLoading: true };
};

const MediaPoster = memo(({ tmdbId, type = 'show', title = 'İsimsiz', style, placeholderTextLines = 2 }: MediaPosterProps) => {
  const [{ imageUrl, isLoading }, setState] = useState(() => initialStateFor(tmdbId, type));

  useEffect(() => {
    let isMounted = true;

    // Önbellekte zaten varsa (senkron isabet), ağa hiç gitmeden anında göster.
    const cached = peekPosterCache(type, tmdbId as number);
    if (tmdbId && cached.hit) {
      setState({ imageUrl: cached.url, isLoading: false });
      return;
    }

    const fetchImage = async () => {
      if (!tmdbId) {
        setState({ imageUrl: null, isLoading: false });
        return;
      }

      setState({ imageUrl: null, isLoading: true });

      try {
        const url = type === 'show' ? await getShowPoster(tmdbId) : await getMoviePoster(tmdbId);

        if (isMounted) {
          setState({ imageUrl: url, isLoading: false });
        }
      } catch (err) {
        // Hata sessizce yutulabilir, yedek UI (placeholder) gösterilecek
        if (isMounted) setState({ imageUrl: null, isLoading: false });
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
  }, [tmdbId, type]);

  // Yükleniyorsa ve henüz URL yoksa (İskelet/Yükleniyor görünümü)
  if (isLoading && !imageUrl) {
    return (
      <View style={[styles.placeholder, style]}>
        <ActivityIndicator color="#e50914" size="small" />
      </View>
    );
  }

  // Resim URL'i bulunduysa expo-image ile göster
  if (imageUrl) {
    return (
      <Image
        source={imageUrl}
        style={style as any}
        contentFit="cover"
        transition={250}
        cachePolicy="disk" // expo-image caching
      />
    );
  }

  // tmdbId yoksa veya resim bulunamadıysa (Fallback)
  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.placeholderText} numberOfLines={placeholderTextLines} ellipsizeMode="tail">
        {title}
      </Text>
    </View>
  );
});

export default MediaPoster;

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  placeholderText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  }
});

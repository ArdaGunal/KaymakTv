import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ViewStyle, StyleProp } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { getShowPoster, getMoviePoster } from '../services/tmdbApi';

interface MediaPosterProps {
  tmdbId?: number;
  type?: 'show' | 'movie';
  title?: string;
  style?: StyleProp<ImageStyle | ViewStyle>;
  placeholderTextLines?: number;
}

const MediaPoster = memo(({ tmdbId, type = 'show', title = 'İsimsiz', style, placeholderTextLines = 2 }: MediaPosterProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchImage = async () => {
      if (!tmdbId) return;
      
      // Hızlı geçişler için bekleme durumunu hemen göster
      setIsLoading(true);
      setImageUrl(null); // tmdbId değiştiğinde eski resmi temizle
      
      try {
        const url = type === 'show' ? await getShowPoster(tmdbId) : await getMoviePoster(tmdbId);
        
        if (isMounted) {
          setImageUrl(url);
        }
      } catch (err) {
        // Hata sessizce yutulabilir, yedek UI (placeholder) gösterilecek
      } finally {
        if (isMounted) setIsLoading(false);
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

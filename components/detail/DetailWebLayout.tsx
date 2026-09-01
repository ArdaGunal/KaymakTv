import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLUMN_GAP, DetailLayoutMetrics } from '../../hooks/useDetailLayout';

interface DetailWebLayoutProps {
  metrics: DetailLayoutMetrics;
  /** Üstteki dekoratif kapak görseli (TMDB backdrop). Yoksa düz yüzey çizilir. */
  backdrop?: string | null;
  /** Sol sütun — asıl içerik (%66). */
  left: React.ReactNode;
  /** Sağ sütun — yapışkan gezinme rayı (%32). Verilmezse tek sütuna düşer. */
  rail?: React.ReactNode;
}

/**
 * Masaüstü web'de dizi, film ve bölüm detaylarının ORTAK kabuğu:
 * TAM EKRAN (100vh) kapak görseli (backdrop) + %80 transparan Glassmorphism içerik kapsayıcısı (container)
 * + asimetrik iki sütun + yapışkan sağ ray.
 *
 * ⚠️ YALNIZCA masaüstü web'de render edilir (bkz. hooks/useDetailLayout.ts).
 * Mobil ağaç bu bileşene hiç uğramaz (Mobil görünüm %100 izoledir).
 */
export default function DetailWebLayout({ metrics, backdrop, left, rail }: DetailWebLayoutProps) {
  const { contentWidth, railWidth, contentOffset } = metrics;

  return (
    <View style={styles.page}>
      {/* KAPAK KATMANI — Tam ekran dekoratif backdrop görseli */}
      <View style={styles.bannerLayer} pointerEvents="none">
        {backdrop ? (
          <Image
            source={{ uri: backdrop }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View style={styles.bannerPlaceholder} />
        )}
        {/* Arkadaki görselin üstüne, içerik parlasın ve ekranın aşağısında kaybolsun diye tam ekran karartma */}
        <LinearGradient
          colors={['rgba(11, 17, 32, 0.45)', 'rgba(11, 17, 32, 0.85)', '#0B1120']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* İÇERİK KAPSAYICISI (OVERLAP & GLASSMORPHISM) */}
      <View
        style={[
          styles.container,
          {
            width: contentWidth,
            marginTop: contentOffset,
          },
        ]}
      >
        <View style={styles.row}>
          {/* Sol sütun: Poster, başlık, künye, butonlar, oyuncular, yorumlar */}
          <View style={styles.leftColumn}>{left}</View>

          {/* Sağ sütun: Sezonlar rayı */}
          {rail ? (
            <View style={[styles.railColumn, { width: railWidth }]}>
              <View style={styles.railSticky}>{rail}</View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    // Arkadaki sabit (fixed) bannerLayer'ın görünmesi için burası transparan olmalı!
    backgroundColor: 'transparent',
    position: 'relative',
    minHeight: '100%',
  },
  bannerLayer: {
    // Masaüstü web'de sabit kalması ve kaydırmadan etkilenmemesi için 'fixed' ve '100vh' kullanıyoruz.
    ...(Platform.OS === 'web' 
      ? { position: 'fixed' as any, height: '100vh' as any } 
      : { position: 'absolute', height: '100%' }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 0,
  },
  bannerPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B1120',
  },
  container: {
    alignSelf: 'center',
    position: 'relative',
    zIndex: 10,
    backgroundColor: 'rgba(14, 19, 29, 0.15)', // %15 opak (çok şeffaf)
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 28,
    marginBottom: 80, // İçerik bittiğinde sayfa altında boşluk kalması için
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.6)',
        } as any)
      : null),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: COLUMN_GAP,
  },
  leftColumn: {
    flex: 1,
    minWidth: 0,
  },
  railColumn: {
    flexShrink: 0,
  },
  railSticky: {
    position: 'sticky',
    top: 24,
    maxHeight: 'calc(100vh - 48px)',
    overflowY: 'auto',
  } as any,
});

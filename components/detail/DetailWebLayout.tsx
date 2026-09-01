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
 * Kapak görseli (backdrop) + %80 transparan Glassmorphism içerik kapsayıcısı (container)
 * + asimetrik iki sütun + yapışkan sağ ray.
 *
 * ⚠️ YALNIZCA masaüstü web'de render edilir (bkz. hooks/useDetailLayout.ts).
 * Mobil ağaç bu bileşene hiç uğramaz (Mobil görünüm %100 izoledir).
 */
export default function DetailWebLayout({ metrics, backdrop, left, rail }: DetailWebLayoutProps) {
  const { contentWidth, railWidth, bannerHeight, contentOffset } = metrics;

  return (
    <View style={styles.page}>
      {/* KAPAK KATMANI — dekoratif backdrop görseli */}
      <View style={[styles.bannerLayer, { height: bannerHeight }]} pointerEvents="none">
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
        {/* Arkadaki görselin kontrastını korumak için hafif gradyan */}
        <LinearGradient
          colors={['rgba(14, 19, 29, 0.20)', 'rgba(14, 19, 29, 0.65)', '#0e131d']}
          locations={[0, 0.6, 1]}
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
    backgroundColor: '#0e131d',
    position: 'relative',
    minHeight: '100%',
  },
  bannerLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    zIndex: 0,
  },
  bannerPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#172033',
  },
  container: {
    alignSelf: 'center',
    position: 'relative',
    zIndex: 10,
    backgroundColor: 'rgba(14, 19, 29, 0.80)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 28,
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

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';

import MediaPoster from '../MediaPoster';
import ProgressBar from '../ProgressBar';
import type { LibraryItem } from '../../hooks/useLibraryTypeData';

// ==========================================================================
// KÜTÜPHANE IZGARA HÜCRESİ ("Tümünü gör" ekranı)
// ==========================================================================
// 🔴 NEDEN AYRI DOSYA: `screens/LibraryMobile.tsx` §C17.1'in çubuğu eklenince
// 415 satıra çıktı (400 kuralı). Dikiş burada doğal: ekran VERİYİ ve
// SÜZMEYİ yönetiyor, bu dosya TEK BİR HÜCREYİ çiziyor.

interface GridItemProps {
  item: LibraryItem;
  type: string | string[] | undefined;
  cardStyle: StyleProp<ViewStyle>;
  onPress: (item: LibraryItem) => void;
  /** 0 = çubuk çizilmez. §C17.1 */
  yuzde: number;
  renk: string;
}

// 🔑 `yuzde`/`renk` İLKEL DEĞER olarak geçiyor, nesne DEĞİL: `memo`'lu hücre
// her render'da yeni bir nesne referansı görüp boşuna yeniden çizilmesin
// (`cardStyle`'ın yukarıdaki `useMemo` gerekçesiyle aynı).
const LibraryGridItem = memo(({ item, type, cardStyle, onPress, yuzde, renk }: GridItemProps) => (
  <TouchableOpacity style={cardStyle} activeOpacity={0.7} onPress={() => onPress(item)}>
    {type === 'lists' ? (
      <View style={[styles.poster, styles.listPlaceholder]}>
        <Text style={styles.listPlaceholderText}>{item.title}</Text>
      </View>
    ) : (
      <MediaPoster
        tmdbId={item.tmdbId}
        type={type === 'shows' || type === 'favShows' ? 'show' : 'movie'}
        title={item.title}
        style={styles.poster}
      />
    )}
    {/* 🔴 MUTLAK KONUM ŞART — `styles.card` sabit yükseklikte ve
        `overflow: 'hidden'`; akış içine konan çubuk kartın dışına taşıyıp
        KIRPILIR (M359'da profil listesinde tam bu yaşandı, cihazda hiç
        görünmedi). `ShowCard`/`HorizontalShowList` ile aynı desen. */}
    {yuzde > 0 && (
      <ProgressBar percentage={yuzde} fillColor={renk} style={styles.ilerleme} />
    )}
  </TouchableOpacity>
));

export default LibraryGridItem;

const styles = StyleSheet.create({
  poster: {
    width: '100%',
    height: '100%',
  },
  // 🔴 MUTLAK KONUM ŞART — kartın kabı sabit yükseklikte ve
  // `overflow: 'hidden'`; akış içine konan çubuk taşıp KIRPILIR (M359'da
  // profil listesinde tam bu yaşandı, cihazda hiç görünmedi).
  ilerleme: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  listPlaceholder: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  listPlaceholderText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});

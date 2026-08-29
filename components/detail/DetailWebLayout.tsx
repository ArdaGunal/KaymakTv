import React from 'react';
import { View, StyleSheet } from 'react-native';
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
 * Masaüstü web'de dizi ve bölüm detaylarının ORTAK kabuğu:
 * kapak görseli + ortalanmış 1200px kapsayıcı + asimetrik iki sütun +
 * yapışkan sağ ray.
 *
 * ⚠️ YALNIZCA masaüstü web'de render edilir (bkz. hooks/useDetailLayout.ts).
 * Mobil ağaç bu bileşene hiç uğramaz.
 *
 * Kapak görseli MUTLAK KONUMDA ve içeriğin ALTINDA duruyor; içerik onun alt
 * yarısından başlıyor. Negatif margin KULLANILMADI — eski mobil düzendeki
 * `marginTop: -80` tam da "afişin yarım görünmesi" şikayetinin kaynağıydı;
 * bindirme artık z-ekseninde çözülüyor, hiçbir görsel kırpılmıyor.
 */
export default function DetailWebLayout({ metrics, backdrop, left, rail }: DetailWebLayoutProps) {
  const { contentWidth, railWidth, bannerHeight, contentOffset } = metrics;

  return (
    <View style={styles.page}>
      {/* KAPAK KATMANI — dekoratif, tıklamaları yutmaz. */}
      <View style={[styles.bannerLayer, { height: bannerHeight }]} pointerEvents="none">
        {backdrop ? (
          <Image
            source={{ uri: backdrop }}
            style={StyleSheet.absoluteFill}
            // `cover`: çerçeveyi oranı bozmadan doldurur. Banner'ın kendi
            // yüksekliği ekranla orantılı olduğu için (bkz. useDetailLayout)
            // kırpma payı her zaman makul kalır.
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View style={styles.bannerPlaceholder} />
        )}
        {/* Alta doğru sayfa rengine erimesi — içerikle banner arasında
            görünür bir dikiş kalmasın. */}
        <LinearGradient
          colors={['rgba(11,17,32,0.35)', 'rgba(11,17,32,0.80)', '#0B1120']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[styles.container, { width: contentWidth, paddingTop: contentOffset }]}>
        <View style={styles.row}>
          {/* minWidth:0 KRİTİK: flex çocuklarının varsayılan `min-width:auto`
              değeri, uzun başlık/özet metinleri yüzünden sütunun ray'i
              ezmesine yol açardı. */}
          <View style={styles.leftColumn}>{left}</View>

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
    backgroundColor: '#0B1120',
    position: 'relative',
  },
  bannerLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  bannerPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#172033',
  },
  container: {
    alignSelf: 'center',
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    // 🔴 `alignItems: 'flex-start'` OLMAMALI (canlı testte bulundu): o değerde
    // sağ sütunun yüksekliği kendi içeriğine eşitleniyor, dolayısıyla yapışkan
    // (sticky) rayın içinde KAYACAK YER kalmıyor ve ray sayfayla birlikte
    // yukarı kaçıyordu. `stretch` (varsayılan) ile sütun satırın tamamı kadar
    // uzuyor, ray de o alan boyunca yapışık kalabiliyor.
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
  // `position: sticky` React Native tiplerinde yok ama react-native-web'de
  // birebir CSS'e geçiyor (projede TrackingAccordionList.web.tsx'te de aynı
  // desen kullanılıyor, bkz. docs/HISTORY.md Madde 59). Sayfa kaydırıcısı
  // ekrandaki ScrollView; ray onun içinde yapışıyor ve kendi taşmasını
  // kendi kaydırıyor — 20 sezonluk bir dizide bile ray ekranı taşırmaz.
  railSticky: {
    position: 'sticky',
    top: 24,
    maxHeight: 'calc(100vh - 48px)',
    overflowY: 'auto',
  } as any,
});

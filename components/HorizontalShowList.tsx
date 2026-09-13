import React, { memo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import MediaPoster from './MediaPoster';
import ProgressBar from './ProgressBar';
import { generateMediaSlug } from '../utils/slugHelper';
import { getProgressBarColor } from '../utils/progressBarColor';
import { useLibrarySelector } from '../context/LibraryContext';
import SectionHeader from './profile/SectionHeader';
import {
  POSTER_CARD_WIDTH as CARD_WIDTH,
  POSTER_CARD_HEIGHT as CARD_HEIGHT,
  CARD_GAP as GAP,
  SECTION_PADDING_H,
  SECTION_SPACING,
} from './profile/profileMetrics';

interface HorizontalShowListProps {
  title: string;
  titleIcon?: React.ReactNode;
  /** Başlık rozetinin rengi — `titleIcon` verildiğinde onunla uyumlu olmalı. */
  titleTint?: string;
  data: any[];
  onShowAll?: () => void;
  seeAllLabel?: string;
  type?: 'show' | 'movie' | 'list';
}

const keyExtractor = (item: any, index: number) => `${item.id}-${index}`;

// Sabit kart boyutu bilindiği için FlatList ölçüm yapmadan direkt konumlandırır.
const getItemLayout = (_data: any, index: number) => ({
  length: CARD_WIDTH + GAP,
  offset: (CARD_WIDTH + GAP) * index,
  index,
});

/**
 * 🔴 ABONELİK LİSTE DÜZEYİNDE, KART BAŞINA DEĞİL (§C17.1).
 *
 * `ShowCard.tsx`'in başındaki ders birebir geçerli: orada tam context
 * aboneliği listedeki HER kartı her store değişiminde yeniden çizdiriyordu ve
 * keşfet kaydırmasındaki takılmanın kaynağı buydu. Burada iki alana bir kez
 * abone olunuyor; `renderCard` yalnızca hazır haritadan okuyor.
 */
const ilerlemeSecici = (s: any) => ({
  showProgressMap: s.showProgressMap,
  hiddenShowIds: s.hiddenShowIds,
});

const HorizontalShowList = memo(({
  title,
  titleIcon,
  titleTint,
  data,
  onShowAll,
  seeAllLabel = 'Tümü',
  type = 'show',
}: HorizontalShowListProps) => {
  const router = useRouter();
  const { showProgressMap, hiddenShowIds } = useLibrarySelector(ilerlemeSecici);

  const handleCardPress = useCallback((item: any) => {
    const traktId = item.rawTraktId || item.id || item.show?.ids?.trakt || item.movie?.ids?.trakt;
    const tmdbId = item.tmdbId || item.show?.ids?.tmdb || item.movie?.ids?.tmdb || '';
    const itemTitle = item.title || item.show?.title || item.movie?.title;
    const itemSlug = item.slug || item.show?.ids?.slug || item.movie?.ids?.slug;

    if (type === 'list') {
      router.push(`/list/${traktId}?name=${encodeURIComponent(item.title)}`);
    } else if (traktId) {
      const slug = generateMediaSlug(traktId, itemSlug, itemTitle);
      router.push(`/${type}/${slug}?tmdbId=${tmdbId}`);
    }
  }, [type, router]);

  const renderCard = useCallback(({ item }: { item: any }) => {
    // ── İLERLEME ÇUBUĞU (§C17.1) ──────────────────────────────────────────
    // Kullanıcı raporu (2026-09-12): *"profil kısmındaki dizilerin altında
    // küçük ilerleme çubuğu vardı… o yok oldu."* Bileşen hiç kaybolmamıştı:
    // çubuğu `ShowCard` taşıyor ve o keşfet/akış ekranlarında kullanılıyor;
    // profil ise poster-only olan bu listeye geçmişti.
    //
    // 🔑 RENK TEK KAYNAKTAN (`utils/progressBarColor.ts`): bırakıldı=turuncu ·
    // tamamlandı=yeşil · devam ediyor=mavi. Burada YENİ bir renk kuralı
    // yazmak, aynı diziyi iki ekranda farklı renkte gösterirdi.
    // Kaynağa göre kimlik farklı yerde durabiliyor (`handleCardPress`'in
    // aynı savunması) — hepsini dene, bulamazsan çubuk hiç çizilmez.
    const traktId = item.rawTraktId ?? item.show?.ids?.trakt ?? item.ids?.trakt ?? item.traktId ?? item.id;
    const ilerleme = type === 'show' && traktId ? showProgressMap?.[traktId] : null;
    const varMi = !!ilerleme && ilerleme.aired > 0 && ilerleme.completed > 0;
    const yuzde = varMi ? (ilerleme.completed / ilerleme.aired) * 100 : 0;
    const bitti = varMi && ilerleme.completed >= ilerleme.aired;
    const birakildi = !!traktId && !!hiddenShowIds?.includes?.(traktId);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => handleCardPress(item)}
      >
        {type === 'list' ? (
          <View style={[styles.poster, styles.listPosterFallback]}>
            <Text style={styles.listPosterText}>{item.title}</Text>
          </View>
        ) : (
          <MediaPoster
            tmdbId={item.tmdbId || item.show?.ids?.tmdb || item.movie?.ids?.tmdb}
            type={type as 'show' | 'movie'}
            title={item.title || item.show?.title || item.movie?.title}
            style={styles.poster}
          />
        )}
        {varMi && (
          <ProgressBar
            percentage={yuzde}
            fillColor={getProgressBarColor(birakildi, bitti)}
            style={styles.ilerleme}
          />
        )}
      </TouchableOpacity>
    );
  }, [type, handleCardPress, showProgressMap, hiddenShowIds]);

  if (!data || data.length === 0) {
    return null; // Eğer veri yoksa kategoriyi hiç gösterme
  }

  return (
    <View style={styles.container}>
      <SectionHeader
        title={title}
        icon={titleIcon}
        iconTint={titleTint}
        onSeeAll={onShowAll}
        seeAllLabel={seeAllLabel}
      />

      {/* Yatay Liste (FlatList ile optimize edildi, yüzlerce resimde kasmaması için) */}
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={renderCard}
        getItemLayout={getItemLayout}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={3}
        removeClippedSubviews={Platform.OS !== 'web'}
      />
    </View>
  );
});

export default HorizontalShowList;

const styles = StyleSheet.create({
  container: {
    marginBottom: SECTION_SPACING,
  },
  listContent: {
    paddingHorizontal: SECTION_PADDING_H,
    gap: GAP, // FlatList 'gap' destekler (React Native >= 0.71) — getItemLayout ile senkron
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#172033',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2A364F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  placeholderText: {
    color: '#a3a3a3',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  listPosterFallback: {
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  // 🔴 MUTLAK KONUM, POSTERİN DİBİNDE — `ShowCard`'daki `progressBar` ile AYNI.
  //
  // İlk denemede `marginTop: 6` ile posterin ALTINA konmuştu ve cihazda HİÇ
  // görünmedi (kullanıcı raporu, 2026-09-12). Sebep: `styles.card` SABİT
  // yükseklikte (`height: CARD_HEIGHT`) ve `overflow: 'hidden'`; poster o
  // yüksekliğin %100'ünü kaplıyor. Akış içinde eklenen çubuk kartın dışına
  // taşıyor ve KIRPILIYOR — yani çiziliyordu ama görünmüyordu.
  // 🎓 Sabit yükseklikli + `overflow: hidden` bir kaba akışla eleman eklemek
  // sessizce kaybolur; bindirme (absolute) tek doğru yol.
  ilerleme: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  listPosterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  }
});

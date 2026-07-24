import React, { useCallback, useMemo, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import PosterGridSkeleton from '../components/skeletons/PosterGridSkeleton';
import { Inbox, SearchX } from 'lucide-react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import MediaPoster from '../components/MediaPoster';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { generateMediaSlug } from '../utils/slugHelper';
import { useLibraryTypeData, getLibraryTitleKey, LibraryItem } from '../hooks/useLibraryTypeData';
import { useLibraryFilters } from '../hooks/useLibraryFilters';
import LibraryFilterBar from '../components/library/LibraryFilterBar';
import LibraryFilterModal from '../components/library/LibraryFilterModal';

const SPACING = 8;
// Sütun sayısı SABİT: FlatList'te numColumns çalışma anında değişirse React
// Native "Changing numColumns on the fly is not supported" ile patlıyor. Bu
// yüzden sütun sayısı asla türetilmez, hücre GENİŞLİĞİ ekran genişliğine göre
// hesaplanır.
const NUM_COLUMNS = 3;

interface GridItemProps {
  item: LibraryItem;
  type: string | string[] | undefined;
  cardStyle: StyleProp<ViewStyle>;
  onPress: (item: LibraryItem) => void;
}

const LibraryGridItem = memo(({ item, type, cardStyle, onPress }: GridItemProps) => (
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
  </TouchableOpacity>
));

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { t } = useTranslation('navigation');

  // Modül seviyesinde `Dimensions.get('window')` okumak ekran döndüğünde /
  // katlanabilir cihaz açıldığında ESKİ genişlikte kalıyordu: kartlar taşıyor,
  // getItemLayout gerçek satır yüksekliğinden sapıp kaydırma sıçratıyordu.
  const { width } = useWindowDimensions();

  const { data, loading } = useLibraryTypeData(type, accessToken);

  // Süzme "Diziler" ve "Filmler" ekranlarında açık; favoriler ve listeler
  // bilerek dokunulmadan eski davranışlarını sürdürüyor.
  const [filterOpen, setFilterOpen] = useState(false);
  const {
    enabled: supportsFilters,
    filteredData,
    searchInput,
    setSearchInput,
    clearSearch,
    activeStatuses,
    applyStatuses,
    isFiltering,
    options: filterOptions,
    filterTitle,
  } = useLibraryFilters(data, type);

  // Hücre boyutları tam piksele yuvarlanır: yuvarlanmazsa getItemLayout'un
  // bildirdiği yükseklik ile RN'in gerçekte render ettiği (piksele yuvarlanmış)
  // hücre arasında satır başına küsurat farkı birikir.
  const metrics = useMemo(() => {
    const cardWidth = Math.round((width - SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS);
    const cardHeight = Math.round(cardWidth * 1.5);
    return { cardWidth, cardHeight, rowHeight: cardHeight + SPACING };
  }, [width]);

  // Nesne referansı yalnızca genişlik değişince yenilenir — `memo`'lu hücreler
  // her render'da boşuna yeniden çizilmez.
  const cardStyle = useMemo<StyleProp<ViewStyle>>(
    () => [styles.card, { width: metrics.cardWidth, height: metrics.cardHeight }],
    [metrics.cardWidth, metrics.cardHeight]
  );

  const handleItemPress = useCallback((item: LibraryItem) => {
    if (!item.id) return;
    if (type === 'lists') {
      router.push(`/list/${item.id}?name=${encodeURIComponent(item.title || '')}`);
    } else {
      const routeType = type === 'shows' || type === 'favShows' ? 'show' : 'movie';
      const slug = generateMediaSlug(item.id, undefined, item.title);
      router.push(`/${routeType}/${slug}?tmdbId=${item.tmdbId || ''}`);
    }
  }, [type, router]);

  const renderItem = useCallback(({ item }: { item: LibraryItem }) => (
    <LibraryGridItem item={item} type={type} cardStyle={cardStyle} onPress={handleItemPress} />
  ), [type, cardStyle, handleItemPress]);

  const keyExtractor = useCallback((item: LibraryItem) => item.key, []);

  // DİKKAT — buraya gelen `index` ZATEN SATIR İNDEKSİDİR, öğe indeksi DEĞİL.
  // `numColumns > 1` iken FlatList, VirtualizedList'e listeyi satır satır verir:
  // `getItemCount` = Math.ceil(data.length / numColumns) ve `getItem` bir satırın
  // `numColumns` kadar öğesini tek bir dizi olarak döndürür
  // (node_modules/react-native/Libraries/Lists/FlatList.js — `_getItem`,
  // `_getItemCount`, `_keyExtractor` hepsi `index * numColumns + kk` kullanır).
  // Buna karşılık `getItemLayout` VirtualizedList'e HİÇ DOKUNULMADAN aktarılır.
  //
  // ESKİ HATA: burada `Math.floor(index / NUM_COLUMNS)` ile bir kez DAHA bölünüyordu.
  // Sonuç: ardışık üç satır aynı offset'i alıyor ve offset gerçeğin 1/3'ü hızında
  // büyüyordu. VirtualizedList'in kare (frame) verilerinden hesapladığı toplam
  // içerik yüksekliği, gerçekte ölçülen yüksekliğin ~1/3'ü çıkıyordu; kullanıcı
  // listenin gerçek sonuna inip biraz daha kaydırdığında bu iki değer
  // çeliştiği için VirtualizedList bir scroll-offset düzeltmesi uyguluyor,
  // ekran 1-2 saniyeliğine "yenileniyormuş gibi" sıçrayıp geri geliyordu.
  // (Daha önce bu semptom küsurat birikmesi sanılıp piksele yuvarlamayla
  // çözülmeye çalışılmıştı; gerçek sapma küsurat değil 3 KATLIK bir çarpandı,
  // bu yüzden çözülmemişti.)
  const getItemLayout = useCallback((_data: any, rowIndex: number) => ({
    length: metrics.rowHeight,
    offset: SPACING + metrics.rowHeight * rowIndex,
    index: rowIndex,
  }), [metrics.rowHeight]);

  const title = t(getLibraryTitleKey(type));
  const caption = isFiltering
    ? t('filteredCount', { shown: filteredData.length, total: data.length })
    : t('totalCount', { count: data.length, title });

  const hasData = data.length > 0;
  const noMatches = hasData && filteredData.length === 0;

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 28 }} />
      </View>

      {!loading && hasData ? (
        supportsFilters ? (
          <LibraryFilterBar
            value={searchInput}
            onChangeText={setSearchInput}
            onClear={clearSearch}
            onOpenFilters={() => setFilterOpen(true)}
            activeFilterCount={activeStatuses.length}
            placeholder={t('searchInList', 'Bu listede ara')}
            filterLabel={t('filterAction', 'Filtrele')}
            caption={caption}
          />
        ) : (
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>{caption}</Text>
          </View>
        )
      ) : null}

      {loading ? (
        <PosterGridSkeleton columns={NUM_COLUMNS} cardWidth={metrics.cardWidth} cardHeight={metrics.cardHeight} paddingHorizontal={SPACING} gap={SPACING} />
      ) : !hasData ? (
        <View style={styles.centered}>
          <View style={styles.emptyIconWrap}>
            <Inbox size={36} color="#334155" />
          </View>
          <Text style={styles.emptyTitle}>{t('libraryEmptyTitle', 'Burada henüz bir şey yok')}</Text>
          <Text style={styles.emptyText}>{t('libraryEmptyText', 'İçerik ekledikçe burada görünecek.')}</Text>
        </View>
      ) : noMatches ? (
        <View style={styles.centered}>
          <View style={styles.emptyIconWrap}>
            <SearchX size={36} color="#334155" />
          </View>
          <Text style={styles.emptyTitle}>{t('noMatchTitle', 'Sonuç bulunamadı')}</Text>
          <Text style={styles.emptyText}>{t('noMatchText', 'Aramayı veya seçtiğin filtreleri değiştirmeyi dene.')}</Text>
        </View>
      ) : (
        <FlatList
          // Sütun sayısı sabit olsa da anahtara bağlamak, ileride NUM_COLUMNS
          // değiştirilirse RN'i çökerten "on the fly" değişimi yerine güvenli
          // bir yeniden mount'a çevirir.
          key={`library-grid-${NUM_COLUMNS}`}
          data={filteredData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContainer}
          getItemLayout={getItemLayout}
          ListFooterComponent={<View style={{ height: 40 }} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // Android'de ekran dışına çıkan hücrelerin native görünümlerini
          // söktürerek bellek baskısını düşürür. iOS'ta bilerek KAPALI: orada
          // grid ile birlikte listenin sonundaki elastik geri sekmede hücreler
          // hızla clip/unclip olup boş/karışık render üretiyordu.
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={12}
          maxToRenderPerBatch={9}
          windowSize={7}
          updateCellsBatchingPeriod={50}
        />
      )}

      {supportsFilters ? (
        <LibraryFilterModal
          visible={filterOpen}
          options={filterOptions}
          selected={activeStatuses}
          title={filterTitle}
          onApply={applyStatuses}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#171717',
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  statsText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  gridContainer: {
    padding: SPACING,
  },
  card: {
    margin: SPACING / 2,
    backgroundColor: '#172033',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  poster: {
    width: '100%',
    height: '100%',
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

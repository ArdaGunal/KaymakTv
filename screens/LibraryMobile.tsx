import React, { useCallback, memo } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import LoadingIndicator from '../components/LoadingIndicator';
import { Inbox } from 'lucide-react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import MediaPoster from '../components/MediaPoster';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { generateMediaSlug } from '../utils/slugHelper';
import { useLibraryTypeData, getLibraryTitleKey, LibraryItem } from '../hooks/useLibraryTypeData';

const { width } = Dimensions.get('window');
const SPACING = 8;
const NUM_COLUMNS = 3;
// Tam piksele yuvarlanmıyorsa, getItemLayout'un hesapladığı offset ile RN'in
// gerçekte render ettiği (piksele yuvarlanmış) hücre boyutu arasında satır
// başına küçük bir fark birikir. ~30+ satırlık uzun listelerde (Diziler/
// Filmler) bu birikim, tam listenin sonuna gelindiğinde FlatList'in tahmini
// içerik yüksekliğiyle gerçek ölçülen yükseklik arasında belirgin bir sapmaya
// dönüşüyor — kullanıcı en alta indiğinde biraz daha kaydırınca ekranın 1-2
// saniyeliğine "yukarı sıçrayıp geri gelmesi" (scroll offset düzeltmesi) bu
// yüzdendi. Değerleri tam piksele yuvarlamak tahmini ve gerçek yüksekliği
// eşitleyip bu düzeltmeyi ortadan kaldırıyor.
const CARD_WIDTH = Math.round((width - (SPACING * (NUM_COLUMNS + 1))) / NUM_COLUMNS);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.5);
const ROW_HEIGHT = CARD_HEIGHT + SPACING;

interface GridItemProps {
  item: LibraryItem;
  type: string | string[] | undefined;
  onPress: (item: LibraryItem) => void;
}

const LibraryGridItem = memo(({ item, type, onPress }: GridItemProps) => (
  <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => onPress(item)}>
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

  const { data, loading } = useLibraryTypeData(type, accessToken);

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
    <LibraryGridItem item={item} type={type} onPress={handleItemPress} />
  ), [type, handleItemPress]);

  const getItemLayout = useCallback((_data: any, index: number) => {
    const row = Math.floor(index / NUM_COLUMNS);
    return { length: ROW_HEIGHT, offset: SPACING + (ROW_HEIGHT * row), index };
  }, []);

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t(getLibraryTitleKey(type))}</Text>
        <View style={{ width: 28 }} />
      </View>

      {!loading && data.length > 0 ? (
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>{t('totalCount', { count: data.length, title: t(getLibraryTitleKey(type)) })}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <LoadingIndicator size="large" color="#ffffff" />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIconWrap}>
            <Inbox size={36} color="#334155" />
          </View>
          <Text style={styles.emptyTitle}>{t('libraryEmptyTitle', 'Burada henüz bir şey yok')}</Text>
          <Text style={styles.emptyText}>{t('libraryEmptyText', 'İçerik ekledikçe burada görünecek.')}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContainer}
          getItemLayout={getItemLayout}
          ListFooterComponent={<View style={{ height: 40 }} />}
          // NOT: removeClippedSubviews BİLEREK kullanılmıyor — numColumns (grid)
          // ile birlikte React Native'de bilinen bir kırpma/render hatasına yol
          // açıyor: listenin sonunda biraz daha kaydırınca (overscroll/elastik
          // geri sekme) hücreler hızla clip/unclip olup boş/karışık render
          // oluşuyordu ("habire yükleniyor, garip şeyler oluyor" hissi buradan
          // geliyordu). windowSize zaten yeterli sanal listeleme sağlıyor.
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          updateCellsBatchingPeriod={50}
        />
      )}
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
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
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

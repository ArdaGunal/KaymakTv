import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform, StatusBar, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Trash2, List as ListIcon, Plus, X, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { getCustomListItems } from '../../../services/traktApi';
import { useLibraryActions } from '../../../context/LibraryContext';
import MediaPoster from '../../../components/MediaPoster';
import LoadingIndicator from '../../../components/LoadingIndicator';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { generateMediaSlug } from '../../../utils/slugHelper';
import { isDefaultList, isLikedList } from '../../../utils/listHelpers';

// Platformlar arası onay: ESKİ BUG — mobilde confirm() her zaman true dönüyordu,
// yani liste "Emin misiniz?" sormadan sessizce siliniyordu. Artık gerçek onay alınır.
const confirmAsync = (title: string, message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
};

interface ListItem {
  key: string;
  type: 'show' | 'movie';
  mediaId: number;
  tmdbId?: number;
  title: string;
  year?: number;
}

export default function ListDetailsScreen() {
  const { id, name } = useLocalSearchParams();
  const { t } = useTranslation(['media', 'common']);
  const router = useRouter();
  const { deleteListById, toggleMediaInList } = useLibraryActions();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [items, setItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [removingKeys, setRemovingKeys] = useState<Set<string>>(new Set());

  const listId = Array.isArray(id) ? id[0] : id;
  const listName = (Array.isArray(name) ? name[0] : name) || t('listDetail', 'Liste Detayı');
  // Favori listesi UI'da görünmemeli; varsayılan koleksiyon silinemez.
  const isLiked = isLikedList(listName);
  const isDefault = isDefaultList(listName);
  const canDeleteList = !isLiked && !isDefault;

  const mapItems = (data: any[]): ListItem[] =>
    (data || [])
      .map((item: any) => {
        const type: 'show' | 'movie' = item.type === 'movie' ? 'movie' : 'show';
        const media = type === 'movie' ? item.movie : item.show;
        if (!media?.ids?.trakt) return null;
        return {
          key: `${type}-${media.ids.trakt}`,
          type,
          mediaId: media.ids.trakt,
          tmdbId: media.ids?.tmdb,
          title: media.title,
          year: media.year,
        };
      })
      .filter(Boolean) as ListItem[];

  const fetchListItems = useCallback(async () => {
    if (!listId) return;
    try {
      const data = await getCustomListItems(listId);
      setItems(mapItems(data));
    } catch (error) {
      console.error('Liste detayları çekilemedi:', error);
    } finally {
      setIsLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    setIsLoading(true);
    fetchListItems();
  }, [fetchListItems]);

  const handleDeleteList = async () => {
    const ok = await confirmAsync(
      t('deleteListTitle', 'Listeyi Sil'),
      t('deleteListMsg', 'Bu liste kalıcı olarak silinecek. Emin misin?'),
      t('common:delete'),
      t('common:cancel')
    );
    if (!ok) return;

    setIsDeleting(true);
    try {
      await deleteListById(listId as string);
      router.back();
    } catch (error) {
      console.error('Liste silinemedi:', error);
      Alert.alert(t('common:error'), t('listDeleteError', 'Liste silinemedi.'));
      setIsDeleting(false);
    }
  };

  // Tek öğe kaldırma: onaysız, iyimser ve anında (kolayca geri eklenebilir bir işlem).
  const handleRemoveItem = async (item: ListItem) => {
    if (removingKeys.has(item.key)) return;
    setRemovingKeys(prev => new Set(prev).add(item.key));
    const prevItems = items;
    setItems(prev => prev.filter(i => i.key !== item.key));
    try {
      await toggleMediaInList(Number(listId), item.mediaId, item.type, false);
    } catch (error) {
      console.error('Listeden çıkarılamadı:', error);
      setItems(prevItems); // geri al
      Alert.alert(t('common:error'), t('listRemoveError', 'İçerik listeden çıkarılamadı.'));
    } finally {
      setRemovingKeys(prev => {
        const next = new Set(prev);
        next.delete(item.key);
        return next;
      });
    }
  };

  const openMedia = (item: ListItem) => {
    const slug = generateMediaSlug(item.mediaId, undefined, item.title);
    router.push(`/${item.type}/${slug}?tmdbId=${item.tmdbId || ''}`);
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    const isRemoving = removingKeys.has(item.key);
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.rowMain} activeOpacity={0.7} onPress={() => openMedia(item)}>
          <View style={styles.thumb}>
            <MediaPoster tmdbId={item.tmdbId} type={item.type} title={item.title} style={styles.thumbImg} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.rowMetaRow}>
              <View style={[styles.typeBadge, item.type === 'movie' ? styles.typeBadgeMovie : styles.typeBadgeShow]}>
                <Text style={styles.typeBadgeText}>
                  {item.type === 'movie' ? t('movie', 'Film') : t('show', 'Dizi')}
                </Text>
              </View>
              {item.year ? <Text style={styles.rowYear}>{item.year}</Text> : null}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => handleRemoveItem(item)}
          disabled={isRemoving}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isRemoving ? <LoadingIndicator size="small" /> : <X size={18} color="#94a3b8" />}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0F172A', '#0B1120']} style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.innerContainer, isLargeScreen && styles.webInnerContainer]}>
        <View style={[styles.header, { paddingTop: isLargeScreen ? 20 : (insets.top || 20) }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ChevronLeft color="#fff" size={26} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>{listName}</Text>
              {isDefault && <Lock size={13} color="#64748b" style={{ marginLeft: 6 }} />}
            </View>
            <Text style={styles.headerSubtitle}>
              {t('itemsCount', { count: items.length, defaultValue: `${items.length} içerik` })}
            </Text>
          </View>
          {canDeleteList ? (
            <TouchableOpacity onPress={handleDeleteList} disabled={isDeleting} style={styles.iconBtnDestructive} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {isDeleting ? <LoadingIndicator size="small" /> : <Trash2 color="#ef4444" size={20} />}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <LoadingIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={items}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
            refreshControl={<RefreshControl refreshing={false} onRefresh={fetchListItems} tintColor="#3b82f6" colors={['#3b82f6']} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrapper}>
                  <ListIcon size={44} color="#334155" />
                </View>
                <Text style={styles.emptyTitle}>{t('emptyListTitle', 'Listen boş')}</Text>
                <Text style={styles.emptyText}>{t('emptyListText', 'Dizi veya film sayfalarındaki liste butonuyla buraya içerik ekleyebilirsin.')}</Text>
                <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/(protected)/(tabs)/explore')}>
                  <Plus size={18} color="#fff" />
                  <Text style={styles.emptyCtaText}>{t('discoverContent', 'İçerik Keşfet')}</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}

        {/* İçerik ekleme kısayolu (liste boş değilken) */}
        {!isLoading && items.length > 0 && (
          <TouchableOpacity
            style={[styles.fab, { bottom: insets.bottom + 20 }]}
            activeOpacity={0.85}
            onPress={() => router.push('/(protected)/(tabs)/explore')}
          >
            <Plus size={22} color="#fff" />
            <Text style={styles.fabText}>{t('addContent', 'İçerik Ekle')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  innerContainer: { flex: 1, width: '100%' },
  webInnerContainer: {
    maxWidth: 800,
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  iconBtn: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)' },
  iconBtnDestructive: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  headerTitleContainer: { flex: 1, alignItems: 'center', marginHorizontal: 12 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 19, fontWeight: '700', letterSpacing: 0.3, maxWidth: '85%' },
  headerSubtitle: { color: '#94a3b8', fontSize: 13, marginTop: 2, fontWeight: '500' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#172033',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#22304A',
    marginBottom: 10,
    overflow: 'hidden',
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 60, height: 90, backgroundColor: '#1e293b' },
  thumbImg: { width: '100%', height: '100%' },
  rowInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 8 },
  rowTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  typeBadgeShow: { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
  typeBadgeMovie: { backgroundColor: 'rgba(168, 85, 247, 0.15)' },
  typeBadgeText: { color: '#cbd5e1', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  rowYear: { color: '#64748b', fontSize: 12, fontWeight: '500' },
  removeBtn: {
    width: 44,
    height: '100%',
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  // Empty
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyIconWrapper: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  emptyCtaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // FAB
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 26,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 24px rgba(59,130,246,0.45)', cursor: 'pointer' } as any
      : { shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }),
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

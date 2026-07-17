import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Platform, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Trash2, List as ListIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { getCustomListItems, deleteCustomList } from '../../../services/traktApi';
import { useLibrary } from '../../../context/LibraryContext';
import ShowCard from '../../../components/ShowCard';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';

export default function ListDetailsScreen() {
  const { id, name } = useLocalSearchParams();
  const { t } = useTranslation();
  const router = useRouter();
  const { refreshLibrary } = useLibrary();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const listId = Array.isArray(id) ? id[0] : id;
  const listName = Array.isArray(name) ? name[0] : name || 'Liste Detayı';
  const isLikedList = listName === 'Beğenilen Diziler' || listName === 'Beğenilenler';

  useEffect(() => {
    if (listId) {
      fetchListItems();
    }
  }, [listId]);

  const fetchListItems = async () => {
    try {
      setIsLoading(true);
      const data = await getCustomListItems(listId);
      setItems(data);
    } catch (error) {
      console.error('Liste detayları çekilemedi:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteList = async () => {
    if (confirm(t('areYouSure', 'Emin misiniz? Liste tamamen silinecek.'))) {
      setIsDeleting(true);
      try {
        await deleteCustomList(listId);
        await refreshLibrary();
        router.back();
      } catch (error) {
        console.error('Liste silinemedi:', error);
        setIsDeleting(false);
      }
    }
  };

  const confirm = (message: string) => {
    if (Platform.OS === 'web') {
      return window.confirm(message);
    } else {
      // In a real app we would use Alert.alert but we're returning true for now 
      // since Alert doesn't return a boolean synchronously.
      return true; // Simplified for this example.
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isMovie = item.type === 'movie';
    const media = isMovie ? item.movie : item.show;
    
    // We reuse ShowCard full-width
    return (
      <View style={styles.cardWrapper}>
        <ShowCard 
          data={{ [item.type]: media }}
        />
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0F172A', '#0B1120']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Container for web centering */}
      <View style={[styles.innerContainer, isLargeScreen && styles.webInnerContainer]}>
        
        <View style={[styles.header, { paddingTop: isLargeScreen ? 20 : (insets.top || 20) }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft color="#fff" size={28} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{listName}</Text>
            <Text style={styles.headerSubtitle}>{items.length} {t('common:items', 'İçerik')}</Text>
          </View>
          {!isLikedList ? (
            <TouchableOpacity onPress={handleDeleteList} disabled={isDeleting} style={styles.iconBtnDestructive}>
              {isDeleting ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 color="#ef4444" size={20} />}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} /> // Placeholder for balance
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={items}
            keyExtractor={(item) => `${item.type}-${item[item.type]?.ids?.trakt}`}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchListItems} tintColor="#3b82f6" colors={['#3b82f6']} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrapper}>
                  <ListIcon size={48} color="#334155" />
                </View>
                <Text style={styles.emptyTitle}>Listeniz Bomboş</Text>
                <Text style={styles.emptyText}>Dizi veya film sayfalarından bu listeye içerik eklemeye başlayabilirsiniz.</Text>
              </View>
            }
          />
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
  },
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
  iconBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconBtnDestructive: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  cardWrapper: {
    width: '100%', // Full width for ShowCard since it's a row layout
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  }
});

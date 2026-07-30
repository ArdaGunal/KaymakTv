import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import NetworkUserCard from '../../../../features/publicProfile/components/NetworkUserCard';
import { useNetworkList } from '../../../../hooks/useNetworkList';
import { TraktUserProfile } from '../../../../services/api/social';

export default function NetworkScreen() {
  const { slug: rawSlug, type: rawType } = useLocalSearchParams();
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug ?? null;
  const initialType = (Array.isArray(rawType) ? rawType[0] : rawType) as 'followers' | 'following' || 'followers';
  
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['feed', 'media']);

  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialType);

  const { data, isLoading, fetchNextPage, isFetchingNextPage, isStoreLoading } = useNetworkList(slug, activeTab);

  // Not: connectionState burada store'dan OKUNMUYOR — bu ekran zaten
  // `isStoreLoading` bitene kadar (yani followStore.fetchFollowingSlugs
  // tamamlanana kadar) FlatList'i hiç render etmiyor, NetworkUserCard kendi
  // güncel durumunu içeride bir Zustand seçicisiyle doğrudan okuyor (bkz.
  // hooks/useFollowState.ts). Burada `connectionStates`'in TAMAMINA abone
  // olmak, listedeki HERHANGİ bir kullanıcının takip durumu değiştiğinde bu
  // ekranın (ve dolayısıyla FlatList'in) gereksiz yere yeniden render
  // olmasına yol açardı — kalabalık takipçi listelerinde performans sorunu.
  const renderItem = ({ item }: { item: TraktUserProfile }) => (
    <NetworkUserCard user={item} initialConnectionState="none" />
  );

  return (
    <LinearGradient colors={['#0F172A', '#0B1120']} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top || 20 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft color="#fff" size={26} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {slug === 'me' ? t('media:network', 'Ağım') : `@${slug}`}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.contentWrapper}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'followers' && styles.activeTab]} onPress={() => setActiveTab('followers')}>
            <Text style={[styles.tabText, activeTab === 'followers' && styles.activeTabText]}>{t('media:profileFollowers', 'Takipçiler')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'following' && styles.activeTab]} onPress={() => setActiveTab('following')}>
            <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>{t('media:profileFollowing', 'Takip Edilenler')}</Text>
          </TouchableOpacity>
        </View>

        {isLoading || isStoreLoading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item, index) => (item.ids?.slug || item.username) + index}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
            onEndReached={fetchNextPage}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 20 }} />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>{t('feed:noUsersFound', 'Bu listede kimse yok.')}</Text>
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
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    marginHorizontal: 'auto',
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 40,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#22304A',
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#f8fafc',
  },
  listContent: {
    paddingTop: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
});

import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Rss, WifiOff, ArrowUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeedCard from '../../../features/feed/components/FeedCard';
import MarathonFeedCard from '../../../features/feed/components/MarathonFeedCard';
import FeedSkeleton from '../../../features/feed/components/FeedSkeleton';
import UserSearchBar from '../../../features/feed/components/UserSearchBar';
import UserProfileCard from '../../../features/feed/components/UserProfileCard';
import { useFeed } from '../../../features/feed/hooks/useFeed';
import { useUserSearch } from '../../../features/feed/hooks/useUserSearch';
import { FeedItem, isMarathonActivity } from '../../../features/feed/types';

const DESKTOP_BREAKPOINT = 768;

export default function FeedScreen() {
  const { t } = useTranslation(['navigation', 'feed']);
  const {
    data,
    isLoading,
    isRefreshing,
    hasError,
    isLoadingMore,
    hasMore,
    unseenCount,
    markSeen,
    refresh,
    loadMore,
  } = useFeed();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const search = useUserSearch();
  const listRef = useRef<FlatList<FeedItem>>(null);

  const hasSearchResult = !!search.profile || !!search.error;

  // "N yeni gönderi" — kullanıcı listeyi kaydırmışken canlı bir aktivite
  // geldiğinde içeriği ayağının altından KAYDIRMAK yerine (okuduğu yeri
  // kaybeder) üstte bir rozet gösterip kararı ona bırakıyoruz. Sosyal
  // akışların standart deseni.
  const handleJumpToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    markSeen();
  }, [markSeen]);

  // Kullanıcı listenin tepesine geldiyse rozet anlamını yitirir — otomatik sıfırla.
  const handleScroll = useCallback(
    (e: any) => {
      if (e.nativeEvent.contentOffset.y <= 8 && unseenCount > 0) markSeen();
    },
    [unseenCount, markSeen]
  );

  // "Veri yok" ile "yüklenemedi" AYRI durumlar. Eskiden hata sessizce yutulup
  // liste boş bırakılıyordu; kullanıcı gerçek bir ağ/veritabanı hatasında
  // "Akışın Boş — takip ettiğin kişilerin aktiviteleri burada görünecek"
  // yazısını görüyor, yani uygulama ona YANLIŞ bilgi veriyordu.
  const showError = hasError && data.length === 0;

  // Sonsuz kaydırmanın alt bilgisi. Üç durum:
  //   - yükleniyor  → spinner
  //   - devamı yok  → "hepsi bu kadar" (liste boş değilse; boş listede
  //                    zaten ListEmptyComponent konuşuyor)
  //   - devamı var  → hiçbir şey (spinner yalnızca istek uçarken görünsün)
  const renderFooter = useCallback(() => {
    if (isLoadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color="#38bdf8" />
        </View>
      );
    }
    if (!hasMore && data.length > 0) {
      return (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('feed:endOfFeed', 'Hepsi bu kadar')}</Text>
        </View>
      );
    }
    return null;
  }, [isLoadingMore, hasMore, data.length, t]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        <Text style={styles.title}>{t('feed', 'Akış')}</Text>

        <UserSearchBar
          query={search.query}
          onChangeQuery={search.setQuery}
          onSubmit={search.search}
          onClear={search.clear}
          isSearching={search.isSearching}
          hasResult={hasSearchResult}
        />

        {hasSearchResult && (
          <UserProfileCard
            profile={search.profile}
            error={search.error}
            connectionState={search.connectionState}
            isLoadingConnection={search.isLoadingConnection}
            isFollowPending={search.isFollowPending}
            onToggleFollow={search.toggleFollow}
          />
        )}

        {isLoading ? (
          <FeedSkeleton />
        ) : (
          <FlatList<FeedItem>
            ref={listRef}
            onScroll={handleScroll}
            scrollEventThrottle={64}
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) =>
              isMarathonActivity(item)
                ? <MarathonFeedCard activity={item} />
                : <FeedCard activity={item} />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            // Sonsuz kaydırma. 0.5 = ekranın bir boyu kadar mesafe kala
            // tetiklenir; kullanıcı boşluğa çarpmadan sonraki sayfa gelir.
            // Eşzamanlı tetiklemelere karşı koruma `useFeed.loadMore`'da
            // (uçuştaki istek referansı) — bu callback güvenle birden fazla
            // kez çağrılabilir.
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#3b82f6" />
            }
            ListEmptyComponent={
              showError ? (
                <View style={styles.emptyState}>
                  <WifiOff size={40} color="#334155" />
                  <Text style={styles.emptyTitle}>{t('feed:errorTitle', 'Akış Yüklenemedi')}</Text>
                  <Text style={styles.emptyText}>
                    {t('feed:errorText', 'Bağlantını kontrol edip tekrar dene.')}
                  </Text>
                  <TouchableOpacity style={styles.retryButton} onPress={refresh} activeOpacity={0.8}>
                    <Text style={styles.retryButtonText}>{t('feed:retry', 'Tekrar Dene')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Rss size={40} color="#334155" />
                  <Text style={styles.emptyTitle}>{t('feed:emptyTitle', 'Akışın Boş')}</Text>
                  <Text style={styles.emptyText}>
                    {t('feed:emptyText', "Trakt'ta takip ettiğin kişilerin izleme aktiviteleri burada görünecek.")}
                  </Text>
                </View>
              )
            }
          />
        )}

        {/* Canlı gelen aktiviteler için "yukarı çık" rozeti — listenin
            ÜSTÜNDE (absolute) durur, içeriği kaydırmaz. */}
        {unseenCount > 0 && (
          <TouchableOpacity style={styles.newPostsPill} onPress={handleJumpToTop} activeOpacity={0.85}>
            <ArrowUp size={14} color="#0B1120" />
            <Text style={styles.newPostsPillText}>
              {t('feed:newPosts', '{{count}} yeni gönderi', { count: unseenCount })}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 680,
    alignSelf: 'center',
  },
  title: {
    color: '#f1f5f9',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  retryButtonText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  newPostsPill: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: '#38bdf8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 20,
  },
  newPostsPillText: {
    color: '#0B1120',
    fontSize: 13,
    fontWeight: '800',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

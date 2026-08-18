import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { Rss, WifiOff, ArrowUp, RefreshCw, CloudOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeedCard from '../../../features/feed/components/FeedCard';
import MarathonFeedCard from '../../../features/feed/components/MarathonFeedCard';
import FeedSkeleton from '../../../features/feed/components/FeedSkeleton';
import UserSearchBar from '../../../features/feed/components/UserSearchBar';
import UserProfileCard from '../../../features/feed/components/UserProfileCard';
import ComposePostBar from '../../../features/feed/components/ComposePostBar';
import ComposePostModal from '../../../features/feed/components/ComposePostModal';
import SectionErrorBoundary from '../../../components/SectionErrorBoundary';
import { useFeed } from '../../../features/feed/hooks/useFeed';
import { useUserSearch } from '../../../features/feed/hooks/useUserSearch';
import { useAuth } from '../../../context/AuthContext';
import { useFollowStore, selectIsFollowingListStale } from '../../../store/followStore';
import { FeedItem, isMarathonActivity } from '../../../features/feed/types';

const DESKTOP_BREAKPOINT = 768;

export default function FeedScreen() {
  const { t } = useTranslation(['navigation', 'feed']);
  const {
    data,
    isLoading,
    isRefreshing,
    hasError,
    loadMoreFailed,
    isLoadingMore,
    hasMore,
    unseenCount,
    markSeen,
    refresh,
    loadMore,
    deleteActivity,
  } = useFeed();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const search = useUserSearch();
  const listRef = useRef<FlatList<FeedItem>>(null);
  const { accessToken, isGuest } = useAuth();
  const [composeVisible, setComposeVisible] = useState(false);

  const hasSearchResult = !!search.profile || !!search.error;

  // "N yeni gönderi" — kullanıcı listeyi kaydırmışken canlı bir aktivite
  // geldiğinde içeriği ayağının altından KAYDIRMAK yerine (okuduğu yeri
  // kaybeder) üstte bir rozet gösterip kararı ona bırakıyoruz. Sosyal
  // akışların standart deseni.
  const handleJumpToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    markSeen();
  }, [markSeen]);

  // Takip listesi bayat mı (F6). Zustand selector'ü olduğu için store
  // değiştiğinde otomatik yeniden değerlendirilir; boolean döndüğü için
  // gereksiz render tetiklemez.
  const isFollowingListStale = useFollowStore(selectIsFollowingListStale);

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
    // Y21: "devamı yüklenemedi" ÜÇÜNCÜ dal. Bu olmadan spinner kayboluyor,
    // hiçbir mesaj çıkmıyordu ve kullanıcı en altta olduğu için onEndReached
    // bir daha tetiklenmiyordu — yani akışın bittiğini mi bozulduğunu mu
    // anlamanın hiçbir yolu yoktu. isLoadingMore'dan ÖNCE, çünkü hata
    // durumunda spinner zaten kapanmış oluyor.
    if (loadMoreFailed) {
      return (
        <View style={styles.loadMoreFailedBox}>
          <Text style={styles.loadMoreFailedText}>
            {t('feed:loadMoreFailed', 'Devamı yüklenemedi.')}
          </Text>
          <TouchableOpacity onPress={loadMore} style={styles.loadMoreRetryBtn} activeOpacity={0.8}>
            <Text style={styles.loadMoreRetryText}>{t('common:retry', 'Tekrar Dene')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

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
  }, [isLoadingMore, hasMore, data.length, loadMoreFailed, loadMore, t]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('feed', 'Akış')}</Text>

          {/* react-native-web'de RefreshControl bir no-op (bkz. node_modules/
              react-native-web/src/exports/RefreshControl — onRefresh'i hiç
              çağırmaz, sadece düz bir View render eder). Yani mobilde parmakla
              aşağı çekip yenileyebilirken web'de bunu tetiklemenin HİÇBİR yolu
              yoktu — realtime kısa süreliğine koparsa web kullanıcısı sekmeyi
              kapatıp açmadan asla tazeleyemezdi. Yalnızca web'de görünen bu
              buton aynı `refresh()`'i çağırarak parite sağlıyor. */}
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refresh}
              disabled={isRefreshing}
              activeOpacity={0.7}
            >
              <RefreshCw size={16} color={isRefreshing ? '#334155' : '#94a3b8'} />
            </TouchableOpacity>
          )}
        </View>

        {/* Arama çubuğu ÜSTTE sabit kalıyor — kullanıcı kararı: "Ne
            düşünüyorsun?" kutusu arama çubuğunun üstündeyken daha az fark
            ediliyordu, altına alınınca daha görünür oluyor. */}
        <UserSearchBar
          query={search.query}
          onChangeQuery={search.setQuery}
          onSubmit={search.search}
          onClear={search.clear}
          isSearching={search.isSearching}
          hasResult={hasSearchResult}
        />

        {/* "Ne düşünüyorsun?" kutusu — bağımsız gönderi ("Fikir Paylaş")
            özelliğinin TEK giriş noktası, kullanıcının kararı: FAB değil,
            akışın doğal bir parçası hissettiren sabit bir kutu. Misafirin
            paylaşacak bir kimliği yok, bu yüzden yalnızca gerçek kullanıcıya
            gösterilir (diğer feed-yazma eylemleriyle AYNI guard). */}
        {!!accessToken && !isGuest && (
          <ComposePostBar onPress={() => setComposeVisible(true)} />
        )}

        {/* Takip listesi tazelenemedi (F6) — AI_RULES §2: sessiz başarısızlık
            YASAK. Akış çalışmaya devam ediyor çünkü `followStore` son bilinen
            listeyi diskten koruyor, ama kullanıcının "bu liste güncel
            olmayabilir" bilgisine hakkı var: bu sırada takip ettiği yeni biri
            akışında görünmez.

            Blocker DEĞİL, Alert DEĞİL — sadece satır içi bir not. Yalnızca
            son deneme BAŞARISIZ *ve* eldeki liste TTL'i geçmişse görünür
            (bkz. selectIsFollowingListStale). */}
        {isFollowingListStale && (
          <View style={styles.staleNotice}>
            <CloudOff size={13} color="#f59e0b" />
            <Text style={styles.staleNoticeText}>
              {t('feed:followListStale', 'Takip listesi güncellenemedi — son bilinen hâli gösteriliyor.')}
            </Text>
          </View>
        )}

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
            /* Y20: her kart KENDİ hata sınırında. Bir kartın render istisnası
               (bozuk veya eksik alanlı bir satır) eskiden kök ErrorBoundary'ye
               kadar çıkıp TÜM AKIŞI ErrorFallback ekranına düşürüyordu.
               silent: bozuk kart sessizce atlanır, akış akmaya devam eder —
               hata logError ile kaydedildiği için bu sessizlik kayıp değil
               (Geliştirici Paneli hata kaydını görüyor). */
            renderItem={({ item }) => (
              <SectionErrorBoundary label={"feed-card:" + item.id} silent>
                {isMarathonActivity(item)
                  ? <MarathonFeedCard activity={item} onDeleteActivity={() => deleteActivity(item)} />
                  : <FeedCard activity={item} onDeleteActivity={() => deleteActivity(item)} />}
              </SectionErrorBoundary>
            )}
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

      <ComposePostModal visible={composeVisible} onClose={() => setComposeVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadMoreFailedBox: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  loadMoreFailedText: { color: '#94a3b8', fontSize: 12 },
  loadMoreRetryBtn: { paddingHorizontal: 16, paddingVertical: 7, backgroundColor: '#172033', borderRadius: 8 },
  loadMoreRetryText: { color: '#e5e5e5', fontSize: 12, fontWeight: '700' },
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  // Takip listesi bayat uyarısı (F6) — hata değil, bilgi. Bu yüzden kırmızı
  // değil amber ve kutunun kendisi düşük kontrastlı: akışı gölgelemeden
  // görünsün.
  staleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  staleNoticeText: {
    color: '#fbbf24',
    fontSize: 11,
    flex: 1,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  refreshButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
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

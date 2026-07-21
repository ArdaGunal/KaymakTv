import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { ArrowUp } from 'lucide-react-native';
import LoadingIndicator from '../../../components/LoadingIndicator';
import ShowCard from '../../../components/ShowCard';
import SearchBar from '../../../components/SearchBar';
import SearchTabs from '../../../components/SearchTabs';
import ExploreWebGrid from '../../../components/explore/ExploreWebGrid';
import { useExplore } from '../../../hooks/useExplore';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const DESKTOP_BREAKPOINT = 768;
// Bu kadar aşağı kaydırılınca "Yukarı Çık" butonu belirir.
const SCROLL_TOP_THRESHOLD = 240;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { t } = useTranslation(['media', 'navigation', 'common']);
  const { accessToken, isGuest } = useAuth();
  const router = useRouter();
  const desktopGridRef = useRef<FlatList<any>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleDesktopScroll = useCallback((offsetY: number) => {
    setShowScrollTop(offsetY > SCROLL_TOP_THRESHOLD);
  }, []);

  const scrollToTop = useCallback(() => {
    desktopGridRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const {
    loading,
    loadingMore,
    refreshing,
    error,
    searchQuery,
    activeTab,
    isSearching,
    currentData,
    setSearchQuery,
    setActiveTab,
    onRefresh,
    fetchMore,
  } = useExplore();

  // Auth guard
  if (!accessToken && !isGuest) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{t('exploreLoginReq')}</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/(protected)/account')}
        >
          <Text style={styles.settingsButtonText}>{t('common:goToSettings')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Mobil: arama çubuğu + Dizi/Film sekmesi, listenin DIŞINDA (üstünde) sabit
  // bir blok olarak render edilir — kullanıcı ne kadar aşağı kaydırırsa
  // kaydırsın her zaman görünür kalır.
  const renderPinnedBar = () => (
    <View style={styles.pinnedBar}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('exploreSearchPH')}
      />
      <SearchTabs activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );

  // Kaydırılabilir kısım: başlık + bölüm etiketi/boş durum metni — bunlar
  // sabitlenmez, listeyle birlikte kayar.
  const renderHeader = () => (
    <View style={isDesktop ? styles.headerContainerWeb : styles.headerContainer}>
      <Text style={[styles.headerTitle, isDesktop && styles.headerTitleWeb]}>
        {t('navigation:explore')}
      </Text>

      {!isSearching && (
        <Text style={styles.sectionTitle}>
          {activeTab === 'show' ? t('trendShows') : t('trendMovies')}
        </Text>
      )}
      {isSearching && !loading && currentData.length === 0 && (
        <Text style={styles.emptyText}>{t('common:noResults')}</Text>
      )}
    </View>
  );

  // Web: arama çubuğu artık `position: sticky` ile DEĞİL, mobildeki
  // `renderPinnedBar()` ile AYNI güvenilir desende — listenin/grid'in
  // TAMAMEN DIŞINDA, gerçek bir kardeş eleman olarak — her zaman görünür
  // kalıyor. Önceki `position: sticky` + yarı saydam siyah/blur yaklaşımı,
  // FlatList'in (react-native-web'de sanallaştırılmış/kaydırılan bir alt
  // ağaç) `ListHeaderComponent`'i içinde güvenilir çalışmıyordu: kaydırma
  // sırasında takılıp kalıyor, tepede "yapışık" görünüyor ve arkasındaki
  // koyu/siyah yarı saydam katman içerikle beklenmedik şekilde çakışıyordu.
  // Diziler/Filmler sekmesi ise SABİT DEĞİL — grid'in `ListHeaderComponent`'i
  // (aşağıdaki `renderDesktopScrollHeader`) içinde, sayfayla birlikte kayar.
  const renderDesktopSearchBar = () => (
    <View style={styles.desktopSearchBarWeb}>
      <View style={styles.desktopSearchInnerWeb}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('exploreSearchPH')}
          style={styles.searchBarFlexWeb}
        />
        {showScrollTop && (
          <TouchableOpacity
            style={styles.scrollTopBtnWeb}
            onPress={scrollToTop}
            activeOpacity={0.75}
          >
            <ArrowUp size={18} color="#e2e8f0" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Kaydırılabilir kısım: başlık + Diziler/Filmler sekmesi + bölüm etiketi —
  // bunlar sabitlenmez, `ExploreWebGrid`'in `ListHeaderComponent`'i olarak
  // içerikle birlikte kayar.
  const renderDesktopScrollHeader = () => (
    <>
      <View style={styles.desktopTopSectionWeb}>
        <Text style={[styles.headerTitle, styles.headerTitleWeb]}>
          {t('navigation:explore')}
        </Text>
        <SearchTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          style={styles.searchTabsFullWeb}
        />
      </View>

      <View style={styles.headerContainerWeb}>
        {!isSearching && (
          <Text style={styles.sectionTitle}>
            {activeTab === 'show' ? t('trendShows') : t('trendMovies')}
          </Text>
        )}
        {isSearching && !loading && currentData.length === 0 && (
          <Text style={styles.emptyText}>{t('common:noResults')}</Text>
        )}
      </View>
    </>
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />
  );

  // ── Desktop: poster grid ─────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderDesktopSearchBar()}
        <ExploreWebGrid
          ref={desktopGridRef}
          data={currentData}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          onEndReached={fetchMore}
          header={renderDesktopScrollHeader()}
          refreshControl={refreshControl}
          screenWidth={width}
          onScroll={handleDesktopScroll}
        />
      </View>
    );
  }

  // ── Mobile: original row list ────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {renderPinnedBar()}
      <FlatList
        showsVerticalScrollIndicator={false}
        data={currentData}
        keyExtractor={(item, index) => {
          const media = item.show || item.movie;
          return media?.ids?.trakt ? `${media.ids.trakt}-${index}` : index.toString();
        }}
        renderItem={({ item }) => <ShowCard data={item} />}
        contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={renderHeader()}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <LoadingIndicator size="small" />
            </View>
          ) : null
        }
        refreshControl={refreshControl}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <LoadingIndicator size="large" />
              <Text style={styles.loadingText}>{t('common:loading')}</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                <Text style={styles.retryButtonText}>{t('common:retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pinnedBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  // Üst bölüm (başlık + tam genişlik Diziler/Filmler sekmesi): SABİT DEĞİL,
  // içerikle birlikte kayıp gözden kaybolur.
  desktopTopSectionWeb: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 4,
  },
  // Tam genişlik sekme: SearchTabs'ın kendi container'ı flexDirection:'row'
  // olduğundan, dikey (column) bir ebeveyn içinde stretch ile doğal olarak
  // tam genişliğe yayılır — ekstra width stili gerekmez.
  searchTabsFullWeb: {
    marginBottom: 16,
  },
  // Arama çubuğu: mobildeki `pinnedBar` ile AYNI güvenilir desen — grid'in
  // TAMAMEN DIŞINDA, gerçek (`position: sticky` OLMAYAN) bir kardeş eleman.
  // Sayfanın kendi koyu-lacivert arka planıyla aynı, opak renk — önceki yarı
  // saydam siyah/blur katmanın içerikle çakışma sorunu artık mümkün değil.
  desktopSearchBarWeb: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  desktopSearchInnerWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 1280,
    paddingHorizontal: 32,
    paddingVertical: 10,
  },
  searchBarFlexWeb: {
    flex: 1,
    marginVertical: 0,
  },
  // Küçük, zarif "Yukarı Çık" butonu — yalnızca yeterince kaydırılınca belirir.
  scrollTopBtnWeb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexShrink: 0,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
    } as any),
  },
  headerContainer: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerContainerWeb: {
    paddingTop: 16,
    paddingBottom: 16,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerTitleWeb: {
    fontSize: 34,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    gap: 16,
  },
  loadingText: {
    color: '#a3a3a3',
    fontSize: 16,
  },
  errorContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  emptyText: {
    color: '#a3a3a3',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 24,
  },
  settingsButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  settingsButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#172033',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A364F',
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

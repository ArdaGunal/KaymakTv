import React from 'react';
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

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { t } = useTranslation(['media', 'navigation', 'common']);
  const { accessToken, isGuest } = useAuth();
  const router = useRouter();

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

  // Shared header — used by both list and grid
  const renderHeader = () => (
    <View style={isDesktop ? styles.headerContainerWeb : styles.headerContainer}>
      <Text style={[styles.headerTitle, isDesktop && styles.headerTitleWeb]}>
        {t('navigation:explore')}
      </Text>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('exploreSearchPH')}
      />
      <SearchTabs activeTab={activeTab} onTabChange={setActiveTab} />

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

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />
  );

  // ── Desktop: poster grid ─────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ExploreWebGrid
          data={currentData}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          onEndReached={fetchMore}
          header={renderHeader()}
          refreshControl={refreshControl}
          screenWidth={width}
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
  headerContainer: {
    paddingBottom: 8,
  },
  headerContainerWeb: {
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

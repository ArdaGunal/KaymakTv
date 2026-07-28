import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, useWindowDimensions } from 'react-native';
import { Rss } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeedCard from '../../../features/feed/components/FeedCard';
import FeedSkeleton from '../../../features/feed/components/FeedSkeleton';
import UserSearchBar from '../../../features/feed/components/UserSearchBar';
import UserProfileCard from '../../../features/feed/components/UserProfileCard';
import { useFeed } from '../../../features/feed/hooks/useFeed';
import { useUserSearch } from '../../../features/feed/hooks/useUserSearch';
import { FeedActivity } from '../../../features/feed/types';

const DESKTOP_BREAKPOINT = 768;

export default function FeedScreen() {
  const { t } = useTranslation(['navigation', 'feed']);
  const { data, isLoading, isRefreshing, refresh } = useFeed();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const search = useUserSearch();

  const hasSearchResult = !!search.profile || !!search.error;

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
            isFollowPending={search.isFollowPending}
            onToggleFollow={search.toggleFollow}
          />
        )}

        {isLoading ? (
          <FeedSkeleton />
        ) : (
          <FlatList<FeedActivity>
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <FeedCard activity={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#3b82f6" />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Rss size={40} color="#334155" />
                <Text style={styles.emptyTitle}>{t('feed:emptyTitle', 'Akışın Boş')}</Text>
                <Text style={styles.emptyText}>
                  {t('feed:emptyText', "Trakt'ta takip ettiğin kişilerin izleme aktiviteleri burada görünecek.")}
                </Text>
              </View>
            }
          />
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
});

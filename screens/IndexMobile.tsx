import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SectionList, FlatList, RefreshControl, Dimensions, Alert, LayoutAnimation, Platform, UIManager, InteractionManager } from 'react-native';
import LoadingIndicator from '../components/LoadingIndicator';

import { ChevronDown, ChevronUp, PlayCircle, Bookmark, Clock, Play } from 'lucide-react-native';
import EpisodeCard from '../components/EpisodeCard';
import SkeletonLoader from '../components/SkeletonLoader';
import LoginPaywall from '../components/LoginPaywall';
import InlineRater from '../components/InlineRater';
import { addRating } from '../services/traktApi';
import { getTrendingShows } from '../services/traktApi';
import { getShowPoster } from '../services/tmdbApi';
import { getDateGroup, isFutureDate, getEpisodeKey } from '../utils/dateHelper';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';
import * as SecureStore from '../utils/secureStorage';
import { useTranslation } from 'react-i18next';
import { useDashboardData } from '../hooks/useDashboardData';

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DizilerScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('izleme');
  const [renderedTab, setRenderedTab] = useState('izleme');
  const { t, i18n } = useTranslation('media');
  
  const [trendingFallback, setTrendingFallback] = useState<any[]>([]);
  
  const [collapsed, setCollapsed] = useState({
    upNext: false,
    inactive: true,
    dropped: true,
    watchlist: true
  });

  const [isLoading, setIsLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [finishedShow, setFinishedShow] = useState<{name: string, id: number} | null>(null);
  
  const { accessToken, isGuest } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { watchedShows, watchlistShows, calendarShows, showProgressMap, calendarSeasonsMap, isLoading: isLibraryLoading, markEpisodeAsWatched, refreshLibrary } = useLibrary();

  const {
    upNextShows,
    inactiveShows,
    watchlistShowsList,
    upcomingShows
  } = useDashboardData(
    watchedShows,
    watchlistShows,
    calendarShows,
    showProgressMap,
    calendarSeasonsMap,
    i18n.language
  );

  const groupedUpcomingShows = useMemo(() => {
    const groups: { title: string, data: any[] }[] = [];
    upcomingShows.forEach(show => {
      const existing = groups.find(g => g.title === show.dateGroup);
      if (existing) {
        existing.data.push(show);
      } else {
        groups.push({ title: show.dateGroup, data: [show] });
      }
    });
    return groups;
  }, [upcomingShows]);

  useEffect(() => {
    loadCollapsedState();
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setTimeout(() => {
      setRenderedTab(tab);
    }, 50);
  };

  useEffect(() => {
    if (accessToken) {
      if (!isLibraryLoading) {
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
    } else if (!isGuest) {
      fetchTrendingFallback();
    }
  }, [accessToken, isLibraryLoading, isGuest]);

  const loadCollapsedState = async () => {
    try {
      const savedState = await SecureStore.getItemAsync('kaymak_collapsed_state');
      if (savedState) {
        setCollapsed(JSON.parse(savedState));
      }
    } catch (error) {
      console.log('Kategori durumu yüklenemedi', error);
    }
  };

  const toggleCategory = async (category: 'upNext' | 'inactive' | 'watchlist' | 'dropped') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newState = { ...collapsed, [category]: !collapsed[category] };
    setCollapsed(newState);
    try {
      await SecureStore.setItemAsync('kaymak_collapsed_state', JSON.stringify(newState));
    } catch (error) {
      // sessiz hata
    }
  };

  const onRefresh = React.useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    await refreshLibrary();
    setRefreshing(false);
  }, [accessToken, refreshLibrary]);

  const fetchTrendingFallback = async () => {
    setIsLoading(true);
    try {
      const data = await getTrendingShows();
      const formattedData = await Promise.all(data.map(async (item: any, index: number) => {
        return {
          id: item.show.ids.trakt,
          showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
          season: 1, 
          episode: 1,
          title: `${item.show.year || ''} - ${item.watchers} ${t('watching')}`,
          tags: index < 3 ? ['TRENDING'] : [],
          image: null,
        };
      }));
      setTrendingFallback(formattedData);
    } catch (error) {
      console.log('Trendler çekilemedi', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowFinished = useCallback((showName: string, showId: number) => {
    setFinishedShow({name: showName, id: showId});
    setShowConfetti(true);
    // Modal'ı hemen kapatmıyoruz, kullanıcının puan vermesini bekleyebiliriz.
    // Confetti kendi kendine bitiyor.
  }, []);

  const izlemeSections = useMemo(() => {
    const sections = [];
    const effectiveUpNext = upNextShows.length > 0 ? upNextShows : trendingFallback;
    if (effectiveUpNext.length > 0) {
      sections.push({
        title: t('upNext'),
        key: 'upNext',
        data: collapsed.upNext ? [] : effectiveUpNext,
        count: effectiveUpNext.length,
      });
    }
    if (watchlistShowsList.length > 0) {
      sections.push({
        title: t('notStarted'),
        key: 'watchlist',
        data: collapsed.watchlist ? [] : watchlistShowsList,
        count: watchlistShowsList.length,
      });
    }
    if (inactiveShows.length > 0) {
      sections.push({
        title: t('inactive'),
        key: 'inactive',
        data: collapsed.inactive ? [] : inactiveShows,
        count: inactiveShows.length,
      });
    }
    return sections;
  }, [upNextShows, watchlistShowsList, inactiveShows, collapsed, i18n.language, trendingFallback]);


  if (isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoginPaywall message={t('loginToSeeCalendar', 'Yaklaşan dizilerinizi ve kendi izleme takviminizi oluşturmak için aramıza katılın!')} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.segmentedControlContainer}>
        <TouchableOpacity 
          style={[styles.segmentedTab, activeTab === 'izleme' && styles.segmentedTabActive]}
          onPress={() => handleTabChange('izleme')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentedTabText, activeTab === 'izleme' && styles.segmentedTabTextActive]}>{t('watchlistTab')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.segmentedTab, activeTab === 'yaklasan' && styles.segmentedTabActive]}
          onPress={() => handleTabChange('yaklasan')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentedTabText, activeTab === 'yaklasan' && styles.segmentedTabTextActive]}>{t('upcomingTab')}</Text>
        </TouchableOpacity>
      </View>

      {isLoading || isLibraryLoading ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={{ marginBottom: 16 }}>
            <SkeletonLoader width={100} height={20} style={{ marginBottom: 12, marginLeft: 16 }} />
            <View style={{ paddingHorizontal: 16 }}>
              <SkeletonLoader width="100%" height={144} borderRadius={8} style={{ marginBottom: 12 }} />
              <SkeletonLoader width="100%" height={144} borderRadius={8} style={{ marginBottom: 12 }} />
              <SkeletonLoader width="100%" height={144} borderRadius={8} />
            </View>
          </View>
        </ScrollView>
      ) : renderedTab === 'yaklasan' && accessToken ? (
        <SectionList
          sections={groupedUpcomingShows}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <EpisodeCard data={item} onShowFinished={handleShowFinished} />}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.calendarDateHeader}>{title}</Text>
          )}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          stickySectionHeadersEnabled={false}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('noUpcomingShows')}</Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ffffff"
              colors={['#ffffff']}
              progressBackgroundColor="#262626"
            />
          }
        />
      ) : !accessToken ? (
        <FlatList
          data={upNextShows}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <EpisodeCard data={item} onShowFinished={handleShowFinished} />}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          style={styles.scrollView}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
          ListHeaderComponent={
            <View style={styles.filterRow}>
              <View style={styles.filterPill}>
                <Text style={styles.filterPillText}>{t('trendShowsApi')}</Text>
              </View>
            </View>
          }
        />
      ) : (
        <SectionList
          sections={izlemeSections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <EpisodeCard data={item} onShowFinished={handleShowFinished} />}
          renderSectionHeader={({ section }) => {
            let Icon = PlayCircle;
            if (section.key === 'watchlist') Icon = Bookmark;
            if (section.key === 'inactive') Icon = Clock;
            
            const isCollapsed = collapsed[section.key as keyof typeof collapsed];
            
            return (
              <TouchableOpacity 
                style={[styles.categoryHeader, { marginBottom: 12 }]} 
                activeOpacity={0.7} 
                onPress={() => toggleCategory(section.key as any)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon size={20} color="#94A3B8" style={{ marginRight: 12 }} />
                  <Text style={styles.categoryTitle}>{section.title}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{section.count}</Text>
                  </View>
                  {isCollapsed ? <ChevronDown size={20} color="#a3a3a3" /> : <ChevronUp size={20} color="#a3a3a3" />}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          style={styles.scrollView}
          stickySectionHeadersEnabled={false}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ffffff"
              colors={['#ffffff']}
              progressBackgroundColor="#262626"
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('noShowsInCategory')}</Text>
          }
        />
      )}

      {showConfetti && finishedShow && (
        <View style={styles.confettiOverlay}>
          {Platform.OS !== 'web' && (
            <ConfettiCannon count={200} origin={{ x: width / 2, y: -20 }} fallSpeed={3000} fadeOut={true} />
          )}
          <View style={styles.congratsContainer}>
            <Text style={styles.congratsTitle}>{t('congrats')}</Text>
            <Text style={styles.congratsText}>{finishedShow.name} {t('showFinished')}</Text>
            
            <View style={{ marginTop: 24, padding: 16, backgroundColor: '#262626', borderRadius: 8, alignItems: 'center' }}>
               <Text style={{color: '#fff', fontWeight: 'bold', marginBottom: 8}}>{t('howWasShow')}</Text>
               <InlineRater 
                 onRate={async (val) => {
                   await addRating(finishedShow.id, 'show', val);
                   // Puanlama sonrası modalı kapat
                   setTimeout(() => setShowConfetti(false), 800);
                 }} 
               />
            </View>

            <TouchableOpacity 
              style={{ marginTop: 16, padding: 8 }}
              onPress={() => setShowConfetti(false)}
            >
               <Text style={{color: '#a3a3a3'}}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  
  // Segmented Control
  segmentedControlContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 4,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  segmentedTabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // Soft Glass Effect
  },
  segmentedTabText: {
    fontWeight: '600',
    color: '#a3a3a3',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  segmentedTabTextActive: {
    color: '#3B82F6',
    fontWeight: 'bold',
  },

  filterRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 },
  filterPill: { backgroundColor: 'rgba(82, 82, 82, 0.5)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 9999 },
  filterPillText: { color: '#ffffff', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  scrollView: { flex: 1, paddingHorizontal: 12 },
  scrollContent: { paddingTop: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#a3a3a3', marginTop: 12, fontSize: 14 },
  
  // Modern Accordion
  categoryHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#172033', // Midnight slate box
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A364F',
  },
  categoryTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  badgeContainer: {
    backgroundColor: '#3B82F6', // Highlight color
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: { color: '#64748b', textAlign: 'center', paddingVertical: 20, fontStyle: 'italic' },
  calendarDateHeader: { color: '#a3a3a3', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginTop: 16, marginBottom: 12, marginLeft: 4 },
  confettiOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  congratsContainer: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 24, borderRadius: 16, alignItems: 'center' },
  congratsTitle: { fontSize: 28, fontWeight: 'bold', color: '#3B82F6', marginBottom: 8 },
  congratsText: { fontSize: 16, color: '#ffffff', textAlign: 'center' },
});

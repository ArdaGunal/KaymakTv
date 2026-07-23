import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import SkeletonLoader from '../components/SkeletonLoader';
import LoginPaywall from '../components/LoginPaywall';
import { addRating } from '../services/traktApi';
import { useAuth } from '../context/AuthContext';
import { useLibrarySelector, useLibraryActions } from '../context/LibraryContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTrackingShows } from '../hooks/useTrackingShows';
import { useTrackingStore } from '../store/tracking/useTrackingStore';
import { groupByDateGroup } from '../utils/groupByDateGroup';
import SegmentedTabControl from '../components/index/SegmentedTabControl';
import UpcomingSectionList from '../components/index/UpcomingSectionList';
import TrackingAccordionList from '../components/tracking/TrackingAccordionList';
import CelebrationOverlay from '../components/index/CelebrationOverlay';

export default function DizilerScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('izleme');
  const [renderedTab, setRenderedTab] = useState('izleme');
  const { t, i18n } = useTranslation('media');

  const [showConfetti, setShowConfetti] = useState(false);
  const [finishedShow, setFinishedShow] = useState<{ name: string; id: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { accessToken, isGuest } = useAuth();

  // ── Yeni izole takip modülü: kategorizasyon store/hook'ta, UI durumu ayrı store'da.
  const { categories, isLoading: trackingLoading, isEmpty, toggleDroppedShowStatus } = useTrackingShows();
  const collapsed = useTrackingStore((s) => s.collapsed);
  const toggle = useTrackingStore((s) => s.toggle);
  const hydrateCollapsed = useTrackingStore((s) => s.hydrate);

  useEffect(() => {
    hydrateCollapsed();
  }, [hydrateCollapsed]);

  // ── Yaklaşan (takvim) sekmesi eski, sağlam hattı kullanmaya devam eder.
  const { calendarShows, calendarSeasonsMap, watchedShows, watchlistShows, showProgressMap, hiddenShowIds } = useLibrarySelector((s) => ({
    calendarShows: s.calendarShows,
    calendarSeasonsMap: s.calendarSeasonsMap,
    watchedShows: s.watchedShows,
    watchlistShows: s.watchlistShows,
    showProgressMap: s.showProgressMap,
    hiddenShowIds: s.hiddenShowIds,
  }));
  const { refreshLibrary } = useLibraryActions();

  const { upcomingShows } = useDashboardData(
    watchedShows,
    watchlistShows,
    calendarShows,
    showProgressMap,
    calendarSeasonsMap,
    i18n.language,
    hiddenShowIds
  );
  const groupedUpcomingShows = useMemo(() => groupByDateGroup(upcomingShows), [upcomingShows]);

  const accordionLabels = useMemo(
    () => ({
      upNext: t('upNext'),
      paused: t('paused'),
      notStarted: t('notStarted'),
      dropped: t('inactive'),
    }),
    [t, i18n.language]
  );

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setTimeout(() => setRenderedTab(tab), 50);
  };

  const onRefresh = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    await refreshLibrary();
    setRefreshing(false);
  }, [accessToken, refreshLibrary]);

  const handleShowFinished = useCallback((showName: string, showId: number) => {
    setFinishedShow({ name: showName, id: showId });
    setShowConfetti(true);
  }, []);

  if (isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoginPaywall message={t('loginToSeeCalendar', 'Yaklaşan dizilerinizi ve kendi izleme takviminizi oluşturmak için aramıza katılın!')} />
      </View>
    );
  }

  const showSkeleton = renderedTab === 'izleme' && trackingLoading && isEmpty;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <SegmentedTabControl
        activeTab={activeTab}
        onTabChange={handleTabChange}
        watchlistLabel={t('watchlistTab')}
        upcomingLabel={t('upcomingTab')}
      />

      {showSkeleton ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={styles.skeletonBlock}>
            <SkeletonLoader width={100} height={20} style={styles.skeletonTitle} />
            <View style={styles.skeletonRows}>
              <SkeletonLoader width="100%" height={144} borderRadius={8} style={styles.skeletonRow} />
              <SkeletonLoader width="100%" height={144} borderRadius={8} style={styles.skeletonRow} />
              <SkeletonLoader width="100%" height={144} borderRadius={8} />
            </View>
          </View>
        </ScrollView>
      ) : renderedTab === 'yaklasan' ? (
        <UpcomingSectionList
          sections={groupedUpcomingShows}
          onShowFinished={handleShowFinished}
          refreshing={refreshing}
          onRefresh={onRefresh}
          insets={insets}
          emptyLabel={t('noUpcomingShows')}
        />
      ) : (
        <TrackingAccordionList
          categories={categories}
          collapsed={collapsed}
          onToggle={toggle}
          labels={accordionLabels}
          onShowFinished={handleShowFinished}
          onToggleDropped={toggleDroppedShowStatus}
          refreshing={refreshing}
          onRefresh={onRefresh}
          insets={insets}
          emptyLabel={t('noShowsInCategory')}
        />
      )}

      {showConfetti && finishedShow && (
        <CelebrationOverlay
          finishedShow={finishedShow}
          onRate={async (val) => {
            await addRating(finishedShow.id, 'show', val);
          }}
          onClose={() => setShowConfetti(false)}
          howWasShowLabel={t('howWasShow')}
          congratsLabel={t('congrats')}
          showFinishedLabel={t('showFinished')}
          closeLabel={t('close')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  scrollContent: { paddingTop: 12 },
  skeletonBlock: { marginBottom: 16 },
  skeletonTitle: { marginBottom: 12, marginLeft: 16 },
  skeletonRows: { paddingHorizontal: 16 },
  skeletonRow: { marginBottom: 12 },
});

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, RefreshControl, Dimensions, InteractionManager, Platform } from 'react-native';

import EpisodeCard from '../../components/EpisodeCard';
import SkeletonLoader from '../../components/SkeletonLoader';
import InlineRater from '../../components/InlineRater';
import { addRating } from '../../services/traktApi';
import { getTrendingShows } from '../../services/traktApi';
import { getDateGroup, isFutureDate, getEpisodeKey } from '../../utils/dateHelper';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTranslation } from 'react-i18next';
import WebCarousel from '../../components/web/WebCarousel';
import { useRouter } from 'expo-router';
import { useResponsive } from '../../hooks/useResponsive';
import IndexMobile from '../../screens/IndexMobile';
import { viewAllStore } from '../../utils/viewAllStore';
import LoginPaywall from '../../components/LoginPaywall';

const { width } = Dimensions.get('window');

export default function DizilerScreenWeb() {
  const { isDesktop } = useResponsive();

  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState('izleme');
  const [renderedTab, setRenderedTab] = useState('izleme');
  const { t, i18n } = useTranslation('media');
  
  const [upNextShows, setUpNextShows] = useState<any[]>([]);
  const [inactiveShows, setInactiveShows] = useState<any[]>([]);
  const [watchlistShowsList, setWatchlistShowsList] = useState<any[]>([]);
  const [upcomingShows, setUpcomingShows] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [finishedShow, setFinishedShow] = useState<{name: string, id: number} | null>(null);
  
  const { accessToken, isGuest } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { watchedShows, watchlistShows, calendarShows, showProgressMap, calendarSeasonsMap, isLoading: isLibraryLoading, markEpisodeAsWatched, refreshLibrary } = useLibrary();

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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setTimeout(() => {
      setRenderedTab(tab);
    }, 50);
  };

  useEffect(() => {
    if (accessToken) {
      if (!isLibraryLoading) {
        InteractionManager.runAfterInteractions(() => {
          processData();
        });
      }
    } else if (!isGuest) {
      fetchTrendingFallback();
    }
  }, [accessToken, isLibraryLoading, watchedShows, watchlistShows, calendarShows, showProgressMap, calendarSeasonsMap, i18n.language, isGuest]);

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
        const tmdbId = item.show.ids.tmdb;
        let imageUrl = null;
        
        return {
          id: item.show.ids.trakt,
          showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
          season: 1, 
          episode: 1,
          title: `${item.show.year || ''} - ${item.watchers} ${t('watching')}`,
          tags: index < 3 ? ['TRENDING'] : [],
          image: imageUrl,
        };
      }));
      setUpNextShows(formattedData);
    } catch (error) {
      console.log('Trendler çekilemedi', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processData = async () => {
    setIsLoading(true);
    try {
      const uniqueHistoryShows: any[] = [];
      const showIds = new Set();
      
      for (const item of watchedShows) {
        if (!item?.show?.ids?.trakt) continue;
        if (!showIds.has(item.show.ids.trakt)) {
          uniqueHistoryShows.push(item);
          showIds.add(item.show.ids.trakt);
        }
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const upNextTemp: any[] = [];
      const inactiveTemp: any[] = [];
      const farFutureTemp: any[] = [];

      const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

      for (let i = 0; i < uniqueHistoryShows.length; i++) {
        if (i > 0 && i % 30 === 0) await yieldToMain();
        const item = uniqueHistoryShows[i];
        const traktId = item?.show?.ids?.trakt;
        if (!traktId) continue;
        const tmdbId = item?.show?.ids?.tmdb;

        let season = 1;
        let episodeNumber = 1;

        if (item.seasons && item.seasons.length > 0) {
          const validSeasons = [...item.seasons].filter((s: any) => s.number > 0).sort((a: any, b: any) => b.number - a.number);
          if (validSeasons.length > 0) {
            const maxSeason = validSeasons[0];
            season = maxSeason.number;
            if (maxSeason.episodes && maxSeason.episodes.length > 0) {
              const maxEpisode = [...maxSeason.episodes].sort((a: any, b: any) => b.number - a.number)[0];
              episodeNumber = maxEpisode.number;
            }
          }
        }

        let episodeTitle = item.episode?.title || `${t('lastWatched')} ${new Date(item.last_watched_at).toLocaleDateString('tr-TR')}`;
        let hasNextEpisode = false;
        let isCalculating = false;
        let nextAiredDate: Date | null = null;
        const progress = showProgressMap[traktId];
        let isInactive = new Date(item.last_watched_at) < thirtyDaysAgo;

        if (progress === undefined) {
          hasNextEpisode = true;
          isCalculating = true;
        } else if (progress && progress.next_episode) {
          const nextAired = progress.next_episode.first_aired;
          if (nextAired) {
            nextAiredDate = new Date(nextAired);
          }
          const isFuture = isFutureDate(nextAired);
          
          if (!isFuture) {
            season = progress.next_episode.season;
            episodeNumber = progress.next_episode.number;
            episodeTitle = progress.next_episode.title;
            hasNextEpisode = true;
          }

          if (nextAiredDate && nextAiredDate >= thirtyDaysAgo) {
            isInactive = false;
          }

          if (isFuture && !isInactive) {
            farFutureTemp.push({
              traktId,
              showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
              season: progress.next_episode.season,
              episode: progress.next_episode.number,
              title: progress.next_episode.title,
              image: null,
              tmdbId: tmdbId,
              slug: item.show.ids.slug,
              first_aired: nextAired,
              completedCount: progress.completed
            });
          }
        }

        if (progress && !progress.next_episode) continue;
        if (!hasNextEpisode) continue;

        const formattedObj = {
          id: traktId,
          showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
          season,
          episode: episodeNumber,
          title: episodeTitle,
          tags: isInactive ? ['ESKİ'] : ['EN SON'],
          image: null,
          tmdbId: tmdbId,
          slug: item.show.ids.slug,
          completedCount: progress ? progress.completed : null,
          isCalculating
        };

        if (isInactive) inactiveTemp.push(formattedObj);
        else upNextTemp.push(formattedObj);
      }

      const watchlistFinal: any[] = [];
      
      for (let i = 0; i < watchlistShows.length; i++) {
        if (i > 0 && i % 30 === 0) await yieldToMain();
        const item = watchlistShows[i];
        const traktId = item?.show?.ids?.trakt;
        if (!traktId) continue;
        const tmdbId = item?.show?.ids?.tmdb;

        let season = 1;
        let episodeNumber = 1;
        let episodeTitle = t('notStarted');
        let hasProgress = false;
        let isCompleted = false;

        const progress = showProgressMap[traktId];

        if (progress) {
          if (progress.next_episode) {
            const nextAired = progress.next_episode.first_aired;
            const isFuture = isFutureDate(nextAired);
            
            if (!isFuture) {
              season = progress.next_episode.season;
              episodeNumber = progress.next_episode.number;
              episodeTitle = progress.next_episode.title;
              hasProgress = progress.completed > 0;
            } else {
              if (nextAired) {
                farFutureTemp.push({
                  traktId,
                  showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
                  season: progress.next_episode.season,
                  episode: progress.next_episode.number,
                  title: progress.next_episode.title,
                  image: null,
                  tmdbId: tmdbId,
                  slug: item.show.ids.slug,
                  first_aired: nextAired,
                  completedCount: progress.completed
                });
              }
              isCompleted = true;
            }
          } else if (progress.completed > 0 && progress.aired === progress.completed) {
            isCompleted = true;
          }
        } else {
          if (item.show?.first_aired) {
            const isFuture = isFutureDate(item.show.first_aired);
            if (isFuture) {
              farFutureTemp.push({
                traktId,
                showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
                season: 1,
                episode: 1,
                title: t('showPremiere'),
                image: null,
                tmdbId: tmdbId,
                slug: item.show.ids.slug,
                first_aired: item.show.first_aired,
                completedCount: 0
              });
              isCompleted = true;
            }
          }
        }

        if (isCompleted) continue;

        const formattedObj = {
          id: traktId,
          showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
          season,
          episode: episodeNumber,
          title: episodeTitle,
          tags: hasProgress ? ['EN SON'] : ['WATCHLIST'],
          image: null,
          tmdbId: tmdbId,
          slug: item.show.ids.slug,
          completedCount: progress ? progress.completed : null,
          isCalculating: false
        };

        const alreadyInUpNext = upNextTemp.some(s => s.id === traktId);
        const alreadyInInactive = inactiveTemp.some(s => s.id === traktId);

        if (!alreadyInUpNext && !alreadyInInactive) {
          if (hasProgress) upNextTemp.push(formattedObj);
          else watchlistFinal.push(formattedObj);
        }
      }

      const upcomingTemp: any[] = [];
      const seenEpisodes = new Set();

      for (let i = 0; i < calendarShows.length; i++) {
        if (i > 0 && i % 30 === 0) await yieldToMain();
        const item = calendarShows[i];
        const traktId = item?.show?.ids?.trakt;
        if (!traktId || !item?.episode) continue;
        const uniqueId = getEpisodeKey(traktId, item.episode.season, item.episode.number);
        if (seenEpisodes.has(uniqueId)) continue;
        seenEpisodes.add(uniqueId);
        
        const tmdbId = item.show.ids.tmdb;
        const dateObj = new Date(item.first_aired);
        
        if (!isFutureDate(item.first_aired)) continue;

        const dateGroup = getDateGroup(dateObj, t);
        
        upcomingTemp.push({
          id: uniqueId,
          rawTraktId: traktId,
          showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
          season: item.episode.season,
          episode: item.episode.number,
          title: item.episode.title || `${item.episode.season}. ${t('season')} ${item.episode.number}. ${t('episode')}`,
          tags: [], 
          image: null,
          tmdbId: tmdbId,
          slug: item.show.ids.slug,
          rawDate: dateObj.getTime(),
          dateGroup,
        });
      }
      
      Object.entries(calendarSeasonsMap).forEach(([idStr, seasonData]) => {
        const traktId = parseInt(idStr, 10);
        if (!traktId || !seasonData || !seasonData.data) return;

        let showMeta = watchedShows.find((w: any) => w.show?.ids?.trakt === traktId)?.show;
        if (!showMeta) showMeta = watchlistShows.find((w: any) => w.show?.ids?.trakt === traktId)?.show;
        if (!showMeta) {
           const calItem = calendarShows.find((c: any) => c.show?.ids?.trakt === traktId);
           if (calItem) showMeta = calItem.show;
        }

        const tmdbId = showMeta?.ids?.tmdb;
        const showName = (showMeta?.title || t('unnamedShow')).toUpperCase();
        const slug = showMeta?.ids?.slug;

        seasonData.data.forEach((currentSeason: any) => {
            if (currentSeason && currentSeason.episodes) {
                currentSeason.episodes.forEach((ep: any) => {
                    if (ep.first_aired) {
                        const uniqueId = getEpisodeKey(traktId, ep.season, ep.number);
                        if (!seenEpisodes.has(uniqueId) && isFutureDate(ep.first_aired)) {
                            seenEpisodes.add(uniqueId);
                            const dateObj = new Date(ep.first_aired);
                            upcomingTemp.push({
                                id: uniqueId,
                                rawTraktId: traktId,
                                showName: showName,
                                season: ep.season,
                                episode: ep.number,
                                title: ep.title || `${ep.season}. ${t('season')} ${ep.number}. ${t('episode')}`,
                                tags: [],
                                image: null,
                                tmdbId: tmdbId,
                                slug: slug,
                                rawDate: dateObj.getTime(),
                                dateGroup: getDateGroup(dateObj, t),
                            });
                        }
                    }
                });
            }
        });
      });
      
      farFutureTemp.forEach((item: any) => {
        const uniqueId = getEpisodeKey(item.traktId, item.season, item.episode);
        if (seenEpisodes.has(uniqueId)) return;
        seenEpisodes.add(uniqueId);
        
        const dateObj = new Date(item.first_aired);
        if (!isFutureDate(item.first_aired)) return;
        
        upcomingTemp.push({
          id: uniqueId,
          rawTraktId: item.traktId,
          showName: item.showName,
          season: item.season,
          episode: item.episode,
          title: item.title || `${item.season}. ${t('season')} ${item.episode}. ${t('episode')}`,
          tags: [],
          image: item.image,
          tmdbId: item.tmdbId,
          rawDate: dateObj.getTime(),
          dateGroup: getDateGroup(dateObj, t),
          completedCount: item.completedCount
        });
      });
      
      upcomingTemp.sort((a, b) => a.rawDate - b.rawDate);

      setUpNextShows(upNextTemp);
      setInactiveShows(inactiveTemp);
      setWatchlistShowsList(watchlistFinal);
      setUpcomingShows(upcomingTemp);

      setIsLoading(false);
    } catch (e) {
      console.log('Index.web.tsx veri formatlama hatası:', e);
      setIsLoading(false);
    }
  };


  const handleShowFinished = useCallback((showName: string, showId: number) => {
    setFinishedShow({name: showName, id: showId});
    setShowConfetti(true);
  }, []);

  const renderCarousel = (title: string, data: any[], routeType: string = 'shows') => {
    return (
      <WebCarousel 
        title={title} 
        data={data} 
        renderItem={({ item }) => <EpisodeCard data={item} onShowFinished={handleShowFinished} />}
        onViewAll={() => {
          viewAllStore.data = data;
          viewAllStore.title = title;
          router.push(`/library/view-all?type=${routeType}` as any);
        }}
      />
    );
  };

  if (!isDesktop) {
    return <IndexMobile />;
  }

  if (isGuest) {
    return (
      <View style={styles.pageBackground}>
        <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
          <LoginPaywall message={t('loginToSeeCalendar', 'Yaklaşan dizilerinizi ve kendi izleme takviminizi oluşturmak için aramıza katılın!')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.pageBackground}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        style={styles.container} 
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
            colors={['#ffffff']}
            progressBackgroundColor="#262626"
          />
        }
      >
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
          <View style={{ marginTop: 24 }}>
             <Text style={styles.categoryTitle}>{t('upNext')}</Text>
             <View style={{ flexDirection: 'row', gap: 16, marginBottom: 32 }}>
                <SkeletonLoader width={180} height={270} borderRadius={8} />
                <SkeletonLoader width={180} height={270} borderRadius={8} />
                <SkeletonLoader width={180} height={270} borderRadius={8} />
                <SkeletonLoader width={180} height={270} borderRadius={8} />
             </View>
             
             <Text style={styles.categoryTitle}>{t('notStarted')}</Text>
             <View style={{ flexDirection: 'row', gap: 16 }}>
                <SkeletonLoader width={180} height={270} borderRadius={8} />
                <SkeletonLoader width={180} height={270} borderRadius={8} />
             </View>
          </View>
        ) : renderedTab === 'yaklasan' && accessToken ? (
          groupedUpcomingShows.length > 0 ? (
            groupedUpcomingShows.map(group => (
              <React.Fragment key={group.title}>
                {renderCarousel(group.title, group.data)}
              </React.Fragment>
            ))
          ) : (
            <Text style={styles.emptyText}>{t('noUpcomingShows')}</Text>
          )
        ) : !accessToken ? (
          <>
            <View style={styles.filterRow}>
              <View style={styles.filterPill}>
                <Text style={styles.filterPillText}>{t('trendShowsApi')}</Text>
              </View>
            </View>
            {renderCarousel(t('trendShowsApi'), upNextShows)}
          </>
        ) : (
          <>
            {renderCarousel(t('upNext'), upNextShows)}
            {renderCarousel(t('notStarted'), watchlistShowsList)}
            {renderCarousel(t('inactive'), inactiveShows)}
            
            {upNextShows.length === 0 && watchlistShowsList.length === 0 && inactiveShows.length === 0 && (
              <Text style={styles.emptyText}>{t('noShowsInCategory')}</Text>
            )}
          </>
        )}

        {showConfetti && finishedShow && (
          <View style={styles.confettiOverlay}>
            <View style={styles.congratsContainer}>
              <Text style={styles.congratsTitle}>{t('congrats')}</Text>
              <Text style={styles.congratsText}>{finishedShow.name} {t('showFinished')}</Text>
              
              <View style={{ marginTop: 24, padding: 16, backgroundColor: '#262626', borderRadius: 8, alignItems: 'center' }}>
                 <Text style={{color: '#fff', fontWeight: 'bold', marginBottom: 8}}>{t('howWasShow')}</Text>
                 <InlineRater 
                   onRate={async (val) => {
                     await addRating(finishedShow.id, 'show', val);
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageBackground: { flex: 1, backgroundColor: '#0B1120' },
  container: { flex: 1 },
  contentContainer: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 32,
  },
  
  segmentedControlContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: 4,
    marginBottom: 32,
    alignSelf: 'flex-start', // Left align
    minWidth: 300,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  segmentedTabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
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

  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  filterPill: { backgroundColor: 'rgba(82, 82, 82, 0.5)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 9999 },
  filterPillText: { color: '#ffffff', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  
  carouselSection: {
    marginBottom: 40,
  },
  categoryTitle: { 
    color: '#f8fafc', 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  
  emptyText: { color: '#64748b', paddingVertical: 40, fontStyle: 'italic', fontSize: 16 },
  confettiOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  congratsContainer: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 32, borderRadius: 16, alignItems: 'center' },
  congratsTitle: { fontSize: 32, fontWeight: 'bold', color: '#3B82F6', marginBottom: 12 },
  congratsText: { fontSize: 18, color: '#ffffff', textAlign: 'center' },
});

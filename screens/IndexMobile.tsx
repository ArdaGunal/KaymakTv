import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SectionList, FlatList, RefreshControl, Dimensions, Alert, LayoutAnimation, Platform, UIManager, InteractionManager } from 'react-native';
import LoadingIndicator from '../components/LoadingIndicator';

import { ChevronDown, ChevronUp, PlayCircle, Bookmark, Clock, Play } from 'lucide-react-native';
import EpisodeCard from '../components/EpisodeCard';
import SkeletonLoader from '../components/SkeletonLoader';
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

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DizilerScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('izleme');
  const [renderedTab, setRenderedTab] = useState('izleme');
  const { t, i18n } = useTranslation('media');
  
  const [upNextShows, setUpNextShows] = useState<any[]>([]);
  const [inactiveShows, setInactiveShows] = useState<any[]>([]);
  const [watchlistShowsList, setWatchlistShowsList] = useState<any[]>([]);
  const [upcomingShows, setUpcomingShows] = useState<any[]>([]);
  
  const [collapsed, setCollapsed] = useState({
    upNext: false,
    inactive: true,
    dropped: true,
    watchlist: true
  });

  const [isLoading, setIsLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [finishedShow, setFinishedShow] = useState<{name: string, id: number} | null>(null);
  
  const { accessToken } = useAuth();
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
        InteractionManager.runAfterInteractions(() => {
          processData();
        });
      }
    } else {
      fetchTrendingFallback();
    }
  }, [accessToken, isLibraryLoading, watchedShows, watchlistShows, calendarShows, showProgressMap, calendarSeasonsMap, i18n.language]);

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
      // ============================================
      // 1. WATCHED SHOWS (Sıradakiler & Bırakılanlar)
      // ============================================
      const uniqueHistoryShows: any[] = [];
      const showIds = new Set();
      
      for (const item of watchedShows) {
        if (!item?.show?.ids?.trakt) continue; // Bozuk veriyi atla
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

      // Yükü dağıtmak için yield fonksiyonu
      const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

      for (let i = 0; i < uniqueHistoryShows.length; i++) {
        if (i > 0 && i % 30 === 0) await yieldToMain(); // Her 30 öğede bir UI thread'e nefes aldır
        const item = uniqueHistoryShows[i];
        const traktId = item?.show?.ids?.trakt;
        if (!traktId) continue;
        const tmdbId = item?.show?.ids?.tmdb;
        let imageUrl = null;

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
              image: imageUrl,
              tmdbId: tmdbId,
              slug: item.show.ids.slug,
              first_aired: nextAired,
              completedCount: progress.completed
            });
          }
        }

        // Eğer dizi bittiyse (progress var ama next_episode yoksa)
        if (progress && !progress.next_episode) {
          continue; // Ana sayfada göstermiyoruz, doğrudan yutuyoruz.
        }

        if (!hasNextEpisode) continue;

        // isInactive is already calculated and refined above


        const formattedObj = {
          id: traktId,
          showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
          season,
          episode: episodeNumber,
          title: episodeTitle,
          tags: isInactive ? ['ESKİ'] : ['EN SON'],
          image: imageUrl,
          tmdbId: tmdbId,
          slug: item.show.ids.slug,
          completedCount: progress ? progress.completed : null,
          isCalculating
        };

        if (isInactive) inactiveTemp.push(formattedObj);
        else upNextTemp.push(formattedObj);
      }

      // ============================================
      // 2. WATCHLIST (Henüz Başlanmadı)
      // ============================================
      const watchlistFinal: any[] = [];
      
      for (let i = 0; i < watchlistShows.length; i++) {
        if (i > 0 && i % 30 === 0) await yieldToMain();
        const item = watchlistShows[i];
        const traktId = item?.show?.ids?.trakt;
        if (!traktId) continue;
        const tmdbId = item?.show?.ids?.tmdb;
        let imageUrl = null;

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
              hasProgress = progress.completed > 0; // SADECE en az 1 bölüm izlendiyse Sıradakiler'e at
            } else {
              if (nextAired) {
                farFutureTemp.push({
                  traktId,
                  showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
                  season: progress.next_episode.season,
                  episode: progress.next_episode.number,
                  title: progress.next_episode.title,
                  image: imageUrl,
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
          // Progress yok (hiç izlenmemiş). Belki de henüz çıkmamış yepyeni bir dizidir?
          if (item.show?.first_aired) {
            const isFuture = isFutureDate(item.show.first_aired);
            if (isFuture) {
              farFutureTemp.push({
                traktId,
                showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
                season: 1,
                episode: 1,
                title: t('showPremiere'),
                image: imageUrl,
                tmdbId: tmdbId,
                slug: item.show.ids.slug,
                first_aired: item.show.first_aired,
                completedCount: 0
              });
              isCompleted = true; // Watchlist listesinde gösterme, takvimde göster
            }
          }
        }

        if (isCompleted) {
          continue; // Ana sayfada göstermiyoruz
        }

        const formattedObj = {
          id: traktId,
          showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
          season,
          episode: episodeNumber,
          title: episodeTitle,
          tags: hasProgress ? ['EN SON'] : ['WATCHLIST'],
          image: imageUrl,
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

      // ============================================
      // 3. CALENDAR (Yaklaşanlar)
      // ============================================
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
        let imageUrl = null;
        
        const dateObj = new Date(item.first_aired);
        
        // Eğer bölüm geçmişte kaldıysa (yayınlandıysa) Yaklaşanlar listesinde gösterme. 
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
          image: imageUrl,
          tmdbId: tmdbId,
          slug: item.show.ids.slug,
          rawDate: dateObj.getTime(),
          dateGroup,
        });
      }
      
      // FAZ 4.5: Calendar Seasons'dan (Genişletilmiş Takvim) gelen uzak gelecek bölümlerini ekle
      Object.entries(calendarSeasonsMap).forEach(([idStr, seasonData]) => {
        const traktId = parseInt(idStr, 10);
        if (!traktId || !seasonData || !seasonData.data) return;

        // İlgili dizinin temel bilgilerini watchedShows veya watchlistShows'tan bul
        let showMeta = watchedShows.find((w: any) => w.show?.ids?.trakt === traktId)?.show;
        
        if (!showMeta) {
            showMeta = watchlistShows.find((w: any) => w.show?.ids?.trakt === traktId)?.show;
        }
        
        // Eğer hiçbir yerde bulamazsak calendarShows'a bakalım (yedek)
        if (!showMeta) {
           const calItem = calendarShows.find((c: any) => c.show?.ids?.trakt === traktId);
           if (calItem) showMeta = calItem.show;
        }

        const tmdbId = showMeta?.ids?.tmdb;
        const showName = (showMeta?.title || t('unnamedShow')).toUpperCase();
        const slug = showMeta?.ids?.slug;

        // Tüm sezonları ve bölümleri tara
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
      
      // Far Future Ekle
      farFutureTemp.forEach((item: any) => {
        const uniqueId = getEpisodeKey(item.traktId, item.season, item.episode);
        if (seenEpisodes.has(uniqueId)) return;
        seenEpisodes.add(uniqueId);
        
        const dateObj = new Date(item.first_aired);
        
        // Eğer yayınlandıysa Yaklaşanlar listesinden çıkar
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

      // Stateleri Topluca Set Et
      setUpNextShows(upNextTemp);
      setInactiveShows(inactiveTemp);
      setWatchlistShowsList(watchlistFinal);
      setUpcomingShows(upcomingTemp);

      // Ana verileri render ettik, yükleniyor ekranını kapat
      setIsLoading(false);
    } catch (e) {
      console.log('Index.tsx veri formatlama hatası:', e);
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
    if (upNextShows.length > 0) {
      sections.push({
        title: t('upNext'),
        key: 'upNext',
        data: collapsed.upNext ? [] : upNextShows,
        count: upNextShows.length,
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
  }, [upNextShows, watchlistShowsList, inactiveShows, collapsed, i18n.language]);


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

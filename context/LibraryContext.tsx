import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import i18n from '../locales/index';

const safeStorageSet = async (key: string, value: string) => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error(`AsyncStorage KayÄ±t HatasÄ± (${key}):`, error);
    // AynÄ± hatayÄ± defalarca gÃ¶stermemek iÃ§in throttle mekanizmasÄ± da eklenebilir, ÅŸimdilik basit uyarÄ±:
    Alert.alert(
      "Depolama AlanÄ± Dolu",
      "CihazÄ±nÄ±zda yeterli alan olmadÄ±ÄŸÄ± veya yerel depolama kotasÄ± aÅŸÄ±ldÄ±ÄŸÄ± iÃ§in bazÄ± veriler cihazÄ±nÄ±za kaydedilemiyor."
    );
  }
};

const safeStorageMultiSet = async (keyValuePairs: [string, string][]) => {
  try {
    await AsyncStorage.multiSet(keyValuePairs);
  } catch (error) {
    console.error('AsyncStorage Toplu KayÄ±t HatasÄ±:', error);
    Alert.alert(
      "Depolama AlanÄ± Dolu",
      "CihazÄ±nÄ±zda yeterli alan olmadÄ±ÄŸÄ± iÃ§in Ã§oklu veriler cihazÄ±nÄ±za kaydedilemiyor."
    );
  }
};
import { 
  getWatchedShows, 
  getWatchedMovies, 
  getCustomLists, 
  getFavoriteShows, 
  getFavoriteMovies,
  getWatchlistShows,
  getMyCalendarShows,
  getShowProgress,
  addEpisodeToHistory,
  addSeasonToHistory,
  addEpisodesBulkToHistory,
  removeEpisodeFromHistoryTrakt,
  removeSeasonFromHistoryTrakt,
  getWatchlistMovies,
  getMyCalendarMovies,
  addMovieToHistory,
  getUserRatings,
  addToWatchlistTrakt,
  removeFromWatchlistTrakt,
  hideItemTrakt,
  removeFromHistoryTrakt,
  getShowSeasons,
  toggleLikedMedia,
  getLikedShows,
  getLikedMovies,
  createCustomList,
  addMediaToCustomList,
  removeMediaFromCustomList
} from '../services/traktApi';

interface LibraryContextType {
  watchedShows: any[];
  watchedMovies: any[];
  customLists: any[];
  favShows: any[];
  favMovies: any[];
  watchlistShows: any[];
  calendarShows: any[];
  watchlistMovies: any[];
  calendarMovies: any[];
  userRatingsShows: any[];
  userRatingsMovies: any[];
  userRatingsEpisodes: any[];
  showProgressMap: Record<string, any>;
  calendarSeasonsMap: Record<string, any>;
  isLoading: boolean;
  isMoviesLoading: boolean;
  refreshLibrary: () => Promise<void>;
  markEpisodeAsWatched: (showId: number, season: number, episode: number) => Promise<any>;
  markSeasonAsWatched: (showId: number, season: number) => Promise<any>;
  markEpisodesUpToAsWatched: (showId: number, season: number, episodes: number[]) => Promise<any>;
  unwatchEpisode: (showId: number, season: number, episode: number) => Promise<any>;
  unwatchSeason: (showId: number, season: number) => Promise<any>;
  rewatchEpisode: (showId: number, season: number, episode: number) => Promise<any>;
  markMovieAsWatched: (movieId: number) => Promise<void>;
  toggleWatchlistStatus: (id: number, type: 'show' | 'movie', isCurrentlyWatchlisted: boolean, mediaData: any) => Promise<void>;
  toggleFavoriteStatus: (id: number, type: 'show' | 'movie', isCurrentlyFavorited: boolean, mediaData: any) => Promise<void>;
  hideMediaFromProgress: (id: number, type: 'show' | 'movie') => Promise<void>;
  deleteMediaFromHistory: (id: number, type: 'show' | 'movie') => Promise<void>;
  createNewList: (name: string, description?: string) => Promise<any>;
  toggleMediaInList: (listId: number, mediaId: number, type: 'show' | 'movie', isAdding: boolean) => Promise<void>;
  setLocalRating: (id: number, type: 'show' | 'movie' | 'episode', rating: number) => void;
  removeLocalRating: (id: number, type: 'show' | 'movie' | 'episode') => void;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

const CACHE_KEYS = {
  watchedShows: '@trakt_lib_watchedShows',
  watchedMovies: '@trakt_lib_watchedMovies',
  customLists: '@trakt_lib_customLists',
  favShows: '@trakt_lib_favShows',
  favMovies: '@trakt_lib_favMovies',
  watchlistShows: '@trakt_lib_watchlistShows',
  calendarShows: '@trakt_lib_calendarShows',
  watchlistMovies: '@trakt_lib_watchlistMovies',
  calendarMovies: '@trakt_lib_calendarMovies',
  userRatingsShows: '@trakt_lib_userRatingsShows',
  userRatingsMovies: '@trakt_lib_userRatingsMovies',
  userRatingsEpisodes: '@trakt_lib_userRatingsEpisodes',
  showProgressMap: '@trakt_lib_showProgressMap',
  calendarSeasonsMap: '@trakt_lib_calendarSeasonsMap',
  lastFetchTime: '@trakt_lib_lastFetchTime'
};

export const LibraryProvider = ({ children }: { children: React.ReactNode }) => {
  const { accessToken, isLoading: authIsLoading } = useAuth();
  
  const [watchedShows, setWatchedShows] = useState<any[]>([]);
  const [watchedMovies, setWatchedMovies] = useState<any[]>([]);
  const [customLists, setCustomLists] = useState<any[]>([]);
  const [favShows, setFavShows] = useState<any[]>([]);
  const [favMovies, setFavMovies] = useState<any[]>([]);
  const [watchlistShows, setWatchlistShows] = useState<any[]>([]);
  const [calendarShows, setCalendarShows] = useState<any[]>([]);
  const [watchlistMovies, setWatchlistMovies] = useState<any[]>([]);
  const [calendarMovies, setCalendarMovies] = useState<any[]>([]);
  const [userRatingsShows, setUserRatingsShows] = useState<any[]>([]);
  const [userRatingsMovies, setUserRatingsMovies] = useState<any[]>([]);
  const [userRatingsEpisodes, setUserRatingsEpisodes] = useState<any[]>([]);
  const [showProgressMap, setShowProgressMap] = useState<Record<string, any>>({});
  const [calendarSeasonsMap, setCalendarSeasonsMap] = useState<Record<string, any>>({});
  
  const [languageRefreshKey, setLanguageRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoviesLoading, setIsMoviesLoading] = useState(true);
  const lastFetchTimeRef = useRef<number>(0);
  const currentTokenRef = useRef<string | null>(null);

  // Token her deÄŸiÅŸtiÄŸinde (Ã¶rn: Ã§Ä±kÄ±ÅŸ yapÄ±ldÄ±ÄŸÄ±nda) ref'i gÃ¼ncelle
  useEffect(() => {
    currentTokenRef.current = accessToken;
  }, [accessToken]);

  // Dil deÄŸiÅŸtiÄŸinde API'den verileri yeniden Ã§ek
  useEffect(() => {
    const handleLanguageChange = () => {
      console.log('Dil deÄŸiÅŸti, LibraryContext verileri yeniden Ã§ekilecek...');
      lastFetchTimeRef.current = 0;
      setLanguageRefreshKey(prev => prev + 1);
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  const loadCache = useCallback(async () => {
    try {
      // BÃ¼tÃ¼n cache anahtarlarÄ±nÄ± paralel olarak oku
      const keys = Object.values(CACHE_KEYS);
      const results = await AsyncStorage.multiGet(keys);
      const cacheMap = Object.fromEntries(results);

      const getParsed = (key: string) => {
        const data = cacheMap[key];
        return data && data !== 'null' ? JSON.parse(data) : null;
      };

      const parsedProgress = getParsed(CACHE_KEYS.showProgressMap);
      const parsedWatchedShows = getParsed(CACHE_KEYS.watchedShows);

      // Åžema DoÄŸrulamasÄ± (Eski formattaki bozuk/eksik cache'leri engellemek iÃ§in)
      const hasProgressMap = parsedProgress && Object.keys(parsedProgress).length > 0;
      const hasSeasons = parsedWatchedShows && parsedWatchedShows.length > 0 && parsedWatchedShows[0].seasons !== undefined;
      
      if (!hasProgressMap || !hasSeasons) {
        console.log('Cache eksik veya eski formatta, yoksayılıyor...');
        setIsLoading(false); // MUST set false even if cache is invalid!
        return;
      }

      setWatchedShows(parsedWatchedShows || []);
      setWatchedMovies(getParsed(CACHE_KEYS.watchedMovies) || []);
      setCustomLists(getParsed(CACHE_KEYS.customLists) || []);
      setFavShows(getParsed(CACHE_KEYS.favShows) || []);
      setFavMovies(getParsed(CACHE_KEYS.favMovies) || []);
      setWatchlistShows(getParsed(CACHE_KEYS.watchlistShows) || []);
      setCalendarShows(getParsed(CACHE_KEYS.calendarShows) || []);
      setWatchlistMovies(getParsed(CACHE_KEYS.watchlistMovies) || []);
      setCalendarMovies(getParsed(CACHE_KEYS.calendarMovies) || []);
      setUserRatingsShows(getParsed(CACHE_KEYS.userRatingsShows) || []);
      setUserRatingsMovies(getParsed(CACHE_KEYS.userRatingsMovies) || []);
      setUserRatingsEpisodes(getParsed(CACHE_KEYS.userRatingsEpisodes) || []);
      setShowProgressMap(parsedProgress || {});
      setCalendarSeasonsMap(getParsed(CACHE_KEYS.calendarSeasonsMap) || {});
      lastFetchTimeRef.current = getParsed(CACHE_KEYS.lastFetchTime) || 0;
      setIsLoading(false);
      
    } catch (error) {
      console.log('Cache okuma hatasÄ±:', error);
    }
  }, []);

  const fetchFreshData = useCallback(async (force = false) => {
    if (!accessToken) {
      setIsLoading(false);
      setIsMoviesLoading(false);
      return;
    }
    
    const activeToken = accessToken; // Fonksiyon baÅŸladÄ±ÄŸÄ±ndaki token'Ä± sabitliyoruz

    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    if (!force && (now - lastFetchTimeRef.current < tenMinutes)) {
      console.log('TTL geÃ§erli, arka plan fetch iÅŸlemi atlanÄ±yor...');
      setIsLoading(false);
      setIsMoviesLoading(false);
      return;
    }
    
    setIsMoviesLoading(true);
    try {
      // ÖNCELİKLİ (KRİTİK) İSTEKLER - Ana ekran (Diziler) için gerekenler
      // Sadece 3 istek atarak tarayıcının 6 connection limitini aşmıyoruz!
      const pShowsData = getWatchedShows().catch((e) => { console.error('getWatchedShows failed', e.message); return null; });
      const pWlistShows = getWatchlistShows().catch((e) => { console.error('getWatchlistShows failed', e.message); return null; });
      const pCalShows = getMyCalendarShows(33).catch((e) => { console.error('getMyCalendarShows failed', e.message); return null; });

      // ARKA PLAN (İKİNCİL) İSTEKLER - Aşağıda ayrı ele alınacak

      const [showsData, wlistShows, calShows] = await Promise.all([pShowsData, pWlistShows, pCalShows]);

      const [cachedShowsStr, cachedProgressStr, cachedSeasonsStr] = await AsyncStorage.multiGet([
        CACHE_KEYS.watchedShows, 
        CACHE_KEYS.showProgressMap,
        CACHE_KEYS.calendarSeasonsMap
      ]);
      
      let oldWatchedShowsMap = new Map();
      let oldProgressMap: Record<string, any> = {};
      let oldSeasonsMap: Record<string, any> = {};

      if (cachedShowsStr[1]) {
        try {
          const arr = JSON.parse(cachedShowsStr[1]);
          arr.forEach((item: any) => {
            if (item.show?.ids?.trakt) {
              oldWatchedShowsMap.set(item.show.ids.trakt, item.last_watched_at);
            }
          });
        } catch (e) {}
      }

      if (cachedProgressStr[1]) {
        try { oldProgressMap = JSON.parse(cachedProgressStr[1]); } catch (e) {}
      }
      
      if (cachedSeasonsStr[1]) {
        try { oldSeasonsMap = JSON.parse(cachedSeasonsStr[1]); } catch (e) {}
      }

      const showIds = new Set<number>();
      let fetchCount = 0;
      
      showsData?.forEach((item: any) => {
        const traktId = item.show.ids.trakt;
        const oldWatchedAt = oldWatchedShowsMap.get(traktId);
        
        if (oldWatchedAt !== item.last_watched_at || !oldProgressMap[traktId]) {
          showIds.add(traktId);
          fetchCount++;
        }
      });
      
      wlistShows?.forEach((item: any) => {
        const traktId = item.show.ids.trakt;
        if (!oldProgressMap[traktId]) {
          showIds.add(traktId);
        }
      });

      console.log(`Delta Sync: Toplam ${(showsData?.length || 0) + (wlistShows?.length || 0)} diziden sadece ${showIds.size} tanesinin ilerlemesi yeniden çekilecek.`);

      if (showsData !== null) setWatchedShows(showsData);
      if (wlistShows !== null) setWatchlistShows(wlistShows);
      if (calShows !== null) setCalendarShows(calShows);

      // UI KİLİDİNİ AÇ! Ana sayfa için gerekenler geldi.
      setIsLoading(false); 

      // TIER 2: FİLMLER SEKME İHTİYAÇLARI (Acil)
      Promise.all([
        getWatchlistMovies().catch((e) => { console.error('getWatchlistMovies failed', e.message); return null; }),
        getMyCalendarMovies(33).catch((e) => { console.error('getMyCalendarMovies failed', e.message); return null; })
      ]).then(([wlistMovies, calMovies]) => {
        if (wlistMovies !== null) setWatchlistMovies(wlistMovies);
        if (calMovies !== null) setCalendarMovies(calMovies);
        
        setIsMoviesLoading(false); // Filmler kalkanı kalktı!
        
        const multiSetDataMovies: [string, string][] = [];
        const prevWatchlistMovies = wlistMovies !== null ? wlistMovies : watchlistMovies;
        const prevCalendarMovies = calMovies !== null ? calMovies : calendarMovies;
        
        multiSetDataMovies.push([CACHE_KEYS.watchlistMovies, JSON.stringify(prevWatchlistMovies)]);
        multiSetDataMovies.push([CACHE_KEYS.calendarMovies, JSON.stringify(prevCalendarMovies)]);
        AsyncStorage.multiSet(multiSetDataMovies).catch(err => console.log(err));
      });

      // TIER 3: ARKA PLAN İSTEKLERİ (Ağır Yük - Geçmiş, Puanlar vb.)
      setTimeout(() => {
        Promise.all([
          getWatchedMovies().catch((e) => { console.error('getWatchedMovies failed', e.message); return null; }),
          getCustomLists().catch((e) => { console.error('getCustomLists failed', e.message); return null; }),
          getLikedShows().catch((e) => { console.error('getLikedShows failed', e.message); return null; }),
          getLikedMovies().catch((e) => { console.error('getLikedMovies failed', e.message); return null; }),
          getUserRatings('shows').catch((e) => { console.error('getUserRatings shows failed', e.message); return null; }),
          getUserRatings('movies').catch((e) => { console.error('getUserRatings movies failed', e.message); return null; }),
          getUserRatings('episodes').catch((e) => { console.error('getUserRatings episodes failed', e.message); return null; })
        ]).then(([moviesData, listsData, fShowsData, fMoviesData, rShowsData, rMoviesData, rEpisodesData]) => {
          if (moviesData !== null) setWatchedMovies(moviesData);
          if (listsData !== null) setCustomLists(listsData);
          if (fShowsData !== null) setFavShows(fShowsData);
          if (fMoviesData !== null) setFavMovies(fMoviesData);
          if (rShowsData !== null) setUserRatingsShows(rShowsData);
          if (rMoviesData !== null) setUserRatingsMovies(rMoviesData);
          if (rEpisodesData !== null) setUserRatingsEpisodes(rEpisodesData);

          const multiSetDataInitial: [string, string][] = [];
          const setIfValidInitial = (key: string, data: any, prevData: any) => {
            const finalData = data !== null ? data : prevData;
            multiSetDataInitial.push([key, JSON.stringify(finalData)]);
          };

          setIfValidInitial(CACHE_KEYS.watchedShows, showsData, watchedShows);
          setIfValidInitial(CACHE_KEYS.watchedMovies, moviesData, watchedMovies);
          setIfValidInitial(CACHE_KEYS.customLists, listsData, customLists);
          setIfValidInitial(CACHE_KEYS.favShows, fShowsData, favShows);
          setIfValidInitial(CACHE_KEYS.favMovies, fMoviesData, favMovies);
          setIfValidInitial(CACHE_KEYS.watchlistShows, wlistShows, watchlistShows);
          setIfValidInitial(CACHE_KEYS.calendarShows, calShows, calendarShows);
          setIfValidInitial(CACHE_KEYS.userRatingsShows, rShowsData, userRatingsShows);
          setIfValidInitial(CACHE_KEYS.userRatingsMovies, rMoviesData, userRatingsMovies);
          setIfValidInitial(CACHE_KEYS.userRatingsEpisodes, rEpisodesData, userRatingsEpisodes);
          
          AsyncStorage.multiSet(multiSetDataInitial).catch(err => console.log('Initial cache save error:', err));
        });
      }, 500);



      (async () => {
        const uniqueIds = Array.from(showIds);
        const CHUNK_SIZE = 6;
        
        let newProgressMap: Record<string, any> = {};

        for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
          const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
          await Promise.all(chunk.map(async (id) => {
            try {
              const progress = await getShowProgress(id as number);
              newProgressMap[id as number] = progress;
            } catch(e) {
              console.log('Progress çekilemedi: ', id);
            }
          }));
          if (i + CHUNK_SIZE < uniqueIds.length) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        }

        const mergedProgress = { ...oldProgressMap, ...newProgressMap };
        setShowProgressMap(mergedProgress);
        
        const updatedTime = Date.now();
        lastFetchTimeRef.current = updatedTime;
        
        const progressCacheData: [string, string][] = [
          [CACHE_KEYS.showProgressMap, JSON.stringify(mergedProgress)],
          [CACHE_KEYS.lastFetchTime, JSON.stringify(updatedTime)]
        ];

        AsyncStorage.multiSet(progressCacheData).catch(err => {
          console.error('AsyncStorage progress save error:', err);
        });
        
        if (true) { // calShows koşulunu kaldırdık çünkü progressMap ve watchlist de kullanılacak
          try {
            const calShowIds = new Set<number>();
            if (calShows) {
              calShows.forEach((item: any) => {
                const id = item.show?.ids?.trakt;
                if (id) calShowIds.add(id);
              });
            }

            if (showsData) {
              showsData.forEach((item: any) => {
                const id = item.show?.ids?.trakt;
                const status = item.show?.status;
                if (id && status !== 'ended' && status !== 'canceled') {
                  calShowIds.add(id);
                }
              });
            }

            if (wlistShows) {
              wlistShows.forEach((item: any) => {
                const id = item.show?.ids?.trakt;
                const status = item.show?.status;
                if (id && status !== 'ended' && status !== 'canceled') {
                  calShowIds.add(id);
                }
              });
            }
            
            const calUniqueIds = Array.from(calShowIds);
            let updatedSeasonsMap = { ...oldSeasonsMap };
            let fetchedAny = false;
            
            const TTL_48_HOURS = 48 * 60 * 60 * 1000;
            const now = Date.now();
            const nowMillis = Date.now();

            for (let i = 0; i < calUniqueIds.length; i += CHUNK_SIZE) {
              const chunk = calUniqueIds.slice(i, i + CHUNK_SIZE);
              await Promise.all(chunk.map(async (id) => {
                const cachedData = updatedSeasonsMap[id];
                if (!cachedData || !cachedData.fetchedAt || (nowMillis - cachedData.fetchedAt > TTL_48_HOURS)) {
                  try {
                    const seasons = await getShowSeasons(id);
                    
                    // VERİ BUDAMA (Data Pruning): Sadece gelecekte olan bölümleri ve minimum veriyi tut.
                    // AsyncStorage (SQLite) boyut limitini (CursorWindow size limit) aşmamak için kritik.
                    const minimalSeasons = seasons.map((s: any) => ({
                      number: s.number,
                      episodes: s.episodes?.filter((ep: any) => {
                        if (!ep.first_aired) return false;
                        const airedTime = new Date(ep.first_aired).getTime();
                        return airedTime > nowMillis;
                      }).map((ep: any) => ({
                        season: ep.season,
                        number: ep.number,
                        title: ep.title,
                        first_aired: ep.first_aired
                      })) || []
                    })).filter((s: any) => s.episodes.length > 0);

                    updatedSeasonsMap[id] = {
                      fetchedAt: nowMillis,
                      data: minimalSeasons
                    };
                    fetchedAny = true;
                  } catch(e) {
                    console.log('Seasons çekilemedi: ', id);
                  }
                }
              }));
              if (i + CHUNK_SIZE < calUniqueIds.length) {
                await new Promise(resolve => setTimeout(resolve, 150));
              }
            }
            
            setCalendarSeasonsMap(updatedSeasonsMap);
            
            if (fetchedAny) {
              safeStorageSet(CACHE_KEYS.calendarSeasonsMap, JSON.stringify(updatedSeasonsMap));
            }
          } catch (e) {
            console.log('Calendar seasons background fetch error', e);
          }
        }

      })();
    } catch (error) {
      console.log('Trakt veri çekme hatası:', error);
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authIsLoading) return;

    if (accessToken) {
      loadCache().then(() => {
        fetchFreshData(languageRefreshKey > 0);
      });
    } else {
      setWatchedShows([]);
      setWatchedMovies([]);
      setCustomLists([]);
      setFavShows([]);
      setFavMovies([]);
      setWatchlistShows([]);
      setCalendarShows([]);
      setWatchlistMovies([]);
      setCalendarMovies([]);
      setUserRatingsShows([]);
      setUserRatingsMovies([]);
      setUserRatingsEpisodes([]);
      setShowProgressMap({});
      setIsLoading(false);
      setIsMoviesLoading(false);
    }
  }, [accessToken, authIsLoading, loadCache, fetchFreshData, languageRefreshKey]);

  const markEpisodeAsWatched = useCallback(async (showId: number, season: number, episode: number) => {
    let previousState: any = null;

    console.log(`[OPTIMISTIC UI] BÃ¶lÃ¼m UI'da iÅŸaretleniyor: Show ${showId}, S${season}E${episode}`);
    
    setShowProgressMap(prev => {
      previousState = prev[showId]; 

      const currentProgress = prev[showId];
      if (!currentProgress || !currentProgress.next_episode) return prev; 

      const optimisticProgress = {
        ...currentProgress,
        next_episode: {
          ...currentProgress.next_episode,
          number: currentProgress.next_episode.number + 1,
          title: 'Kaydediliyor...',
        },
      };

      return { ...prev, [showId]: optimisticProgress };
    });

    try {
      console.log(`[API REQUEST] Trakt'a gÃ¶nderiliyor...`);
      await addEpisodeToHistory(showId, season, episode);
      console.log(`[API SUCCESS] Trakt ile senkronize edildi. GerÃ§ek veri Ã§ekiliyor...`);
      
      let newProgress = await getShowProgress(showId);
      
      const staleSeason = newProgress?.seasons?.find((s:any) => s.number === season);
      const staleEp = staleSeason?.episodes?.find((e:any) => e.number === episode);
      
      if (staleEp && !staleEp.completed) {
        console.warn(`[STALE DATA] Trakt progress henüz güncellenmedi (S${season}E${episode} completed=false). Lokal yama uygulanıyor...`);
        staleEp.completed = true;
        if (newProgress.next_episode) {
          newProgress.next_episode = {
            ...newProgress.next_episode,
            number: episode + 1,
            title: 'Sıradaki Bölüm Aranıyor...'
          };
        }
      }

      setShowProgressMap(prev => {
        const updated = { ...prev, [showId]: newProgress };
        safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
        return updated;
      });

      return newProgress;
    } catch (error) {
      console.error(`[API ERROR] Ä°ÅŸlem baÅŸarÄ±sÄ±z, eski haline (Rollback) dÃ¶nÃ¼lÃ¼yor!`, error);
      if (previousState !== null) {
        setShowProgressMap(prev => ({ ...prev, [showId]: previousState }));
      }
      throw error;
    }
  }, []);

  const unwatchEpisode = useCallback(async (showId: number, season: number, episode: number) => {
    let previousState: any = null;

    console.log(`[OPTIMISTIC UI] Bölüm UI'da Kaldırılıyor: Show ${showId}, S${season}E${episode}`);
    
    setShowProgressMap(prev => {
      previousState = prev[showId]; 

      const currentProgress = prev[showId];
      if (!currentProgress || !currentProgress.next_episode) return prev; 

      const optimisticProgress = {
        ...currentProgress,
        next_episode: {
          ...currentProgress.next_episode,
          number: Math.max(1, episode), 
          title: 'Geri Alınıyor...',
        },
      };

      return { ...prev, [showId]: optimisticProgress };
    });

    try {
      console.log(`[API REQUEST] Trakt'tan Bölüm Siliniyor...`);
      await removeEpisodeFromHistoryTrakt(showId, season, episode);
      console.log(`[API SUCCESS] Trakt üzerinden silindi. Gerçek veri çekiliyor...`);
      
      let newProgress = await getShowProgress(showId);
      
      const staleSeason = newProgress?.seasons?.find((s:any) => s.number === season);
      const staleEp = staleSeason?.episodes?.find((e:any) => e.number === episode);
      
      if (staleEp && staleEp.completed) {
        console.warn(`[STALE DATA] Trakt progress henüz güncellenmedi (S${season}E${episode} completed=true). Lokal yama uygulanıyor...`);
        staleEp.completed = false;
        
        newProgress.next_episode = {
          season: season,
          number: episode,
          title: staleEp.title,
          ids: staleEp.ids
        };
      }

      let currentCompletedCount = newProgress.completed;
      if (staleEp && staleEp.completed !== undefined) { 
         currentCompletedCount = Math.max(0, currentCompletedCount - 1);
      }
      
      if (currentCompletedCount === 0) {
          console.log(`[WATCHLIST RECOVERY] Dizi hiç izlenmemiş duruma düştü, Watchlist'e geri ekleniyor...`);
          await addToWatchlistTrakt(showId, 'show');
          fetchFreshData(true);
      }

      setShowProgressMap(prev => {
        const updated = { ...prev, [showId]: newProgress };
        safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
        return updated;
      });

      return newProgress;
    } catch (error) {
      console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
      if (previousState !== null) {
        setShowProgressMap(prev => {
          const updated = { ...prev, [showId]: previousState };
          safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
          return updated;
        });
      }
      throw error;
    }
  }, [fetchFreshData]);

  const unwatchSeason = useCallback(async (showId: number, season: number) => {
    let previousState: any = null;

    console.log(`[OPTIMISTIC UI] Sezon UI'da Kaldırılıyor: Show ${showId}, S${season}`);
    
    setShowProgressMap(prev => {
      previousState = prev[showId]; 
      
      const currentProgress = prev[showId];
      if (!currentProgress) return prev;
      
      const optimisticProgress = {
        ...currentProgress,
        next_episode: {
          season: season,
          number: 1,
          title: 'Sezon Geri Alınıyor...',
        },
      };

      return { ...prev, [showId]: optimisticProgress };
    });

    try {
      console.log(`[API REQUEST] Trakt'tan Sezon Siliniyor...`);
      await removeSeasonFromHistoryTrakt(showId, season);
      console.log(`[API SUCCESS] Trakt üzerinden silindi. Gerçek veri çekiliyor...`);
      
      let newProgress = await getShowProgress(showId);
      
      if (newProgress.completed === 0) {
          console.log(`[WATCHLIST RECOVERY] Dizi hiç izlenmemiş duruma düştü, Watchlist'e geri ekleniyor...`);
          await addToWatchlistTrakt(showId, 'show');
          fetchFreshData(true);
      }

      setShowProgressMap(prev => {
        const updated = { ...prev, [showId]: newProgress };
        safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
        return updated;
      });

      return newProgress;
    } catch (error) {
      console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
      if (previousState !== null) {
        setShowProgressMap(prev => {
          const updated = { ...prev, [showId]: previousState };
          safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
          return updated;
        });
      }
      throw error;
    }
  }, [fetchFreshData]);

  const rewatchEpisode = useCallback(async (showId: number, season: number, episode: number) => {
    return markEpisodeAsWatched(showId, season, episode);
  }, [markEpisodeAsWatched]);

  const markSeasonAsWatched = useCallback(async (showId: number, season: number) => {
    let previousState: any = null;
    console.log(`[OPTIMISTIC UI] Sezon UI'da iÅŸaretleniyor: Show ${showId}, S${season}`);

    setShowProgressMap(prev => {
      previousState = prev[showId];

      const currentProgress = prev[showId];
      if (!currentProgress || !currentProgress.next_episode) return prev;

      const optimisticProgress = {
        ...currentProgress,
        next_episode: {
          ...currentProgress.next_episode,
          title: 'Kaydediliyor...',
        },
      };

      return { ...prev, [showId]: optimisticProgress };
    });

    try {
      console.log(`[API REQUEST] Trakt'a gÃ¶nderiliyor (Sezon)...`);
      await addSeasonToHistory(showId, season);
      console.log(`[API SUCCESS] Trakt ile senkronize edildi. GerÃ§ek veri Ã§ekiliyor...`);
      
      const newProgress = await getShowProgress(showId);
      
      setShowProgressMap(prev => {
        const updated = { ...prev, [showId]: newProgress };
        safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
        return updated;
      });

      return newProgress;
    } catch (error) {
      console.error(`[API ERROR] Sezon iÅŸaretleme baÅŸarÄ±sÄ±z, eski haline dÃ¶nÃ¼lÃ¼yor!`, error);
      if (previousState !== null) {
        setShowProgressMap(prev => ({ ...prev, [showId]: previousState }));
      }
      throw error;
    }
  }, []);

  const markEpisodesUpToAsWatched = useCallback(async (showId: number, season: number, episodes: number[]) => {
    let previousState: any = null;
    console.log(`[OPTIMISTIC UI] BÃ¶lÃ¼mler toplu UI'da iÅŸaretleniyor: Show ${showId}, S${season}`);

    setShowProgressMap(prev => {
      previousState = prev[showId];

      const currentProgress = prev[showId];
      if (!currentProgress || !currentProgress.next_episode) return prev;

      const optimisticProgress = {
        ...currentProgress,
        next_episode: {
          ...currentProgress.next_episode,
          title: 'Kaydediliyor...',
        },
      };

      return { ...prev, [showId]: optimisticProgress };
    });

    try {
      console.log(`[API REQUEST] Trakt'a gÃ¶nderiliyor (Toplu BÃ¶lÃ¼m)...`);
      await addEpisodesBulkToHistory(showId, season, episodes);
      console.log(`[API SUCCESS] Trakt ile senkronize edildi. GerÃ§ek veri Ã§ekiliyor...`);
      
      const newProgress = await getShowProgress(showId);
      
      setShowProgressMap(prev => {
        const updated = { ...prev, [showId]: newProgress };
        safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
        return updated;
      });

      return newProgress;
    } catch (error) {
      console.error(`[API ERROR] Toplu bÃ¶lÃ¼m iÅŸaretleme baÅŸarÄ±sÄ±z, eski haline dÃ¶nÃ¼lÃ¼yor!`, error);
      if (previousState !== null) {
        setShowProgressMap(prev => ({ ...prev, [showId]: previousState }));
      }
      throw error;
    }
  }, []);

  const markMovieAsWatched = useCallback(async (movieId: number) => {
    let previousWatchlist: any = null;
    let previousWatched: any = null;
    let movieItemToMove: any = null;

    console.log(`[OPTIMISTIC UI] Film UI'da anÄ±nda iÅŸaretleniyor: Movie ${movieId}`);

    setWatchlistMovies(prev => {
      previousWatchlist = prev;
      const item = prev.find(p => p.movie.ids.trakt === movieId);
      if (item) {
        movieItemToMove = item;
        const newWatchlist = prev.filter(p => p.movie.ids.trakt !== movieId);
        safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(newWatchlist));
        return newWatchlist;
      }
      return prev;
    });

    setWatchedMovies(prev => {
      previousWatched = prev;
      const exists = prev.find(p => p.movie.ids.trakt === movieId);
      if (!exists && movieItemToMove) {
        const newWatched = [
          {
            plays: 1,
            last_watched_at: new Date().toISOString(),
            movie: movieItemToMove.movie
          },
          ...prev
        ];
        safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(newWatched));
        return newWatched;
      }
      return prev;
    });

    try {
      console.log(`[API REQUEST] Trakt'a gÃ¶nderiliyor (Film)...`);
      await addMovieToHistory(movieId);
      console.log(`[API SUCCESS] Film Trakt ile senkronize edildi.`);
    } catch (error) {
      console.error(`[API ERROR] Film iÅŸaretleme baÅŸarÄ±sÄ±z, eski haline dÃ¶nÃ¼lÃ¼yor!`, error);
      if (previousWatchlist !== null) {
        setWatchlistMovies(previousWatchlist);
        safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(previousWatchlist));
      }
      if (previousWatched !== null) {
        setWatchedMovies(previousWatched);
        safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(previousWatched));
      }
      throw error;
    }
  }, []);

  const toggleWatchlistStatus = useCallback(async (id: number, type: 'show' | 'movie', isCurrentlyWatchlisted: boolean, mediaData: any) => {
    let previousWatchlistShows: any[] | null = null;
    let previousWatchlistMovies: any[] | null = null;

    if (type === 'show') {
      setWatchlistShows(prev => {
        previousWatchlistShows = prev;
        const newWatchlist = isCurrentlyWatchlisted 
          ? prev.filter(p => p.show?.ids?.trakt !== id)
          : [{ listed_at: new Date().toISOString(), show: mediaData }, ...prev];
        safeStorageSet(CACHE_KEYS.watchlistShows, JSON.stringify(newWatchlist));
        return newWatchlist;
      });
    } else {
      setWatchlistMovies(prev => {
        previousWatchlistMovies = prev;
        const newWatchlist = isCurrentlyWatchlisted 
          ? prev.filter(p => p.movie?.ids?.trakt !== id)
          : [{ listed_at: new Date().toISOString(), movie: mediaData }, ...prev];
        safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(newWatchlist));
        return newWatchlist;
      });
    }

    try {
      if (isCurrentlyWatchlisted) {
        await removeFromWatchlistTrakt(id, type);
      } else {
        await addToWatchlistTrakt(id, type);
      }
    } catch (err) {
      console.error('Toggle watchlist hatası, rollback yapılıyor:', err);
      if (type === 'show' && previousWatchlistShows !== null) {
        setWatchlistShows(previousWatchlistShows);
        safeStorageSet(CACHE_KEYS.watchlistShows, JSON.stringify(previousWatchlistShows));
      } else if (type === 'movie' && previousWatchlistMovies !== null) {
        setWatchlistMovies(previousWatchlistMovies);
        safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(previousWatchlistMovies));
      }
      throw err; 
    }
  }, []);

  const toggleFavoriteStatus = useCallback(async (id: number, type: 'show' | 'movie', isCurrentlyFavorited: boolean, mediaData: any) => {
    let previousFavShows: any[] | null = null;
    let previousFavMovies: any[] | null = null;

    if (type === 'show') {
      setFavShows(prev => {
        previousFavShows = prev;
        const newFavs = isCurrentlyFavorited 
          ? prev.filter(p => p.show?.ids?.trakt !== id)
          : [{ listed_at: new Date().toISOString(), show: mediaData }, ...prev];
        safeStorageSet(CACHE_KEYS.favShows, JSON.stringify(newFavs));
        return newFavs;
      });
    } else {
      setFavMovies(prev => {
        previousFavMovies = prev;
        const newFavs = isCurrentlyFavorited 
          ? prev.filter(p => p.movie?.ids?.trakt !== id)
          : [{ listed_at: new Date().toISOString(), movie: mediaData }, ...prev];
        safeStorageSet(CACHE_KEYS.favMovies, JSON.stringify(newFavs));
        return newFavs;
      });
    }

    try {
      // Trakt API'ye özel listeye ekleme/çıkarma isteğini gönder
      await toggleLikedMedia(id, type, !isCurrentlyFavorited);
    } catch (err) {
      console.error('Toggle favorite hatası, rollback yapılıyor:', err);
      if (type === 'show' && previousFavShows !== null) {
        setFavShows(previousFavShows);
        safeStorageSet(CACHE_KEYS.favShows, JSON.stringify(previousFavShows));
      } else if (type === 'movie' && previousFavMovies !== null) {
        setFavMovies(previousFavMovies);
        safeStorageSet(CACHE_KEYS.favMovies, JSON.stringify(previousFavMovies));
      }
      throw err; 
    }
  }, []);

  const hideMediaFromProgress = useCallback(async (id: number, type: 'show' | 'movie') => {
    try {
      await hideItemTrakt(id, type);
      fetchFreshData(true);
    } catch (err) {
      console.error('Hide media hatasÄ±:', err);
    }
  }, [fetchFreshData]);

  const deleteMediaFromHistory = useCallback(async (id: number, type: 'show' | 'movie') => {
    if (type === 'show') {
      setWatchedShows(prev => {
        const newWatched = prev.filter(p => p.show?.ids?.trakt !== id);
        safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(newWatched));
        return newWatched;
      });
      setShowProgressMap(prev => {
        const newMap = { ...prev };
        delete newMap[id];
        safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(newMap));
        return newMap;
      });
    } else {
      setWatchedMovies(prev => {
        const newWatched = prev.filter(p => p.movie?.ids?.trakt !== id);
        safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(newWatched));
        return newWatched;
      });
    }

    try {
      await removeFromHistoryTrakt(id, type);
    } catch (err) {
      console.error('Delete from history hatası:', err);
      fetchFreshData(true);
    }
  }, [fetchFreshData]);

  const createNewList = useCallback(async (name: string, description?: string) => {
    try {
      const newList = await createCustomList(name, description);
      setCustomLists(prev => {
        const updated = [newList, ...prev];
        safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(updated));
        return updated;
      });
      return newList;
    } catch (err) {
      console.error('Liste oluşturma hatası:', err);
      throw err;
    }
  }, []);

  const toggleMediaInList = useCallback(async (listId: number, mediaId: number, type: 'show' | 'movie', isAdding: boolean) => {
    try {
      if (isAdding) {
        await addMediaToCustomList(listId, mediaId, type);
      } else {
        await removeMediaFromCustomList(listId, mediaId, type);
      }
      
      setCustomLists(prev => {
        const updated = prev.map(list => {
          if (list.ids.trakt === listId) {
            return {
              ...list,
              item_count: isAdding ? (list.item_count || 0) + 1 : Math.max(0, (list.item_count || 0) - 1)
            };
          }
          return list;
        });
        safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.error('Liste medyası ekle/çıkar hatası:', err);
    }
  }, []);

  const setLocalRating = useCallback((id: number, type: 'show' | 'movie' | 'episode', rating: number) => {
    const updateStateAndCache = (
      setFn: React.Dispatch<React.SetStateAction<any[]>>,
      cacheKey: string,
      itemKey: string
    ) => {
      setFn(prev => {
        // Eğer zaten varsa güncelle
        const existsIndex = prev.findIndex(r => r[itemKey]?.ids?.trakt === id);
        let updated;
        if (existsIndex >= 0) {
          updated = [...prev];
          updated[existsIndex] = { ...updated[existsIndex], rating };
        } else {
          // Yoksa ekle
          updated = [...prev, { rating, [itemKey]: { ids: { trakt: id } } }];
        }
        safeStorageSet(cacheKey, JSON.stringify(updated));
        return updated;
      });
    };

    if (type === 'show') updateStateAndCache(setUserRatingsShows, CACHE_KEYS.userRatingsShows, 'show');
    else if (type === 'movie') updateStateAndCache(setUserRatingsMovies, CACHE_KEYS.userRatingsMovies, 'movie');
    else if (type === 'episode') updateStateAndCache(setUserRatingsEpisodes, CACHE_KEYS.userRatingsEpisodes, 'episode');
  }, []);

  const removeLocalRating = useCallback((id: number, type: 'show' | 'movie' | 'episode') => {
    const removeStateAndCache = (
      setFn: React.Dispatch<React.SetStateAction<any[]>>,
      cacheKey: string,
      itemKey: string
    ) => {
      setFn(prev => {
        const updated = prev.filter(r => r[itemKey]?.ids?.trakt !== id);
        safeStorageSet(cacheKey, JSON.stringify(updated));
        return updated;
      });
    };

    if (type === 'show') removeStateAndCache(setUserRatingsShows, CACHE_KEYS.userRatingsShows, 'show');
    else if (type === 'movie') removeStateAndCache(setUserRatingsMovies, CACHE_KEYS.userRatingsMovies, 'movie');
    else if (type === 'episode') removeStateAndCache(setUserRatingsEpisodes, CACHE_KEYS.userRatingsEpisodes, 'episode');
  }, []);

  const value = useMemo(() => ({
    watchedShows,
    watchedMovies,
    customLists,
    favShows,
    favMovies,
    watchlistShows,
    calendarShows,
    watchlistMovies,
    calendarMovies,
    userRatingsShows,
    userRatingsMovies,
    userRatingsEpisodes,
    showProgressMap,
    calendarSeasonsMap,
    isLoading,
    isMoviesLoading,
    refreshLibrary: async () => await fetchFreshData(true),
    markEpisodeAsWatched,
    markSeasonAsWatched,
    markEpisodesUpToAsWatched,
    markMovieAsWatched,
    toggleWatchlistStatus,
    toggleFavoriteStatus,
    hideMediaFromProgress,
    deleteMediaFromHistory,
    unwatchEpisode,
    unwatchSeason,
    rewatchEpisode,
    createNewList,
    toggleMediaInList,
    setLocalRating,
    removeLocalRating
  }), [
    watchedShows, watchedMovies, customLists, favShows, favMovies, 
    watchlistShows, calendarShows, watchlistMovies, calendarMovies, calendarSeasonsMap,
    userRatingsShows, userRatingsMovies, userRatingsEpisodes, showProgressMap, isLoading, isMoviesLoading, fetchFreshData, markEpisodeAsWatched, markSeasonAsWatched, markEpisodesUpToAsWatched, markMovieAsWatched, toggleWatchlistStatus, toggleFavoriteStatus, hideMediaFromProgress, deleteMediaFromHistory, unwatchEpisode, unwatchSeason, rewatchEpisode, createNewList, toggleMediaInList, setLocalRating, removeLocalRating
  ]);

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (context === undefined) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
};


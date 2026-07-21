import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibraryStore } from '../../store/useLibraryStore';
import {
  getWatchedShows,
  getWatchedMovies,
  getCustomLists,
  getWatchlistShows,
  getMyCalendarShows,
  getShowProgress,
  getWatchlistMovies,
  getMyCalendarMovies,
  getUserRatings,
  getShowSeasons,
  getLikedShows,
  getLikedMovies,
  getUserStats,
} from '../traktApi';
import {
  CACHE_KEYS,
  safeStorageSet,
  setWatchedShows,
  setWatchedMovies,
  setCustomLists,
  setFavShows,
  setFavMovies,
  setWatchlistShows,
  setCalendarShows,
  setWatchlistMovies,
  setCalendarMovies,
  setUserRatingsShows,
  setUserRatingsMovies,
  setUserRatingsEpisodes,
  setShowProgressMap,
  setCalendarSeasonsMap,
  setUserStats,
  setIsLoading,
  setIsMoviesLoading,
} from './utils';

let lastFetchTimeRef = { current: 0 };

// Android'de tek bir aşırı büyük satır (SQLite CursorWindow limiti) TÜM multiGet
// batch'ini patlatabilir. Bu durumda anahtarları tek tek okuyarak yalnızca bozuk
// dilimin kaybolmasını sağlarız — cihazlar arası "bende çalışıyor, onda çalışmıyor"
// farklarının tipik bir kaynağı budur.
const safeMultiGet = async (keys: string[]): Promise<Record<string, string | null>> => {
  try {
    const results = await AsyncStorage.multiGet(keys);
    return Object.fromEntries(results);
  } catch (batchErr) {
    console.log('multiGet başarısız, anahtarlar tek tek okunuyor:', batchErr);
    const map: Record<string, string | null> = {};
    for (const key of keys) {
      try {
        map[key] = await AsyncStorage.getItem(key);
      } catch {
        map[key] = null;
      }
    }
    return map;
  }
};

export const loadCache = async () => {
  try {
    const keys = Object.values(CACHE_KEYS);
    const cacheMap = await safeMultiGet(keys);

    // Her dilim BAĞIMSIZ parse edilir: biri bozuksa yalnızca o dilim atlanır.
    // ESKİ DAVRANIŞ: progress boş/bozuksa TÜM önbellek (takvim sezon haritası
    // dahil) yok sayılıyordu → o cihaz her açılışta sıfırdan tam senkrona
    // giriyor, kartlar dakikalarca "hesaplanıyor" spinner'ında kalıyordu.
    const getParsed = (key: string) => {
      try {
        const data = cacheMap[key];
        return data && data !== 'null' ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    };

    const parsedProgress = getParsed(CACHE_KEYS.showProgressMap) || {};

    setWatchedShows(getParsed(CACHE_KEYS.watchedShows) || []);
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
    setShowProgressMap(parsedProgress);
    setCalendarSeasonsMap(getParsed(CACHE_KEYS.calendarSeasonsMap) || {});
    setUserStats(getParsed(CACHE_KEYS.userStats) || null);

    // Progress haritası boşsa TTL'yi sıfırla: fetchFreshData kesin çalışsın.
    // Aksi halde 10 dakikalık TTL yüzünden kartlar spinner'da asılı kalırdı.
    const hasProgress = Object.keys(parsedProgress).length > 0;
    lastFetchTimeRef.current = hasProgress ? (getParsed(CACHE_KEYS.lastFetchTime) || 0) : 0;
  } catch (error) {
    console.log('Cache okuma hatası:', error);
  } finally {
    // Hata yolunda bile UI kilidi açılmalı (eskiden catch'te unutulmuştu).
    setIsLoading(false);
  }
};

export const fetchFreshData = async (accessToken: string | null, force = false) => {
  if (!accessToken) {
    setIsLoading(false);
    setIsMoviesLoading(false);
    return;
  }

  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  if (!force && (now - lastFetchTimeRef.current < tenMinutes)) {
    console.log('TTL geçerli, arka plan fetch işlemi atlanıyor...');
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

    const deltaCache = await safeMultiGet([
      CACHE_KEYS.watchedShows,
      CACHE_KEYS.showProgressMap,
      CACHE_KEYS.calendarSeasonsMap
    ]);

    let oldWatchedShowsMap = new Map();
    let oldProgressMap: Record<string, any> = {};
    let oldSeasonsMap: Record<string, any> = {};

    if (deltaCache[CACHE_KEYS.watchedShows]) {
      try {
        const arr = JSON.parse(deltaCache[CACHE_KEYS.watchedShows] as string);
        arr.forEach((item: any) => {
          if (item.show?.ids?.trakt) {
            oldWatchedShowsMap.set(item.show.ids.trakt, item.last_watched_at);
          }
        });
      } catch (e) {}
    }

    if (deltaCache[CACHE_KEYS.showProgressMap]) {
      try { oldProgressMap = JSON.parse(deltaCache[CACHE_KEYS.showProgressMap] as string); } catch (e) {}
    }

    if (deltaCache[CACHE_KEYS.calendarSeasonsMap]) {
      try { oldSeasonsMap = JSON.parse(deltaCache[CACHE_KEYS.calendarSeasonsMap] as string); } catch (e) {}
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

    // TIER 2: FİLMLER SEKME İHTİYAÇLARI (Acil) — profil istatistik kartı da
    // hafif tek bir istek olduğundan (network limitini zorlamaz) bu tur'a eklendi.
    Promise.all([
      getWatchlistMovies().catch((e) => { console.error('getWatchlistMovies failed', e.message); return null; }),
      getMyCalendarMovies(33).catch((e) => { console.error('getMyCalendarMovies failed', e.message); return null; }),
      getUserStats().catch((e) => { console.error('getUserStats failed', e.message); return null; })
    ]).then(([wlistMovies, calMovies, stats]) => {
      if (wlistMovies !== null) setWatchlistMovies(wlistMovies);
      if (calMovies !== null) setCalendarMovies(calMovies);
      if (stats !== null) setUserStats(stats);

      setIsMoviesLoading(false); // Filmler kalkanı kalktı!

      const multiSetDataMovies: [string, string][] = [];
      const prevWatchlistMovies = wlistMovies !== null ? wlistMovies : useLibraryStore.getState().watchlistMovies;
      const prevCalendarMovies = calMovies !== null ? calMovies : useLibraryStore.getState().calendarMovies;
      const prevStats = stats !== null ? stats : useLibraryStore.getState().userStats;

      multiSetDataMovies.push([CACHE_KEYS.watchlistMovies, JSON.stringify(prevWatchlistMovies)]);
      multiSetDataMovies.push([CACHE_KEYS.calendarMovies, JSON.stringify(prevCalendarMovies)]);
      if (prevStats) multiSetDataMovies.push([CACHE_KEYS.userStats, JSON.stringify(prevStats)]);
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

        setIfValidInitial(CACHE_KEYS.watchedShows, showsData, useLibraryStore.getState().watchedShows);
        setIfValidInitial(CACHE_KEYS.watchedMovies, moviesData, useLibraryStore.getState().watchedMovies);
        setIfValidInitial(CACHE_KEYS.customLists, listsData, useLibraryStore.getState().customLists);
        setIfValidInitial(CACHE_KEYS.favShows, fShowsData, useLibraryStore.getState().favShows);
        setIfValidInitial(CACHE_KEYS.favMovies, fMoviesData, useLibraryStore.getState().favMovies);
        setIfValidInitial(CACHE_KEYS.watchlistShows, wlistShows, useLibraryStore.getState().watchlistShows);
        setIfValidInitial(CACHE_KEYS.calendarShows, calShows, useLibraryStore.getState().calendarShows);
        setIfValidInitial(CACHE_KEYS.userRatingsShows, rShowsData, useLibraryStore.getState().userRatingsShows);
        setIfValidInitial(CACHE_KEYS.userRatingsMovies, rMoviesData, useLibraryStore.getState().userRatingsMovies);
        setIfValidInitial(CACHE_KEYS.userRatingsEpisodes, rEpisodesData, useLibraryStore.getState().userRatingsEpisodes);

        AsyncStorage.multiSet(multiSetDataInitial).catch(err => console.log('Initial cache save error:', err));
      });
    }, 500);

    (async () => {
      const uniqueIds = Array.from(showIds);
      const CHUNK_SIZE = 6;
      // Diske her chunk'ta değil, birkaç chunk'ta bir yaz (büyük haritayı
      // sürekli serileştirmemek için).
      const PERSIST_EVERY_CHUNKS = 4;
      let completedChunks = 0;

      for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
        const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
        const chunkResults: Record<string, any> = {};
        await Promise.all(chunk.map(async (id) => {
          try {
            chunkResults[id as number] = await getShowProgress(id as number);
          } catch(e) {
            console.log('Progress çekilemedi: ', id);
          }
        }));

        // KADEMELİ YAYIN: her chunk store'a ANINDA işlenir — kartlardaki
        // "hesaplanıyor" spinner'ları 6'şarlı gruplar halinde söner. Eskiden
        // TÜM döngü bitmeden store'a hiçbir şey yazılmadığından, yavaş ağ +
        // büyük kütüphanede spinner'lar dakikalarca dönüyordu.
        if (Object.keys(chunkResults).length > 0) {
          setShowProgressMap((prev: any) => ({ ...prev, ...chunkResults }));
        }

        // KADEMELİ KALICILIK: senkron yarıda kesilirse (kullanıcı uygulamayı
        // kapatırsa) o ana kadarki ilerleme diskte kalır; sonraki açılış delta
        // sayesinde yalnızca eksikleri çeker. Eskiden hiçbir şey kaydedilmediği
        // için her açılış sıfırdan başlıyordu — "hiç bitmeyen senkron" döngüsü.
        completedChunks++;
        if (completedChunks % PERSIST_EVERY_CHUNKS === 0) {
          AsyncStorage.setItem(
            CACHE_KEYS.showProgressMap,
            JSON.stringify(useLibraryStore.getState().showProgressMap)
          ).catch(() => {});
        }

        if (i + CHUNK_SIZE < uniqueIds.length) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }

      // Son birleşim: eski harita + store'daki güncel hali (senkron sırasında
      // kullanıcının yaptığı işaretlemeler dahil).
      const mergedProgress = { ...oldProgressMap, ...useLibraryStore.getState().showProgressMap };
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
          const nowMillis = Date.now();

          let seasonsChunksSincePersist = 0;
          for (let i = 0; i < calUniqueIds.length; i += CHUNK_SIZE) {
            const chunk = calUniqueIds.slice(i, i + CHUNK_SIZE);
            const chunkEntries: Record<string, any> = {};
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

                  const entry = {
                    fetchedAt: nowMillis,
                    data: minimalSeasons
                  };
                  updatedSeasonsMap[id] = entry;
                  chunkEntries[id] = entry;
                  fetchedAny = true;
                } catch(e) {
                  console.log('Seasons çekilemedi: ', id);
                }
              }
            }));

            // KADEMELİ YAYIN + KALICILIK: "Yaklaşanlar", 33 günlük takvimin
            // ötesindeki bölümleri BU haritadan görür. Eskiden harita yalnızca
            // tüm döngü bitince yazıldığından, senkronu hiç tamamlanamayan
            // cihazlarda 33 günden ötesi asla görünmüyordu — "bende 100 gün
            // sonrası var, onda yok" farkının sebebi buydu.
            if (Object.keys(chunkEntries).length > 0) {
              setCalendarSeasonsMap((prev: any) => ({ ...prev, ...chunkEntries }));
              seasonsChunksSincePersist++;
              if (seasonsChunksSincePersist % 3 === 0) {
                AsyncStorage.setItem(
                  CACHE_KEYS.calendarSeasonsMap,
                  JSON.stringify(updatedSeasonsMap)
                ).catch(() => {});
              }
            }

            if (i + CHUNK_SIZE < calUniqueIds.length) {
              await new Promise(resolve => setTimeout(resolve, 150));
            }
          }

          setCalendarSeasonsMap((prev: any) => ({ ...prev, ...updatedSeasonsMap }));

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
};

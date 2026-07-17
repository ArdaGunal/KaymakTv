import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getDateGroup, isFutureDate, getEpisodeKey } from '../utils/dateHelper';

export const useDashboardData = (
  watchedShows: any[],
  watchlistShows: any[],
  calendarShows: any[],
  showProgressMap: any,
  calendarSeasonsMap: any,
  i18nLanguage: string
) => {
  const { t } = useTranslation('media');

  return useMemo(() => {
    // ============================================
    // 1. WATCHED SHOWS (Sıradakiler & Bırakılanlar)
    // ============================================
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

    for (const item of uniqueHistoryShows) {
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

      let episodeTitle = item.episode?.title || `${t('lastWatched')} ${new Date(item.last_watched_at).toLocaleDateString(i18nLanguage === 'tr' ? 'tr-TR' : 'en-US')}`;

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

      if (progress && !progress.next_episode) {
        continue;
      }

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

    // ============================================
    // 2. WATCHLIST (Henüz Başlanmadı)
    // ============================================
    const watchlistFinal: any[] = [];
    
    for (const item of watchlistShows) {
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

      if (isCompleted) {
        continue;
      }

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

    // ============================================
    // 3. CALENDAR (Yaklaşanlar)
    // ============================================
    const upcomingTemp: any[] = [];
    const seenEpisodes = new Set();

    for (const item of calendarShows) {
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
    
    // 4.5 Calendar Seasons
    Object.entries(calendarSeasonsMap || {}).forEach(([idStr, seasonData]: [string, any]) => {
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
                              slug: showMeta?.ids?.slug,
                              rawDate: dateObj.getTime(),
                              dateGroup: getDateGroup(dateObj, t),
                          });
                      }
                  }
              });
          }
      });
    });

    farFutureTemp.forEach(ff => {
      const uniqueId = getEpisodeKey(ff.traktId, ff.season, ff.episode);
      if (!seenEpisodes.has(uniqueId)) {
        seenEpisodes.add(uniqueId);
        const dateObj = new Date(ff.first_aired);
        upcomingTemp.push({
          id: uniqueId,
          rawTraktId: ff.traktId,
          showName: ff.showName,
          season: ff.season,
          episode: ff.episode,
          title: ff.title,
          tags: [],
          image: null,
          tmdbId: ff.tmdbId,
          slug: ff.slug,
          rawDate: dateObj.getTime(),
          dateGroup: getDateGroup(dateObj, t),
        });
      }
    });

    upcomingTemp.sort((a, b) => a.rawDate - b.rawDate);

    return {
      upNextShows: upNextTemp,
      inactiveShows: inactiveTemp,
      watchlistShowsList: watchlistFinal,
      upcomingShows: upcomingTemp
    };
  }, [
    watchedShows,
    watchlistShows,
    calendarShows,
    showProgressMap,
    calendarSeasonsMap,
    i18nLanguage
  ]);
};

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useLibrary } from '../context/LibraryContext';
import { useAuth } from '../context/AuthContext';
import { addRating, removeRating } from '../services/traktApi';

interface UseShowDetailHandlersProps {
  traktIdNum: number;
  id: string;
  t: (key: string, defaultValue?: string, options?: any) => string;
}

export function useShowDetailHandlers({
  traktIdNum,
  id,
  t,
}: UseShowDetailHandlersProps) {
  const {
    userRatingsShows,
    userRatingsEpisodes,
    markSeasonAsWatched,
    unwatchSeason,
    setLocalRating,
    removeLocalRating,
    unwatchEpisode,
    rewatchEpisode,
  } = useLibrary();
  const { isGuest } = useAuth();

  const [seasonLoading, setSeasonLoading] = useState<Record<number, boolean>>({});
  const [localLoadingOption, setLocalLoadingOption] = useState<'remove' | 'rewatch' | null>(null);
  const [snackbarData, setSnackbarData] = useState<{showId: number, season: number, episode: number} | null>(null);

  const userRatingObj = userRatingsShows?.find((r: any) => r.show?.ids?.trakt === traktIdNum);
  const userRating = userRatingObj ? userRatingObj.rating : null;

  const handleRate = useCallback(async (rating: number) => {
    try {
      setLocalRating(traktIdNum, 'show', rating * 2);
      await addRating(traktIdNum, 'show', rating);
    } catch (e) {
      removeLocalRating(traktIdNum, 'show');
      Alert.alert(t('common:error'), 'Puan kaydedilirken bir hata oluştu.');
      console.error(e);
    }
  }, [traktIdNum, setLocalRating, removeLocalRating, t]);

  const handleRemoveRating = useCallback(async () => {
    try {
      removeLocalRating(traktIdNum, 'show');
      await removeRating(traktIdNum, 'show');
    } catch (e) {
      Alert.alert(t('common:error'), 'Puan silinirken bir hata oluştu.');
      console.error(e);
    }
  }, [traktIdNum, removeLocalRating, t]);

  const handleMarkSeason = useCallback(async (seasonNum: number, isWatched: boolean) => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    try {
      setSeasonLoading(prev => ({ ...prev, [seasonNum]: true }));
      if (isWatched) {
        await unwatchSeason(parseInt(id as string, 10), seasonNum);
      } else {
        await markSeasonAsWatched(parseInt(id as string, 10), seasonNum);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSeasonLoading(prev => ({ ...prev, [seasonNum]: false }));
    }
  }, [isGuest, id, markSeasonAsWatched, unwatchSeason, t]);

  const handleUnwatchEpisode = useCallback(async (selectedEpisode: {season: number, episode: number} | null) => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    if (!selectedEpisode) return;
    setLocalLoadingOption('remove');
    try {
      await unwatchEpisode(traktIdNum, selectedEpisode.season, selectedEpisode.episode);
      setSnackbarData({ showId: traktIdNum, season: selectedEpisode.season, episode: selectedEpisode.episode });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setLocalLoadingOption(null);
    }
  }, [isGuest, traktIdNum, unwatchEpisode, t]);

  const handleRewatchEpisode = useCallback(async (selectedEpisode: {season: number, episode: number} | null) => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    if (!selectedEpisode) return;
    setLocalLoadingOption('rewatch');
    try {
      await rewatchEpisode(traktIdNum, selectedEpisode.season, selectedEpisode.episode);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setLocalLoadingOption(null);
    }
  }, [isGuest, traktIdNum, rewatchEpisode, t]);

  const handleUndoUnwatch = useCallback(async () => {
    if (!snackbarData) return;
    try {
      await rewatchEpisode(snackbarData.showId, snackbarData.season, snackbarData.episode);
      setSnackbarData(null);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [snackbarData, rewatchEpisode]);

  return {
    userRating,
    seasonLoading,
    localLoadingOption,
    snackbarData,
    setSnackbarData,
    handleRate,
    handleRemoveRating,
    handleMarkSeason,
    handleUnwatchEpisode,
    handleRewatchEpisode,
    handleUndoUnwatch,
  };
}

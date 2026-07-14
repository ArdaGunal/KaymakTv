import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Check } from 'lucide-react-native';
import { useLibrary } from '../context/LibraryContext';
import { useTranslation } from 'react-i18next';

interface EpisodeCheckButtonProps {
  traktId: number;
  season: number;
  episode: number;
  showName?: string;
  onShowFinished?: (showName: string, showId: number) => void;
  onSuccessStateChange?: (isSuccess: boolean) => void;
}

export default function EpisodeCheckButton({ 
  traktId, 
  season, 
  episode, 
  showName,
  onShowFinished,
  onSuccessStateChange, 
}: EpisodeCheckButtonProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [isFinishedLocal, setIsFinishedLocal] = useState(false);
  const { markEpisodeAsWatched, markEpisodesUpToAsWatched, showProgressMap } = useLibrary();
  const { t } = useTranslation(['media', 'common']);

  const performCheckIn = async (isBulk: boolean, episodesToMark: number[] = []) => {
    setIsLocalLoading(true);
    try {
      let newProgress;
      if (isBulk) {
        newProgress = await markEpisodesUpToAsWatched(traktId, season, episodesToMark);
      } else {
        newProgress = await markEpisodeAsWatched(traktId, season, episode);
      }
      
      setIsSuccess(true);
      if (onSuccessStateChange) {
        onSuccessStateChange(true);
      }
      
      setTimeout(() => {
        setIsSuccess(false);
        if (onSuccessStateChange) {
          onSuccessStateChange(false);
        }
        
        if (!newProgress.next_episode) {
          setIsFinishedLocal(true);
          if (onShowFinished && showName) {
            onShowFinished(showName, traktId);
          }
        }
      }, 1000);
      
    } catch (error) {
      Alert.alert(t('common:error'), t('episodeMarkError'));
      setIsSuccess(false);
      if (onSuccessStateChange) {
        onSuccessStateChange(false);
      }
    } finally {
      setIsLocalLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (isLocalLoading || isSuccess || isFinishedLocal) return;
    
    const progress = showProgressMap[traktId];
    let skippedEpisodes: number[] = [];
    
    if (progress && progress.seasons) {
      const currentSeasonProgress = progress.seasons.find((s: any) => s.number === season);
      if (currentSeasonProgress && currentSeasonProgress.episodes) {
        for (let i = 1; i < episode; i++) {
          const ep = currentSeasonProgress.episodes.find((e: any) => e.number === i);
          if (!ep || !ep.completed) {
            skippedEpisodes.push(i);
          }
        }
      } else {
        for (let i = 1; i < episode; i++) {
          skippedEpisodes.push(i);
        }
      }
    } else {
      for (let i = 1; i < episode; i++) {
        skippedEpisodes.push(i);
      }
    }

    if (skippedEpisodes.length > 0) {
      Alert.alert(
        t('skippedEpisodesTitle'),
        t('skippedEpisodesMsg'),
        [
          {
            text: t('common:markOnlyThis'),
            onPress: () => performCheckIn(false, []),
            style: 'cancel'
          },
          {
            text: t('common:markPreviousToo'),
            onPress: () => performCheckIn(true, [...skippedEpisodes, episode])
          }
        ]
      );
    } else {
      performCheckIn(false, []);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.checkButton, isSuccess && styles.checkButtonSuccess]} 
      onPress={handleCheckIn}
      disabled={isLocalLoading || isSuccess}
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
    >
      {isLocalLoading ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <Check size={20} color="#ffffff" strokeWidth={3} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  checkButton: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonSuccess: {
    backgroundColor: '#10b981',
  },
});

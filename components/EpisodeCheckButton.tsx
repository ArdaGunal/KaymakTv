import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Check } from 'lucide-react-native';
import { useLibraryActions } from '../context/LibraryContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

interface EpisodeCheckButtonProps {
  traktId: number;
  season: number;
  episode: number;
  showName?: string;
  onShowFinished?: (showName: string, showId: number) => void;
  // info: basılma ANINDAKİ bölüm bilgisi. Store güncellenince data sıradaki
  // bölüme kaydığı için, "hangi bölüm izlendi" mesajı bu snapshot'tan yazılır.
  onSuccessStateChange?: (isSuccess: boolean, info?: { season: number; episode: number }) => void;
}

// Başarı durumunun ekranda kalma süresi: kartın yumuşak geçişiyle birlikte
// kullanıcıyı bekletmeyecek ama mesajı okutacak bir tatlı nokta.
const SUCCESS_HOLD_MS = 1600;

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
  // Store aboneliği YOK: bu buton listedeki her kartta var; abone olsaydı her
  // store değişimi yüzlerce butonu yeniden çizerdi. Aksiyonlar abonesiz hook'tan,
  // progress ise yalnızca basılma ANINDA getState() ile okunur.
  const { markEpisodeAsWatched, markEpisodesUpToAsWatched } = useLibraryActions();
  const { isGuest } = useAuth();
  const { t } = useTranslation(['media', 'common']);

  const performCheckIn = async (isBulk: boolean, episodesToMark: number[] = []) => {
    // Basılma anındaki bölümü sabitle: await sırasında store güncellenip
    // props sıradaki bölüme kaysa bile başarı mesajı doğru bölümü gösterir.
    const watchedInfo = { season, episode };
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
        onSuccessStateChange(true, watchedInfo);
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
      }, SUCCESS_HOLD_MS);

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
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    
    if (isLocalLoading || isSuccess || isFinishedLocal) return;

    const progress = useLibraryStore.getState().showProgressMap[traktId];
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

import React, { useRef, useState } from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
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

// Checkmark'ın ekranda kalma süresi: göze çarpacak kadar, beklemeyi
// hissettirmeyecek kadar kısa. Ağ isteği bunu artık BLOKLAMAZ — arka planda
// paralel yürür, kart bir sonraki bölüme bu süre dolar dolmaz geçer.
const SUCCESS_HOLD_MS = 550;

export default function EpisodeCheckButton({
  traktId,
  season,
  episode,
  showName,
  onShowFinished,
  onSuccessStateChange,
}: EpisodeCheckButtonProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFinishedLocal, setIsFinishedLocal] = useState(false);
  const busyRef = useRef(false);
  const requestIdRef = useRef(0);
  // Store aboneliği YOK: bu buton listedeki her kartta var; abone olsaydı her
  // store değişimi yüzlerce butonu yeniden çizerdi. Aksiyonlar abonesiz hook'tan,
  // progress ise yalnızca basılma ANINDA getState() ile okunur.
  const { markEpisodeAsWatched, markEpisodesUpToAsWatched } = useLibraryActions();
  const { isGuest } = useAuth();
  const { t } = useTranslation(['media', 'common']);

  // ESKİ SORUN: checkmark ancak 2 SIRALI ağ isteği (tarihçeye ekleme +
  // ilerleme yenileme) tamamen bitince gösteriliyordu; üstüne 1.6 sn sabit
  // bekleme de eklenince marathon izlerken her bölümde saniyelerce bekleniyordu.
  // YENİ AKIŞ: ekran ANINDA (iyimser) tepki verir; gerçek Trakt senkronizasyonu
  // arka planda sürer. "Dizi bitti mi?" kontrolü sunucu verisini gerektirdiği
  // için arka planda gelir ve kartın bir sonraki bölüme geçişini beklemez.
  const performCheckIn = (isBulk: boolean, episodesToMark: number[] = []) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const myRequestId = ++requestIdRef.current;
    const watchedInfo = { season, episode };

    setIsSuccess(true);
    onSuccessStateChange?.(true, watchedInfo);

    const mutationPromise = isBulk
      ? markEpisodesUpToAsWatched(traktId, season, episodesToMark)
      : markEpisodeAsWatched(traktId, season, episode);

    mutationPromise
      .then((newProgress) => {
        if (!newProgress?.next_episode) {
          setIsFinishedLocal(true);
          if (onShowFinished && showName) {
            onShowFinished(showName, traktId);
          }
        }
      })
      .catch((error) => {
        console.error(error);
        Alert.alert(t('common:error'), t('episodeMarkError'));
        // Bu tepki hâlâ güncelse (üstüne yeni bir dokunuş binmediyse) iyimser
        // görünümü geri al. Aksi halde daha yeni bir işlemi bozmamak için dokunma.
        if (requestIdRef.current === myRequestId) {
          setIsSuccess(false);
          onSuccessStateChange?.(false);
          busyRef.current = false;
        }
      });

    setTimeout(() => {
      if (requestIdRef.current !== myRequestId) return;
      setIsSuccess(false);
      onSuccessStateChange?.(false);
      busyRef.current = false;
    }, SUCCESS_HOLD_MS);
  };

  const handleCheckIn = () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }

    if (busyRef.current || isSuccess || isFinishedLocal) return;

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
      disabled={isSuccess || isFinishedLocal}
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
    >
      <Check size={20} color="#ffffff" strokeWidth={3} />
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

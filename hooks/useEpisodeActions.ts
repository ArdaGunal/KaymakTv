import { useState, useCallback } from 'react';
import { Alert, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addRating, removeRating } from '../services/traktApi';
import { useLibrary } from '../context/LibraryContext';
import { useAuth } from '../context/AuthContext';

interface UseEpisodeActionsArgs {
  showTraktId: number;
  season: number;
  episode: number;
  epTraktId: number;
  /** Paylaş bağlantısı için ham slug (URL'deki `id` parametresi). */
  slug: string;
  showName: string;
}

/**
 * Bölüm detayının TÜM kullanıcı eylemleri: puanla / puanı sil / izledi
 * işaretle-geri al / paylaş.
 *
 * 🔴 NEDEN HOOK'A ÇIKTI: bu mantık `app/episode/[id].tsx`'in içinde inline
 * duruyordu. Masaüstü web için AYRI bir başlık düzeni geldiğinde iki seçenek
 * vardı: mantığı kopyalamak (AI_RULES §2.5 — YASAK) veya tek kaynağa çıkarmak.
 * Özellikle "atlanan bölümler" akışı (aşağıdaki `toggleWatched`) 70 satırlık,
 * kopyalanırsa kesinlikle ıraksayacak bir karar ağacı.
 *
 * Davranış BİREBİR korundu — yalnızca yeri değişti (AI_RULES §1: UI/Logic
 * ayrımı). Modal kapatma gibi EKRANA ait kararlar burada verilmiyor;
 * fonksiyonlar başarı/başarısızlık döndürür, ekran ona göre davranır.
 */
export function useEpisodeActions({
  showTraktId,
  season,
  episode,
  epTraktId,
  slug,
  showName,
}: UseEpisodeActionsArgs) {
  const { t } = useTranslation('media');
  const { isGuest } = useAuth();
  const {
    setLocalRating,
    removeLocalRating,
    showProgressMap,
    unwatchEpisode,
    markEpisodeAsWatched,
    markEpisodesUpToAsWatched,
  } = useLibrary();

  const [isCheckLoading, setIsCheckLoading] = useState(false);

  /** Bu bölüm yerel ilerlemeye göre izlenmiş mi. */
  const isWatchedLocal = !!showProgressMap[showTraktId]
    ?.seasons?.find((s: any) => s.number === season)
    ?.episodes?.find((e: any) => e.number === episode)?.completed;

  const rate = useCallback(async (val: number) => {
    // StarSlider zaten 1-10 dahili ölçekte değer döndürür (Trakt ile aynı) — tekrar ×2 yapılmamalı.
    try {
      setLocalRating(epTraktId, 'episode', val);
      await addRating(epTraktId, 'episode', val);
      return true;
    } catch (e) {
      removeLocalRating(epTraktId, 'episode');
      Alert.alert(t('common:error'), 'Bölüm puanı kaydedilirken hata oluştu.');
      console.error(e);
      return false;
    }
  }, [epTraktId, setLocalRating, removeLocalRating, t]);

  const clearRating = useCallback(async () => {
    try {
      removeLocalRating(epTraktId, 'episode');
      await removeRating(epTraktId, 'episode');
      return true;
    } catch (e) {
      Alert.alert(t('common:error'), 'Bölüm puanı silinirken hata oluştu.');
      console.error(e);
      return false;
    }
  }, [epTraktId, removeLocalRating, t]);

  const toggleWatched = useCallback(async () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }

    const sNum = season;
    const eNum = episode;

    setIsCheckLoading(true);
    try {
      if (isWatchedLocal) {
        await unwatchEpisode(showTraktId, sNum, eNum);
        return;
      }

      // Bu bölümden ÖNCE izlenmemiş bölümler var mı — varsa kullanıcıya
      // "öncekileri de işaretleyeyim mi" diye sorulur.
      const progress = showProgressMap[showTraktId];
      const skippedEpisodes: number[] = [];
      const currentSeasonProgress = progress?.seasons?.find((s: any) => s.number === sNum);
      for (let i = 1; i < eNum; i++) {
        const ep = currentSeasonProgress?.episodes?.find((e: any) => e.number === i);
        if (!ep || !ep.completed) skippedEpisodes.push(i);
      }

      const performCheckIn = async (isBulk: boolean, eps: number[]) => {
        try {
          if (isBulk) {
            await markEpisodesUpToAsWatched(showTraktId, sNum, eps);
          } else {
            await markEpisodeAsWatched(showTraktId, sNum, eNum);
          }
        } catch (e) {
          console.error(e);
          Alert.alert(t('common:error'), 'Bölüm işaretlenirken bir hata oluştu.');
        }
      };

      if (skippedEpisodes.length > 0) {
        Alert.alert(
          t('skippedEpisodesTitle', { defaultValue: 'Atlanan Bölümler Var' }),
          t('skippedEpisodesMsg', { defaultValue: 'Önceki izlemediğiniz bölümleri de izlendi olarak işaretlemek ister misiniz?' }),
          [
            {
              text: t('common:markOnlyThis', { defaultValue: 'Yalnızca Bu Bölüm' }),
              onPress: () => performCheckIn(false, []),
              style: 'cancel',
            },
            {
              text: t('common:markPreviousToo', { defaultValue: 'Öncekileri de İşaretle' }),
              onPress: () => performCheckIn(true, [...skippedEpisodes, eNum]),
            },
          ]
        );
      } else {
        await performCheckIn(false, []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckLoading(false);
    }
  }, [isGuest, season, episode, isWatchedLocal, showProgressMap, showTraktId, unwatchEpisode, markEpisodeAsWatched, markEpisodesUpToAsWatched, t]);

  const share = useCallback(async () => {
    try {
      const url = `https://kaymaktv.com/episode/${slug}`;
      await Share.share({
        message: `${showName} S${season} E${episode} ${t('shareEpisodeMsg', 'bölümüne göz at!')}\n${url}`,
      });
    } catch (error) {
      console.log(error);
    }
  }, [slug, showName, season, episode, t]);

  /** Misafirse uyarır ve `false` döner — puanlama yüzeyleri bunu kullanır. */
  const guardGuest = useCallback(() => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return false;
    }
    return true;
  }, [isGuest, t]);

  return { isWatchedLocal, isCheckLoading, rate, clearRating, toggleWatched, share, guardGuest };
}

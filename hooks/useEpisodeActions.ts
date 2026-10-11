import { useState, useCallback } from 'react';
import { Share } from 'react-native';
import { chooseAsync, notify } from '../utils/confirmDialog';
import { useTranslation } from 'react-i18next';
// 🔴 HAM `addRating`/`removeRating` ARTIK ÇAĞRILMIYOR (2026-09-09).
// Bölüm puanı da mutasyon katmanından geçiyor; yönlendirme kararı (Trakt mı
// bizim API mi) orada yaşıyor. Ham çağrı kalsaydı Kaymak kullanıcısı bölüm
// puanlayamazdı — cihazda görülen 401'in sebebi buydu.
import { useLibrary } from '../context/LibraryContext';
import { atlananPlan, planToplami, planTekBolumMu, SezonListesi } from '../utils/atlananBolumler';
import { sezonEvreniKur } from '../utils/sezonEvreni';
import { getShowSeasons } from '../services/traktApi';
import { logWarning } from '../utils/errorLog';
import { useAuth } from '../context/AuthContext';

interface UseEpisodeActionsArgs {
  showTraktId: number;
  season: number;
  episode: number;
  epTraktId: number;
  /** Paylaş bağlantısı için ham slug (URL'deki `id` parametresi). */
  slug: string;
  showName: string;
  /** Ekranda hazır tam sezon listesi (masaüstü web rayı). Yoksa basışta çekilir. */
  tumSezonlar?: SezonListesi[] | null;
}

/**
 * M463 · «Öncekileri de işaretle» evreni. Eskiden bu ekran planı YALNIZ
 * ilerleme kaydından kuruyordu: dizinin ilk işaretlemesinde kayıt yok → soru
 * hiç sorulmuyor, yalnız o bölüm işaretleniyordu; kayıt sunucu kataloğundan
 * eksik geldiyse önceki sezonlar plana girmiyordu (YAYIN_ONCESI_TEST K2,
 * Naagin S4E3 ile cihazda üretildi). Dizi sayfası doğruydu çünkü tam sezon
 * listesini veriyordu. Liste mobilde sayfa açılışında çekilmez (fazla istek
 * olmasın); yalnız Mark'a basınca, L7/Pi önbelleğinden. Düşerse eski
 * davranışa (ilerleme kaydı) dönülür — gerileme yok.
 */
async function sezonEvreniGetir(showTraktId: number, hazir?: SezonListesi[] | null) {
  if (hazir && hazir.length > 0) return hazir;
  try {
    const liste = sezonEvreniKur(await getShowSeasons(showTraktId)).tumSezonlar;
    return liste.length > 0 ? liste : null;
  } catch (e) {
    logWarning('useEpisodeActions.sezonEvreni', e);
    return null;
  }
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
  tumSezonlar,
}: UseEpisodeActionsArgs) {
  const { t } = useTranslation('media');
  const { isGuest } = useAuth();
  const {
    setLocalRating,
    removeLocalRating,
    rateEpisodeMedia,
    unrateEpisodeMedia,
    showProgressMap,
    unwatchEpisode,
    markEpisodeAsWatched,
    planiIsaretle,
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
      await rateEpisodeMedia(epTraktId, val);
      return true;
    } catch (e) {
      removeLocalRating(epTraktId, 'episode');
      notify(t('common:error'), t('common:episodeRatingSaveError', 'Bölüm puanı kaydedilirken hata oluştu.'));
      console.error(e);
      return false;
    }
  }, [epTraktId, rateEpisodeMedia, setLocalRating, removeLocalRating, t]);

  const clearRating = useCallback(async () => {
    try {
      removeLocalRating(epTraktId, 'episode');
      await unrateEpisodeMedia(epTraktId);
      return true;
    } catch (e) {
      notify(t('common:error'), t('common:episodeRatingRemoveError', 'Bölüm puanı silinirken hata oluştu.'));
      console.error(e);
      return false;
    }
  }, [epTraktId, unrateEpisodeMedia, removeLocalRating, t]);

  const toggleWatched = useCallback(async () => {
    if (isGuest) {
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
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
      // 🔴 M418/M421: hesap SEZON LİSTESİNDEN ve ÖNCEKİ SEZONLARI da kapsar
      // (bkz. utils/atlananBolumler.ts). M463: evren dizi sayfasıyla AYNI —
      // tam sezon listesi (bkz. `sezonEvreniGetir`).
      const evren = await sezonEvreniGetir(showTraktId, tumSezonlar);
      const plan = atlananPlan(showProgressMap[showTraktId], sNum, eNum, evren);

      // 🔴 M418 — DİYALOG DALINDA DA KİLİT. Eski yerel `Alert.alert` bloklamıyordu;
      // eski hâlde `toggleWatched` hemen `finally`'ye düşüp kilidi açıyordu,
      // gerçek yazma ise diyaloğun `onPress`'inde SONRA koşuyordu. Kullanıcı
      // o aralıkta ikinci kez basınca ikinci bir `watchedAt` üretiliyor ve
      // sunucuda İKİNCİ bir izleme satırı oluşuyordu (M318 sınıfı hayalet
      // yeniden izleme). `EpisodeCheckButton` bu korumayı M413'te aldı.
      const performCheckIn = async (planlanan: { sezon: number; bolumler: number[] }[] | null) => {
        setIsCheckLoading(true);
        try {
          if (planlanan) {
            await planiIsaretle(showTraktId, planlanan);
          } else {
            await markEpisodeAsWatched(showTraktId, sNum, eNum);
          }
        } catch (e) {
          console.error(e);
          notify(t('common:error'), t('common:episodeMarkFailed', 'Bölüm işaretlenirken bir hata oluştu.'));
        } finally {
          setIsCheckLoading(false);
        }
      };

      if (!planTekBolumMu(plan, sNum, eNum)) {
        const toplam = planToplami(plan);
        // GORSEL-01: `chooseAsync` BEKLENİR → kilit (isCheckLoading) seçim yapılana dek
        // tutulur. Dışarı dokunma / geri tuşu = hiçbir şey işaretleme.
        const secim = await chooseAsync(
          t('skippedEpisodesTitle', { defaultValue: 'Atlanan Bölümler Var' }),
          plan.length > 1
            ? t('skippedEpisodesMsgCokSezon', { count: toplam, seasons: plan.length })
            : t('skippedEpisodesMsgSayili', { count: toplam }),
          t('common:markPreviousToo', { defaultValue: 'Öncekileri de İşaretle' }),
          t('markOnlyThisEpisode', { defaultValue: 'Yalnızca Bu Bölüm' })
        );
        if (secim === 'primary') await performCheckIn(plan);
        else if (secim === 'secondary') await performCheckIn(null);
      } else {
        await performCheckIn(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckLoading(false);
    }
  }, [isGuest, season, episode, isWatchedLocal, showProgressMap, showTraktId, unwatchEpisode, markEpisodeAsWatched, planiIsaretle, t, tumSezonlar]);

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
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return false;
    }
    return true;
  }, [isGuest, t]);

  return { isWatchedLocal, isCheckLoading, rate, clearRating, toggleWatched, share, guardGuest };
}

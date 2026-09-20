import React, { useRef, useState } from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Check } from './icons';
import { useLibraryActions } from '../context/LibraryContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { sonucuBeklemeli } from '../utils/isaretlemeBekleme';
import { atlananPlan, planToplami, planTekBolumMu, SezonListesi, IsaretlemePlani } from '../utils/atlananBolumler';

interface EpisodeCheckButtonProps {
  traktId: number;
  season: number;
  episode: number;
  showName?: string;
  /** 🆕 M420 — sezonda VAR OLAN (ve yayınlanmış) bölüm numaraları. Verilirse
   *  "öncekileri de işaretle" sorusu ilerleme kaydının yüklenmesini BEKLEMEZ. */
  sezonBolumleri?: number[];
  /** 🆕 M421 — dizinin TÜM sezonlarının yayınlanmış bölüm numaraları.
   *  "Öncekileri de işaretle" artık ÖNCEKİ SEZONLARI da kapsıyor. */
  tumSezonlar?: SezonListesi[];
  /** 🆕 M421 — dizi nesnesi: ilk işaretlemede "izlenenler"e eklemek için. */
  showMedia?: any;
  /** 🆕 M422 — ham sezon verisi: ilerleme kaydı yokken iyimser iskelet
   *  (aksi hâlde çok bölümlü planda ekran sunucu turunu bekliyordu). */
  iskeletSezonlar?: any[];
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
  sezonBolumleri,
  tumSezonlar,
  iskeletSezonlar,
  showMedia,
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
  const { markEpisodeAsWatched, planiIsaretle } = useLibraryActions();
  const { isGuest } = useAuth();
  const { t } = useTranslation(['media', 'common']);

  // ESKİ SORUN: checkmark ancak 2 SIRALI ağ isteği (tarihçeye ekleme +
  // ilerleme yenileme) tamamen bitince gösteriliyordu; üstüne 1.6 sn sabit
  // bekleme de eklenince marathon izlerken her bölümde saniyelerce bekleniyordu.
  // YENİ AKIŞ: ekran ANINDA (iyimser) tepki verir; gerçek Trakt senkronizasyonu
  // arka planda sürer. "Dizi bitti mi?" kontrolü sunucu verisini gerektirdiği
  // için arka planda gelir ve kartın bir sonraki bölüme geçişini beklemez.
  const performCheckIn = (plan: IsaretlemePlani[] | null) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const myRequestId = ++requestIdRef.current;
    const watchedInfo = { season, episode };
    // 🔴 M413 — dizinin İLK işaretlemesinde iyimser güncelleme yapılamıyor
    // (mağazada ilerleme kaydı yok); kalıcı tik sunucu turunu bekliyor.
    // O durumda yeşil + kilit işlem SONUÇLANANA kadar tutulur: hem tik
    // "gitmez" hem de arada ikinci basış ikinci izleme kaydı üretemez.
    // Karar mutasyon mağazayı değiştirmeden ÖNCE okunmalı.
    const sonucuBekle = sonucuBeklemeli(useLibraryStore.getState().showProgressMap[traktId]);
    const serbestBirak = () => {
      if (requestIdRef.current !== myRequestId) return;
      setIsSuccess(false);
      onSuccessStateChange?.(false);
      busyRef.current = false;
    };

    setIsSuccess(true);
    onSuccessStateChange?.(true, watchedInfo);

    const mutationPromise = plan
      ? planiIsaretle(traktId, plan, showMedia, iskeletSezonlar)
      : markEpisodeAsWatched(traktId, season, episode, showMedia, iskeletSezonlar);

    mutationPromise
      .then((newProgress) => {
        // Bu noktada ilerleme mağazaya yazılmış ve kalıcı tik çizilmiş olur.
        if (sonucuBekle) serbestBirak();
        // 🔴 M418: `newProgress` NULL olabilir — `kaymakIlerlemeTazele`
        // sunucu düşerse/boş dönerse mağazadaki değeri döndürüyor ve dizinin
        // İLK işaretlemesinde o değer yok. Null'ı "sıradaki bölüm yok" diye
        // okumak, tek bölüm işaretleyen kullanıcıya KONFETİ + "diziyi puanla"
        // göstermek ve düğmeyi kalıcı kilitlemek demekti.
        if (newProgress && !newProgress.next_episode) {
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
        serbestBirak();
      });

    if (!sonucuBekle) setTimeout(serbestBirak, SUCCESS_HOLD_MS);
  };

  const handleCheckIn = () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }

    if (busyRef.current || isSuccess || isFinishedLocal) return;

    // 🔴 M418 — atlananlar SEZON LİSTESİNDEN hesaplanır, `1..N-1` döngüsüyle
    // DEĞİL. Eski hâl, numaraları kesintisiz sanıp olmayan bölümleri
    // işaretlemeye çalışıyordu (canlı hata: 21020 S5'te yalnız 19-21 var).
    // 🔴 M421 — plan ÖNCEKİ SEZONLARI da kapsar (ürün kararı: 2. sezona
    // geçen kullanıcı 1. sezonu bitirmiştir). Evren önce ekranın listesi,
    // yoksa ilerleme kaydı; hiçbiri yoksa yalnız bu bölüm.
    const progress = useLibraryStore.getState().showProgressMap[traktId];
    const evren: SezonListesi[] | null = tumSezonlar
      || (sezonBolumleri ? [{ sezon: season, bolumler: sezonBolumleri }] : null);
    const plan = atlananPlan(progress, season, episode, evren);

    if (planTekBolumMu(plan, season, episode)) {
      performCheckIn(null);
      return;
    }

    // 🔴 SAYI GÖSTERİLİYOR: geri alması zor bir toplu işlem tek dokunuşla
    // yapılıyor; kullanıcı kaç bölüm işaretleyeceğini ONAYDAN ÖNCE görmeli.
    const toplam = planToplami(plan);
    const sezonSayisi = plan.length;
    Alert.alert(
      t('skippedEpisodesTitle'),
      sezonSayisi > 1
        ? t('skippedEpisodesMsgCokSezon', { count: toplam, seasons: sezonSayisi })
        : t('skippedEpisodesMsgSayili', { count: toplam }),
      [
        {
          text: t('markOnlyThisEpisode', 'Yalnızca Bu Bölüm'),
          onPress: () => performCheckIn(null),
          style: 'cancel',
        },
        {
          text: t('common:markPreviousToo'),
          onPress: () => performCheckIn(plan),
        },
      ]
    );
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

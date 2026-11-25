import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLibrarySelector, useLibraryActions } from '../context/LibraryContext';
import { categorizeShows, ShowCategories } from '../store/tracking/trackingLogic';
import { useWatchedOutboxStore } from '../store/watchedOutboxStore';
import { useBitisAniStore, bitenKimlikler } from '../store/bitisAniStore';

export interface UseTrackingShowsResult {
  categories: ShowCategories;
  /** Hiç veri yokken ve kütüphane hâlâ yüklenirken true — asla takılmaz. */
  isLoading: boolean;
  /** Üç ana kategori de (upNext/paused/notStarted) boş mu? `caughtUp`
   * BİLİNÇLİ OLARAK bu hesaba dahil DEĞİL — bu pano bir "Yapılacaklar"
   * listesi, `caughtUp` (izlenecek yeni bir şeyi olmayan diziler) burada hiç
   * render edilmiyor (bkz. `trackingLogic.ts` kural 2), o yüzden onu
   * `isEmpty`'e katmak panoda tek bir kart yokken bile "boş değil" gibi
   * yanlış bir sinyal verirdi. */
  isEmpty: boolean;
  totalCount: number;
  /** Bir diziyi "Bırak" — Trakt'ta ilerlemesini gizler. Takip panosundaki
   * kartlar tanım gereği hiçbir zaman zaten gizli bir diziyi göstermez (bkz.
   * trackingLogic.ts), bu yüzden bu eylem her zaman "gizle" yönünde çalışır.
   * Trakt'a giden asenkron isteği BİLİNÇLİ OLARAK burada yutmaz/loglamaz —
   * çağıran taraf (`TrackingCardMenu`) bunu bekleyip reddedilirse kullanıcıya
   * görünür bir hata gösterir (bkz. Madde 99). */
  dropShow: (id: number) => Promise<void>;
}

// Kategorizasyon (`paused` eşiği, "yayınlandı mı" kontrolü) zamana bağlı ama
// `categorizeShows` SAF bir fonksiyon — kendi kendine tazelenmez. Store hiçbir
// şey değişmese bile (kullanıcı hiçbir işaretleme yapmasa, hiçbir senkron
// tetiklenmese) 45. günü aşan bir dizi kendiliğinden "Ara Verilenler"e
// geçmiyordu; yalnızca ALAKASIZ bir store güncellemesi bu hesaplamayı yeniden
// tetikleyene kadar eski kovasında takılı kalıyordu. ÇÖZÜM: bu hook kendi
// "now" state'ini tutar ve iki tetikleyiciyle tazeler:
//   1. Saatte bir (gün sınırlarını makul bir gecikmeyle yakalamak için yeterli;
//      dakika dakika kontrol gereksiz re-render üretirdi).
//   2. Uygulama arka plandan öne her geldiğinde (kullanıcı saatlerce/günlerce
//      uzak kalmış olabilir, ekrana döner dönmez kategoriler güncel olmalı).
const NOW_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 saat
const EMPTY_CATEGORIES: ShowCategories = { upNext: [], paused: [], notStarted: [], caughtUp: [], hidden: [] };
const EMPTY_PROGRESS_STATUSES: ReadonlyMap<number, 'upNext' | 'paused'> = new Map();

function useTrackingNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    appStateRef.current = AppState.currentState;
    const interval = setInterval(() => setNow(Date.now()), NOW_REFRESH_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = appStateRef.current.match(/inactive|background/);
      appStateRef.current = nextState;
      if (wasBackgrounded && nextState === 'active') {
        setNow(Date.now());
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled]);

  return now;
}

function useTrackingShowCategories(enabled: boolean) {
  const { t, i18n } = useTranslation('media');
  const now = useTrackingNow(enabled);
  const pendingShowIds = useWatchedOutboxStore((s) => s.pendingShowIds);
  // BITIS-01: az önce biten diziler kart yerinde «bitti» görünümüyle kalsın.
  const bitisKayitlari = useBitisAniStore((s) => s.kayitlar);
  const bitenIds = useMemo(() => bitenKimlikler(bitisKayitlari, 'show'), [bitisKayitlari]);

  const { watchedShows, watchlistShows, showProgressMap, hiddenShowIds, isLibraryLoading } = useLibrarySelector((s) => ({
    watchedShows: s.watchedShows,
    watchlistShows: s.watchlistShows,
    showProgressMap: s.showProgressMap,
    hiddenShowIds: s.hiddenShowIds,
    isLibraryLoading: s.isLoading,
  }));

  const categories = useMemo(
    () => enabled ?
      categorizeShows({
        watchedShows: watchedShows || [],
        watchlistShows: watchlistShows || [],
        showProgressMap: showProgressMap || {},
        hiddenShowIds,
        pendingShowIds,
        bitenIds,
        now,
        labels: {
          dil: i18n.language,
          unnamedShow: t('unnamedShow', 'İsimsiz Dizi'),
          notStarted: t('notStarted', 'Henüz Başlanmadı'),
          caughtUp: t('caughtUp', 'Yeni bölüm bekleniyor'),
        },
      }) : EMPTY_CATEGORIES,
    // showProgressMap referansı store setter'larında yenilendiği için güvenli.
    [enabled, watchedShows, watchlistShows, showProgressMap, hiddenShowIds, pendingShowIds, bitenIds, now, t, i18n.language]
  );

  return { categories, isLibraryLoading };
}

/** Kategori başlığı olmayan poster listeleri için Trakt kimliğine göre durum. */
export function useShowProgressStatuses(enabled = true): ReadonlyMap<number, 'upNext' | 'paused'> {
  const { categories } = useTrackingShowCategories(enabled);
  return useMemo(() => {
    if (categories.upNext.length === 0 && categories.paused.length === 0) return EMPTY_PROGRESS_STATUSES;
    const statuses = new Map<number, 'upNext' | 'paused'>();
    for (const { id } of categories.upNext) statuses.set(id, 'upNext');
    for (const { id } of categories.paused) statuses.set(id, 'paused');
    return statuses;
  }, [categories]);
}

export function useTrackingShows(): UseTrackingShowsResult {
  const { categories, isLibraryLoading } = useTrackingShowCategories(true);
  const { toggleHiddenFromProgress } = useLibraryActions();
  const totalCount = categories.upNext.length + categories.paused.length + categories.notStarted.length;
  const isEmpty = totalCount === 0;
  const isLoading = isEmpty && isLibraryLoading;

  const dropShow = useCallback(
    (id: number) => toggleHiddenFromProgress(id, 'show', false),
    [toggleHiddenFromProgress]
  );

  return { categories, isLoading, isEmpty, totalCount, dropShow };
}

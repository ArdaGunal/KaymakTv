/**
 * useFeed — Akış (Feed) ekranının veri hook'u.
 *
 * ESKİ DAVRANIŞ: akış verisi bu hook'un İÇİNDE `useState` ile tutuluyordu —
 * yani yalnızca bu bileşen ağacından değiştirilebiliyordu. Gerçek zamanlı bir
 * sosyal akışta veri UI DIŞINDAN da değişir (kullanıcı bir bölüm işaretler →
 * mutasyon katmanı; başkası bir şey izler → Realtime WebSocket). Bu yüzden
 * ham aktiviteler artık paylaşılan `feedStore`'da; bu hook onları okuyup
 * sunucu senkronunu, SAYFALAMAYI ve maraton gruplamasını yönetir.
 *
 * Akış, takip edilenlerin YANI SIRA kullanıcının KENDİ aktivitelerini de
 * gösterir (bkz. services/feedApi.ts getVisibleUserIds).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { fetchFeedActivities, deleteActivitiesBulk, invalidateUserFeedActivitiesCache } from '../services/feedApi';
import { useFeedStore } from '../store/feedStore';
import { akisiDiskeYaz, akisiDisktenOku } from '../store/feedDiskCache';
import { getMySupabaseUserId } from '../services/userBlocks';
import { agIsaret } from '../../../utils/agIzleyici';
import { useFeedRealtime } from './useFeedRealtime';
import { groupMarathonActivities } from '../utils/groupMarathonActivities';
import { marathonSayfaSinirinda } from '../utils/marathonSinir';
import { FeedFilter } from '../utils/feedFilter';
import { resolveRawActivityIds } from '../utils/resolveRawActivityIds';
import { FeedItem } from '../types';

export interface UseFeedResult {
  data: FeedItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasError: boolean;
  /** Sonsuz kaydırma: alt sayfa yükleniyor mu (footer spinner). */
  isLoadingMore: boolean;
  /** Y21: sonraki SAYFA yüklenemedi mi.  (ilk yükleme) ile AYRI —
   *  liste doluyken tam ekran hata gösterilemez, ama sessiz de kalınamaz. */
  loadMoreFailed: boolean;
  /** Sunucuda daha eski kayıt var mı ("hepsi bu kadar" mesajı için). */
  hasMore: boolean;
  /** Kullanıcı listeyi görmemişken gelen yeni aktivite sayısı ("N yeni gönderi"). */
  unseenCount: number;
  markSeen: () => void;
  refresh: () => Promise<void>;
  /** Listenin sonuna yaklaşıldığında çağrılır. */
  loadMore: () => void;
  /** Açık kullanıcı eylemi — `loadMoreFailed` kapısını bypass eder (Y21). */
  retryLoadMore: () => void;
  /** Bir aktiviteyi (yalnızca kendi kartın — CardMenu bunu isOwnActivity'e
   *  göre zaten filtreler) kalıcı olarak siler. Worker `/feed/delete` hard
   *  delete + tombstone yapıyor (bkz. deleteActivitiesBulk) — burada yeni bir
   *  silme mekanizması İCAT EDİLMİYOR, yalnızca `useUserActivity.ts`'in
   *  Profil tarafında zaten yaptığını Akış'ın canlı `feedStore`'una bağlıyor. */
  deleteActivity: (item: FeedItem) => Promise<void>;
  /** C6 · seçili filtre ve değiştirici (YouTube tarzı çipler). */
  filtre: FeedFilter;
  setFiltre: (f: FeedFilter) => Promise<void>;
  /** Filtre değişti, yeni filtrenin 1. sayfası yükleniyor (liste boş). */
  isFiltering: boolean;
}

/** M470 · Bu süreden kısa arka plan geçişlerinde yakalama isteği atılmaz. */
const YAKALAMA_ESIGI_MS = 15_000;
/** C5 / A-7 · Sınırdaki maraton için art arda en fazla kaç sayfa kendiliğinden yüklenir. */
const MARATON_OTO_SAYFA = 3;
/** B-2 · Art arda değişiklikler (beğeni, Realtime patlaması) tek yazmaya insin. */
const DISK_YAZMA_GECIKMESI_MS = 1_500;

export function useFeed(): UseFeedResult {
  const { accessToken, isGuest } = useAuth();
  const { t } = useTranslation(['media', 'common']);
  const canLoad = !!accessToken && !isGuest;

  const activities = useFeedStore((s) => s.activities);
  const isHydrated = useFeedStore((s) => s.isHydrated);
  const unseenCount = useFeedStore((s) => s.unseenCount);
  const hasMore = useFeedStore((s) => s.hasMore);
  const isLoadingMore = useFeedStore((s) => s.isLoadingMore);
  const markSeen = useFeedStore((s) => s.clearUnseen);
  const filtre = useFeedStore((s) => s.filtre);
  const [isFiltering, setIsFiltering] = useState(false);

  const [isLoading, setIsLoading] = useState(!isHydrated);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  // Uçuştaki sayfa isteği. ŞART: `onEndReached` hızlı kaydırmada arka arkaya
  // birden çok kez tetiklenir; korumasız bırakılırsa AYNI imleçle birden fazla
  // istek gider ve aynı sayfa iki kez eklenmeye çalışılırdı.
  const isFetchingRef = useRef(false);

  // Başkalarının aktiviteleri canlı düşsün diye.
  useFeedRealtime(canLoad);

  const loadFirstPage = useCallback(
    async (force: boolean) => {
      if (!canLoad) {
        useFeedStore.getState().setFirstPage({ items: [], nextCursor: null, hasMore: false });
        setIsLoading(false);
        return;
      }
      isFetchingRef.current = true;
      // C6 · istek kendi filtresini taşır; yanıt geldiğinde filtre değiştiyse
      // (kullanıcı çipe bastı) eski sonuç yeni listeye YAZILMAZ.
      const istenen = useFeedStore.getState().filtre;
      try {
        const page = await fetchFeedActivities(null, force, istenen);
        if (useFeedStore.getState().filtre !== istenen) return;
        useFeedStore.getState().setFirstPage(page);
        agIsaret(`Akış ağdan ${page.items.length} satır`);
        setHasError(false);
        // Taze 1. sayfa bayrağı TEMİZLER — yoksa bir kez başarısız olan akış,
        // pull-to-refresh'ten sonra bile "Devamı yüklenemedi." takılı kalır ve
        // `loadMore` kapısı sonsuza dek kapalı kalırdı (useExplore'daki
        // `fetchTrending(reset=true)` ile aynı rol).
        setLoadMoreFailed(false);
      } catch (error) {
        console.warn('[Feed] Akış yüklenemedi:', error);
        setHasError(true);
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
      }
    },
    [canLoad]
  );

  useEffect(() => {
    // Store'da zaten veri varsa (sekmeye geri dönüş) skeleton GÖSTERME —
    // eldeki veriyi göster, tazelemeyi arkada yap.
    if (!useFeedStore.getState().isHydrated) {
      setIsLoading(true);
      // B-2 · Soğuk açılış: ağ (~1,2 sn) beklenirken son kopyayı ANINDA göster.
      // Ağ ile YARIŞIR: sunucu yanıtı önce gelirse `hydrateFromDisk` no-op.
      if (canLoad) {
        let iptal = false;
        getMySupabaseUserId()
          .then((sahip) => (sahip && !iptal ? akisiDisktenOku(sahip) : null))
          .then((satirlar) => {
            if (!iptal && satirlar && useFeedStore.getState().hydrateFromDisk(satirlar)) {
              setIsLoading(false);
              agIsaret(`Akış diskten ${satirlar.length} satır`);
            }
          })
          .catch((error) => console.warn('[Feed] Disk kopyası yüklenemedi:', error));
        loadFirstPage(false);
        return () => {
          iptal = true;
        };
      }
    }
    loadFirstPage(false);
  }, [canLoad, loadFirstPage]);

  // ── B-2 · Sunucu gerçeğini diske yaz (bir sonraki soğuk açılışın ilk karesi) ──
  // Store'a abone: beğeni, silme, engel/gizlilik temizliği, Realtime — hepsi
  // kopyaya yansır; böylece silinen kart bir sonraki açılışta bir an bile geri
  // gelmez. Yalnız `kaynak === 'ag'`: diskten okunan liste geri yazılmaz.
  useEffect(() => {
    if (!canLoad) return;
    let zamanlayici: ReturnType<typeof setTimeout> | null = null;
    const unsub = useFeedStore.subscribe((s, onceki) => {
      // Disk kopyası yalnız «Tümü» (soğuk açılış hep Tümü ile başlar).
      if (s.kaynak !== 'ag' || s.filtre !== 'tumu' || s.activities === onceki.activities) return;
      if (zamanlayici) clearTimeout(zamanlayici);
      zamanlayici = setTimeout(() => {
        zamanlayici = null;
        const anlik = useFeedStore.getState();
        if (anlik.kaynak !== 'ag' || anlik.filtre !== 'tumu') return; // arada çıkış/filtre değiştiyse yazma
        getMySupabaseUserId()
          .then((sahip) => (sahip ? akisiDiskeYaz(sahip, anlik.activities) : undefined))
          .catch((error) => console.warn('[Feed] Disk kopyası yazılamadı:', error));
      }, DISK_YAZMA_GECIKMESI_MS);
    });
    return () => {
      unsub();
      if (zamanlayici) clearTimeout(zamanlayici);
    };
  }, [canLoad]);

  // ── M470 · Arka plandan dönüşte KAÇANLARI YAKALA ──────────────────────
  // Android arka plandaki uygulamanın WebSocket'ini keser; o sırada gelen
  // INSERT/DELETE olayları kaybolur (Realtime geçmişi yeniden oynatmaz).
  // Eskiden akış ancak aşağı çekince ya da sekme yeniden açılınca düzeliyordu
  // (kullanıcı: «akış bazen geç yayınlanıyor»). Öne gelince taze 1. sayfa
  // listeyi BOZMADAN birleştirilir; yeniler «N yeni gönderi» rozetine düşer.
  // Kısa geçişlerde (bildirim perdesi, izin diyaloğu) istek atılmaz.
  useEffect(() => {
    if (!canLoad) return;
    let arkaPlanaGecis: number | null = null;
    const sub = AppState.addEventListener('change', (durum) => {
      if (durum !== 'active') {
        if (arkaPlanaGecis === null) arkaPlanaGecis = Date.now();
        return;
      }
      const sure = arkaPlanaGecis === null ? 0 : Date.now() - arkaPlanaGecis;
      arkaPlanaGecis = null;
      if (sure < YAKALAMA_ESIGI_MS || !useFeedStore.getState().isHydrated) return;
      const istenen = useFeedStore.getState().filtre;
      fetchFeedActivities(null, true, istenen)
        .then((page) => {
          if (useFeedStore.getState().filtre === istenen) useFeedStore.getState().mergeFreshFirstPage(page);
        })
        .catch((error) => console.warn('[Feed] Öne gelişte yakalama başarısız:', error));
    });
    return () => sub.remove();
  }, [canLoad]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    // Pull-to-refresh her zaman 1. SAYFAYI baştan çeker (imleç sıfırlanır) —
    // kullanıcı "en yeniyi göster" demek istiyor, kaldığı yeri değil.
    await loadFirstPage(true);
    markSeen();
    setIsRefreshing(false);
  }, [loadFirstPage, markSeen]);

  // Gerçek sayfa çekme mantığı — KAPISIZ. `loadMore` (onEndReached, otomatik)
  // ve `retryLoadMore` (kullanıcı eylemi, bayrağı bypass eder) ikisi de bunu
  // çağırır; farkları yalnızca ÇAĞRILMADAN ÖNCEKİ kapıda.
  // (Desen `hooks/useExplore.ts`'ten — Madde 232'de aynı sınıf hata orada
  //  kapatıldı, bu onun akış tarafındaki ikizi.)
  const doLoadMore = useCallback(() => {
    const state = useFeedStore.getState();
    isFetchingRef.current = true;
    state.setLoadingMore(true);
    const istenen = state.filtre;
    fetchFeedActivities(state.nextCursor, false, istenen)
      .then((page) => {
        if (useFeedStore.getState().filtre !== istenen) return;
        useFeedStore.getState().appendPage(page);
        setHasError(false);
        setLoadMoreFailed(false);
      })
      .catch((error) => {
        console.warn('[Feed] Sonraki sayfa yüklenemedi:', error);
        // 🔴 Y21: eskiden buradaki yorum "tekrar kaydırınca yeniden denenir"
        // diyordu — AMA kullanıcı zaten en alttadır ve kaydıracak yer yoktur,
        // yani onEndReached bir daha TETİKLENMEZ. Spinner kaybolur, hiçbir şey
        // gelmez, hiçbir mesaj çıkmaz: akışın bittiğini mi bozulduğunu mu
        // anlamanın yolu yoktu. Footer artık görünür bir "Tekrar Dene" çiziyor.
        setLoadMoreFailed(true);
      })
      .finally(() => {
        isFetchingRef.current = false;
        useFeedStore.getState().setLoadingMore(false);
      });
  }, []);

  // ── C5 / A-7 · Sayfa sınırındaki maratonu TAMAMLA ─────────────────────
  // Liste bir maratonun ortasında bitiyorsa (bkz. marathonSinir.ts) sonraki sayfa
  // kullanıcı kaydırmadan yüklenir; kart sayısı yüklenen sayfaya göre zıplamaz.
  // Aynı sınır için en fazla MARATON_OTO_SAYFA; sınır temizlenince sayaç sıfırlanır.
  const otoSayfa = useRef(0);
  useEffect(() => {
    if (!canLoad || loadMoreFailed) return;
    const st = useFeedStore.getState();
    if (st.kaynak !== 'ag' || !st.hasMore || !st.nextCursor || isFetchingRef.current) return;
    if (!marathonSayfaSinirinda(activities)) {
      otoSayfa.current = 0;
      return;
    }
    if (otoSayfa.current >= MARATON_OTO_SAYFA) return;
    otoSayfa.current += 1;
    doLoadMore();
    // `isLoadingMore` ŞART: sayfa eklenince (activities değişir) istek hâlâ
    // «uçuşta» işaretli; bayrak `finally`de düşer — o an yeniden bakılmazsa
    // zincir ilk sayfada dururdu.
  }, [activities, hasMore, isLoadingMore, canLoad, loadMoreFailed, doLoadMore]);

  const loadMore = useCallback(() => {
    const state = useFeedStore.getState();
    // BEŞ koruma: oturum yok / uçuşta istek var / devamı yok / imleç yok /
    // 🔴 son deneme BAŞARISIZ.
    //
    // Beşincisi Y21'in asıl kapanışı ve Madde 232'nin dersi: `loadMoreFailed`
    // bayrağı VARDI ve footer'ı çiziyordu, ama bu kapıda YOKTU. FlatList
    // `onEndReached`'i yalnızca kullanıcı kaydırınca değil, içerik/layout her
    // yeniden hesaplandığında da tetikleyebiliyor (`_maybeCallOnEdgeReached`)
    // — yani başarısız bir sayfa, kullanıcı hiçbir şey yapmadan sonsuza dek
    // yeniden denenebiliyordu. Trakt/Supabase'e sessiz kota yakan bir döngü.
    if (!canLoad || isFetchingRef.current || !state.hasMore || !state.nextCursor || loadMoreFailed) return;
    doLoadMore();
  }, [canLoad, loadMoreFailed, doLoadMore]);

  /** Yalnızca kullanıcının açık "Tekrar Dene" dokunuşu için — `loadMoreFailed`
   * kapısını BYPASS eder (aksi hâlde bayrağı temizlemeden çağırmak aynı render
   * turunda hâlâ eski/stale değeri görüp hiçbir şey yapmazdı). Otomatik
   * yeniden deneme YOK: tek tetikleyici kullanıcının kendi dokunuşu. */
  const retryLoadMore = useCallback(() => {
    const state = useFeedStore.getState();
    if (!canLoad || isFetchingRef.current || !state.hasMore || !state.nextCursor) return;
    doLoadMore();
  }, [canLoad, doLoadMore]);

  // Maraton gruplaması BİLİNÇLİ OLARAK burada, store'da değil: gruplama tüm
  // ham veri toplandıktan SONRA, render öncesi tek seferde yapılmalı (bkz.
  // utils/groupMarathonActivities.ts başlığı). Yeni bir sayfa eklendiğinde
  // yeniden hesaplanır — böylece sayfa sınırına denk gelen bir maraton
  // (aynı dizinin bölümleri iki sayfaya bölünmüş) TEK kartta birleşir.
  const data = useMemo(() => groupMarathonActivities(activities), [activities]);

  const deleteActivity = useCallback(
    async (item: FeedItem) => {
      // Misafirin Trakt token'ı yok — pratikte CardMenu zaten yalnızca kendi
      // aktivitene "Sil" gösteriyor (misafirin kendi aktivitesi olamaz), ama
      // useUserActivity.ts'teki AYNI savunma burada da duruyor.
      if (!accessToken || isGuest) {
        Alert.alert(
          t('activityDeleteGuestTitle', 'Giriş Gerekli'),
          t('activityDeleteGuestText', 'Bu işlem için Trakt hesabınızla giriş yapmış olmanız gerekir.')
        );
        return;
      }

      const rawIds = resolveRawActivityIds(item);
      // Geri alma (rollback) için ham FeedActivity nesnelerini sakla —
      // `removeActivity` yalnızca id alır, geri eklemek TAM nesne gerektirir.
      const removed = useFeedStore.getState().activities.filter((a) => rawIds.includes(a.id));
      removed.forEach((a) => useFeedStore.getState().removeActivity(a.id));

      try {
        // v2: TEK silme yolu. Eskiden burada tipe göre bir yönlendirme vardı
        // (`deleteFeedItemsRouted`) çünkü incelemenin Trakt'tan da silinmesi
        // gerekiyordu. Trakt'a yazmayı bıraktığımız için o ayrım kalktı —
        // inceleme dahil her aktivite aynı uçtan siliniyor.
        await deleteActivitiesBulk(accessToken, rawIds);
        // Profil › Aktiviteler ayrı bir fetch+önbellek kullanıyor (bkz.
        // useUserActivity.ts) — Akış'tan silinince o da güncel kalsın diye
        // AYNI çapraz-senkron deseni (docs/HISTORY.md Madde 159'daki
        // retractLocalActivity ile birebir aynı gerekçe).
        invalidateUserFeedActivitiesCache();
      } catch (error) {
        console.warn('[Feed] Aktivite silinemedi:', error);
        // Sunucu başarısız oldu — iyimser kaldırmayı geri al.
        removed.forEach((a) => useFeedStore.getState().upsertActivity(a, false));
        Alert.alert(
          t('common:error'),
          t('activityDeleteError', 'Aktivite(ler) silinirken bir sorun oluştu. Lütfen tekrar deneyin.')
        );
      }
    },
    [accessToken, isGuest, t]
  );

  // ── C6 · Filtre değiştir ──────────────────────────────────────────────
  // Liste boşaltılır, yeni filtrenin 1. sayfası sunucudan çekilir (force: ilk
  // sayfa önbelleği yalnız «Tümü»nü tutar). «Takip Ettiklerim» için kendi
  // kimliğim gerekir (kendi kartlarım Realtime'dan da girmesin).
  const setFiltre = useCallback(
    async (f: FeedFilter) => {
      if (f === useFeedStore.getState().filtre) return;
      const benimId = await getMySupabaseUserId().catch(() => null);
      useFeedStore.getState().setFiltre(f, benimId);
      setLoadMoreFailed(false);
      setHasError(false);
      setIsFiltering(true);
      try {
        await loadFirstPage(true);
      } finally {
        if (useFeedStore.getState().filtre === f) setIsFiltering(false);
      }
    },
    [loadFirstPage]
  );

  return {
    data,
    isLoading,
    isRefreshing,
    hasError,
    loadMoreFailed,
    isLoadingMore,
    hasMore,
    unseenCount,
    markSeen,
    refresh,
    loadMore,
    retryLoadMore,
    deleteActivity,
    filtre,
    setFiltre,
    isFiltering,
  };
}

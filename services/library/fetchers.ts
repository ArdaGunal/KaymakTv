import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibraryStore } from '../../store/useLibraryStore';
import { kaymakKullanicisiMi, syncLibrary, fetchTakvim } from '../api/library';
import { sezonsuzlariTamamla } from './emniyetAgi';
import { kaymakKutuphaneSenkronu } from './kaymakSync';
import {
  getWatchedShows,
  getWatchedMovies,
  getCustomLists,
  getWatchlistShows,
  getShowProgress,
  getWatchlistMovies,
  getUserRatings,
  getShowSeasons,
  getLikedShows,
  getLikedMovies,
  getHiddenShows,
  getHiddenMovies,
  getUpNextProgress,
} from '../traktApi';
import {
  CACHE_KEYS,
  safeStorageSet,
  setWatchedShows,
  setWatchedMovies,
  setCustomLists,
  setFavShows,
  setFavMovies,
  setWatchlistShows,
  setCalendarShows,
  setWatchlistMovies,
  setCalendarMovies,
  setUserRatingsShows,
  setUserRatingsMovies,
  setUserRatingsEpisodes,
  setShowProgressMap,
  setCalendarSeasonsMap,
  setUserStats,
  setHiddenShowIds,
  setHiddenMovieIds,
  setIsLoading,
  setIsMoviesLoading,
  setHasSyncError,
  readChunkedRecord,
  writeChunkedRecord,
} from './utils';
import { reconcileHiddenIds } from './hiddenSyncGuard';
import { CACHE_TTL } from '../../utils/cacheTTL';
import { logError } from '../../utils/errorLog';
import { requestQueue } from '../api/requestQueue';
import { setMemoryGauge } from '../../utils/metrics';

let lastFetchTimeRef = { current: 0 };

// Üst üste binen senkronlara karşı kilit: kullanıcı bir bölümü işaretleyip
// mutation sonrası `fetchFreshData(null, true)` tetiklerken, aynı anda başka
// bir tetikleyici (örn. uygulama arka plandan öne gelmesi) de kendi senkronunu
// başlatırsa, iki ağır delta-sync döngüsü aynı anda Trakt'a istek yağdırırdı.
// ESKİ DAVRANIŞ: hiçbir kilit yoktu. Kilidin `finally` yerine `backgroundWork`
// bittiğinde açılması bilinçlidir — asıl ağır iş (ilerleme/takvim sezonları
// chunk döngüsü) fonksiyon erken dönüş yaptıktan SONRA arka planda sürüyor.
let isFetchingFreshData = false;
let fetchLockTimeoutId: ReturnType<typeof setTimeout> | null = null;
const FETCH_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // senkron donarsa kilit sonsuza dek açık kalmasın

const releaseFetchLock = () => {
  isFetchingFreshData = false;
  if (fetchLockTimeoutId) {
    clearTimeout(fetchLockTimeoutId);
    fetchLockTimeoutId = null;
  }
};

/**
 * Hesap değiştirildiğinde (`AuthContext.removeKeys`) çağrılır.
 *
 * 🔴 `lastFetchTimeRef` MODÜL SEVİYESİNDE — JS süreci canlı kaldığı sürece
 * (uygulama tamamen kapatılmadan çıkış → başka hesapla giriş yapılırsa)
 * ÖNCEKİ hesabın son GERÇEK senkron zaman damgasını taşımaya devam eder.
 * Sıfırlanmazsa: yeni hesabın İLK `fetchFreshData` çağrısı, TTL'i hâlâ
 * geçerli sanıp (önceki hesap az önce gerçekten senkronlamış olduğu için)
 * senkronu TAMAMEN ATLAR — `useLibraryStore.clearAll()` ile önbellek boşalsa
 * bile yeni hesap için hiç doldurulmaz. Kilit de aynı gerekçeyle tazelenir
 * (önceki hesabın yarım kalmış bir senkronu varsa yenisini bloklamasın).
 */
export const resetFetchState = () => {
  lastFetchTimeRef.current = 0;
  releaseFetchLock();
};

// Android'de tek bir aşırı büyük satır (SQLite CursorWindow limiti) TÜM multiGet
// batch'ini patlatabilir. Bu durumda anahtarları tek tek okuyarak yalnızca bozuk
// dilimin kaybolmasını sağlarız — cihazlar arası "bende çalışıyor, onda çalışmıyor"
// farklarının tipik bir kaynağı budur.
const safeMultiGet = async (keys: string[]): Promise<Record<string, string | null>> => {
  try {
    const results = await AsyncStorage.multiGet(keys);
    return Object.fromEntries(results);
  } catch (batchErr) {
    console.log('multiGet başarısız, anahtarlar tek tek okunuyor:', batchErr);
    const map: Record<string, string | null> = {};
    for (const key of keys) {
      try {
        map[key] = await AsyncStorage.getItem(key);
      } catch {
        map[key] = null;
      }
    }
    return map;
  }
};

export const loadCache = async () => {
  try {
    const keys = Object.values(CACHE_KEYS);
    const cacheMap = await safeMultiGet(keys);

    // Her dilim BAĞIMSIZ parse edilir: biri bozuksa yalnızca o dilim atlanır.
    // ESKİ DAVRANIŞ: progress boş/bozuksa TÜM önbellek (takvim sezon haritası
    // dahil) yok sayılıyordu → o cihaz her açılışta sıfırdan tam senkrona
    // giriyor, kartlar dakikalarca "hesaplanıyor" spinner'ında kalıyordu.
    const getParsed = (key: string) => {
      try {
        const data = cacheMap[key];
        return data && data !== 'null' ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    };

    // showProgressMap artık chunk'lanmış (100'lük parçalar) halde saklanıyor —
    // düz getParsed ile değil, parçaları birleştiren readChunkedRecord ile okunur.
    const parsedProgress = await readChunkedRecord(CACHE_KEYS.showProgressMap);

    setWatchedShows(getParsed(CACHE_KEYS.watchedShows) || []);
    setWatchedMovies(getParsed(CACHE_KEYS.watchedMovies) || []);
    setCustomLists(getParsed(CACHE_KEYS.customLists) || []);
    setFavShows(getParsed(CACHE_KEYS.favShows) || []);
    setFavMovies(getParsed(CACHE_KEYS.favMovies) || []);
    setWatchlistShows(getParsed(CACHE_KEYS.watchlistShows) || []);
    setCalendarShows(getParsed(CACHE_KEYS.calendarShows) || []);
    setWatchlistMovies(getParsed(CACHE_KEYS.watchlistMovies) || []);
    setCalendarMovies(getParsed(CACHE_KEYS.calendarMovies) || []);
    setUserRatingsShows(getParsed(CACHE_KEYS.userRatingsShows) || []);
    setUserRatingsMovies(getParsed(CACHE_KEYS.userRatingsMovies) || []);
    setUserRatingsEpisodes(getParsed(CACHE_KEYS.userRatingsEpisodes) || []);
    setShowProgressMap(parsedProgress);
    setCalendarSeasonsMap(getParsed(CACHE_KEYS.calendarSeasonsMap) || {});
    setUserStats(getParsed(CACHE_KEYS.userStats) || null);
    setHiddenShowIds(getParsed(CACHE_KEYS.hiddenShowIds) || []);
    setHiddenMovieIds(getParsed(CACHE_KEYS.hiddenMovieIds) || []);

    // Progress haritası boşsa TTL'yi sıfırla: fetchFreshData kesin çalışsın.
    // Aksi halde 10 dakikalık TTL yüzünden kartlar spinner'da asılı kalırdı.
    const hasProgress = Object.keys(parsedProgress).length > 0;
    lastFetchTimeRef.current = hasProgress ? (getParsed(CACHE_KEYS.lastFetchTime) || 0) : 0;
  } catch (error) {
    console.log('Cache okuma hatası:', error);
  } finally {
    // Hata yolunda bile UI kilidi açılmalı (eskiden catch'te unutulmuştu).
    setIsLoading(false);
  }
};

/**
 * "İzlemeyi Bırak" (gizlenen dizi/film) listelerinin BAĞIMSIZ hızlı yolu.
 *
 * NEDEN AYRI BİR FONKSİYON: Bu iki liste eskiden `fetchFreshData`'nın TIER3
 * turunda, 9 isteklik tek bir `Promise.all`'un içinde ve `LOW` öncelikte
 * çekiliyordu. Bu üç ayrı gecikme/atlama kaynağı yaratıyordu:
 *   1. `setHiddenShowIds` ancak o turdaki EN YAVAŞ istek (sayfalanan
 *      `getWatchedMovies`, 3 ayrı `getUserRatings`, iki `getLiked*` — ki
 *      bunlar ek bir "liked list" round-trip'i daha yapıyor) bitince
 *      çağrılıyordu. Kullanıcı Cihaz B'ye o an bakıyorsa bayat veri görüyordu.
 *   2. `LOW` öncelik, `backgroundWork`'ün onlarca/yüzlerce `getShowProgress`
 *      isteğiyle AYNI kuyruk seviyesinde yarışıyordu — büyük kütüphanelerde
 *      gizli listeler dakikalarca sıra bekleyebiliyordu.
 *   3. `fetchFreshData` TTL (10 dk) veya eşzamanlılık kilidi yüzünden erken
 *      dönerse TIER3'e HİÇ ulaşılmıyordu — yani gizli listeler o çağrıda hiç
 *      yenilenmiyordu.
 * Üçü birlikte "bazen senkron oluyor bazen olmuyor" tablosunu üretiyordu.
 *
 * Bu fonksiyon iki hafif isteği `NORMAL` öncelikte, kendi başına çalıştırır ve
 * `fetchFreshData`'nın TTL/kilit kontrollerinden ÖNCE çağrılır — böylece
 * "Bırak" durumu, tam senkron atlansa bile her tetiklemede tazelenir.
 * `reconcileHiddenIds` yine uygulanır: o an uçuşta olan yerel bir mutasyon
 * eski bir sunucu anlık görüntüsüyle geri alınamaz (bkz. hiddenSyncGuard.ts).
 */
export const syncHiddenLists = async (accessToken: string | null) => {
  if (!accessToken) return;

  // NOT: Hatalar `logError` ile KALICI günlüğe de yazılır. Eskiden bu iki
  // istek yalnızca `console.error` ile yutuluyordu — cihazda geliştirici
  // konsolu olmadığından, senkron sessizce başarısız olduğunda kullanıcının
  // "Hata Günlüğü" ekranında HİÇBİR iz kalmıyordu.
  const [hiddenData, hiddenMoviesData] = await Promise.all([
    requestQueue.enqueue(() => getHiddenShows(), 'NORMAL').catch((e) => {
      console.error('getHiddenShows failed', e?.message);
      logError('fetchers.syncHiddenLists.shows', e);
      return null;
    }),
    requestQueue.enqueue(() => getHiddenMovies(), 'NORMAL').catch((e) => {
      console.error('getHiddenMovies failed', e?.message);
      logError('fetchers.syncHiddenLists.movies', e);
      return null;
    }),
  ]);

  const pairs: [string, string][] = [];

  if (hiddenData !== null) {
    const ids = reconcileHiddenIds(
      'show',
      (hiddenData as any[]).map((item: any) => item.show?.ids?.trakt).filter((id: any): id is number => typeof id === 'number')
    );
    setHiddenShowIds(ids);
    pairs.push([CACHE_KEYS.hiddenShowIds, JSON.stringify(ids)]);
  }

  if (hiddenMoviesData !== null) {
    const ids = reconcileHiddenIds(
      'movie',
      (hiddenMoviesData as any[]).map((item: any) => item.movie?.ids?.trakt).filter((id: any): id is number => typeof id === 'number')
    );
    setHiddenMovieIds(ids);
    pairs.push([CACHE_KEYS.hiddenMovieIds, JSON.stringify(ids)]);
  }

  if (pairs.length > 0) {
    AsyncStorage.multiSet(pairs).catch((err) => console.log('Hidden cache save error:', err));
  }
};


export const fetchFreshData = async (accessToken: string | null, force = false) => {
  if (!accessToken) {
    setIsLoading(false);
    setIsMoviesLoading(false);
    return;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 🎯 ADAPTÖR — Faz T · T1 okuma (kullanıcı kararı, 2026-09-07)
  // ══════════════════════════════════════════════════════════════════════
  // Bu dosya `BACKLOG` §B'de DAR KAPSAMLI: kilit YALNIZCA bu yönlendirme
  // için açık, genel refactor YAPILMIYOR. Senkronun kendisi bilinçli olarak
  // ayrı bir dosyada (`kaymakSync.ts`) — buraya 250 satır eklemek o kararı
  // ihlal ederdi.
  //
  // 🔴 AŞAĞIDAKİ HİÇBİR ŞEY ÇALIŞTIRILMIYOR. Google-only kullanıcının Trakt
  // token'ı yok; `syncHiddenLists` dahil her çağrı 401 alır. Yalnızca yazma
  // yolunu yönlendirip okumayı akışına bırakmak, T1'i sessizce çalışmaz
  // hâlde bırakırdı (`progress.ts`'teki aynı ders).
  // ══════════════════════════════════════════════════════════════════════
  // 🎯 T6.3 — ARTIK HERKES BİZDEN OKUYOR (2026-09-14)
  // ══════════════════════════════════════════════════════════════════════
  // Bu dal eskiden YALNIZCA Google-only kullanıcınındı. Trakt'lı kullanıcı
  // aşağıdaki üç katmanlı Trakt turundan geçiyordu (~13 istek).
  //
  // T6.1 ilerlemeyi, T6.2 takvim ve istatistiği bize çevirdi; geriye
  // `kaymakSync`in ZATEN doldurduğu alanlar kaldı — izlenenler, izleme
  // listesi, puanlar, favoriler, gizliler. O yol Google-only kullanıcıda
  // aylardır çalışıyor; Trakt'lı kullanıcıyı dışarıda tutan tek şey
  // takvim/istatistik boşluğuydu ve o boşluk kapandı.
  //
  // 🔴 ESKİ YOL SİLİNMEDİ — AŞAĞIDA EMNİYET AĞI OLARAK DURUYOR. Bizim
  // senkron düşerse (`ok === false`) ve kullanıcının Trakt token'ı varsa
  // akış aşağı devam eder ve eski tur çalışır. Google-only kullanıcıda
  // düşülecek bir yol yok, orada `return` ediyoruz.
  const kaymakKullanici = await kaymakKullanicisiMi();
  const traktVar = !kaymakKullanici && !!accessToken;
  {
    const now0 = Date.now();
    if (!force && (now0 - lastFetchTimeRef.current < CACHE_TTL.SYNC_INTERVAL)) {
      setIsLoading(false);
      setIsMoviesLoading(false);
      return;
    }

    // Kütüphane ve takvim PARALEL: ikisi de bizim uçlarımız, birbirini
    // beklemelerinin sebebi yok.
    const [ok, takvim] = await Promise.all([
      kaymakKutuphaneSenkronu(),
      fetchTakvim(33),
    ]);

    // 🔴 `null` = alamadım → önbellektekini KORU. Boşla ezmek takvimi
    // ekrandan silerdi (bkz. `fetchTakvim` başlığı).
    if (takvim) {
      setCalendarShows(takvim.diziler);
      setCalendarMovies(takvim.filmler);
      safeStorageSet(CACHE_KEYS.calendarShows, JSON.stringify(takvim.diziler));
      safeStorageSet(CACHE_KEYS.calendarMovies, JSON.stringify(takvim.filmler));
    }

    // 📌 ÖZEL LİSTELER HÂLÂ TRAKT'TA — `BACKLOG` §D18. K5 gereği hiç
    // aktarılmadılar, bizde verileri YOK. Kullanıcı kararı (2026-09-14):
    // ertelendi, iptal edilmedi; ayrı faz. Faz T sonunda arayüzde kalan
    // TEK Trakt okuması bu.
    if (traktVar) {
      requestQueue.enqueue(() => getCustomLists(), 'LOW')
        .then((listeler) => {
          if (listeler) {
            setCustomLists(listeler);
            safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(listeler));
          }
        })
        .catch((e) => logError('fetchers.customLists', e));
    }

    // 🛡️ Aynada sezon kırılımı olmayan diziler için onarım turu (tavanlı,
    // LOW öncelikli, yalnızca Trakt token'ı olanda). Bugünkü ölçümde 0 dizi
    // tetikliyor ama ayna geride kalırsa devreye girer.
    void sezonsuzlariTamamla(traktVar).catch((e) => logError('fetchers.emniyetAgi', e));

    if (ok) {
      // ⚠️ TTL yalnızca BAŞARIDA damgalanır — hata damgalansaydı kullanıcı
      // bir sonraki denemeye kadar (10 dk) eski veriyle kilitlenirdi.
      lastFetchTimeRef.current = Date.now();
      safeStorageSet(CACHE_KEYS.lastFetchTime, JSON.stringify(lastFetchTimeRef.current));
      return;
    }

    // Buraya düşmek: BİZİM senkron başarısız oldu.
    if (kaymakKullanici) {
      setIsLoading(false);
      setIsMoviesLoading(false);
      return;
    }
    console.warn('[T6.3] Kaymak senkronu düştü, Trakt emniyet turuna geçiliyor.');
  }

  // ══════════════════════════════════════════════════════════════════════
  // 🛡️ BURADAN AŞAĞISI ARTIK EMNİYET TURU (T6.3, 2026-09-14)
  // ══════════════════════════════════════════════════════════════════════
  // Üç katmanlı Trakt turu NORMAL AKIŞTA ÇALIŞMIYOR. Buraya yalnızca
  // yukarıdaki Kaymak senkronu DÜŞTÜYSE ve kullanıcının Trakt token'ı
  // VARSA düşülüyor. Silinmedi çünkü gerçek bir emniyet ağı: bizim uçlar
  // ya da Supabase geçici olarak erişilemezse kullanıcı boş ekran değil,
  // eski (yavaş ama çalışan) yolu görür.
  //
  // ⚠️ Aşağıdaki yorumlarda geçen "her açılışta / her dönüşte" ifadeleri
  // ARTIK GEÇERLİ DEĞİL — o cümleler bu blok ana yolken yazılmıştı.

  // "Bırak" listeleri TTL ve eşzamanlılık kilidinden ÖNCE, ateşle-ve-unut
  // olarak tazelenir: iki hafif istek karşılığında cihazlar arası "Bırak"
  // durumu güncellenir. (Ana yolda bu veri `kaymakSync` üzerinden
  // `user_hidden`dan geliyor; burada yalnızca emniyet turu için.)
  syncHiddenLists(accessToken).catch((e) => logError('fetchers.syncHiddenLists', e));

  const now = Date.now();
  if (!force && (now - lastFetchTimeRef.current < CACHE_TTL.SYNC_INTERVAL)) {
    console.log('TTL geçerli, arka plan fetch işlemi atlanıyor...');
    setIsLoading(false);
    setIsMoviesLoading(false);
    return;
  }

  if (isFetchingFreshData) {
    console.log('fetchFreshData zaten çalışıyor, üst üste binen çağrı atlanıyor...');
    return;
  }
  isFetchingFreshData = true;
  fetchLockTimeoutId = setTimeout(releaseFetchLock, FETCH_LOCK_TIMEOUT_MS);

  setIsMoviesLoading(true);
  try {
    // ÖNCELİKLİ (KRİTİK) İSTEKLER - Ana ekran (Diziler) için gerekenler
    // requestQueue üzerinden CRITICAL öncelikle kuyruğa alınır — tarayıcının
    // 6 connection limitini aşmamak için zaten 3 istekle sınırlıydı, artık
    // aynı sınır (varsayılan eşzamanlılık: 3) merkezi kuyruk tarafından da
    // garanti ediliyor ve düşük öncelikli arka plan istekleriyle yarışmıyor.
    const pShowsData = requestQueue.enqueue(() => getWatchedShows(), 'CRITICAL').catch((e) => { console.error('getWatchedShows failed', e.message); return null; });
    const pWlistShows = requestQueue.enqueue(() => getWatchlistShows(), 'CRITICAL').catch((e) => { console.error('getWatchlistShows failed', e.message); return null; });
    // 📅 T6.2b — TAKVİM ARTIK BİZDEN. Tek istek HEM diziyi HEM filmi
    // getiriyor; tier 2'deki ikinci Trakt takvim çağrısı bu yüzden kalktı.
    // `requestQueue`ya girmiyor: o kuyruk Trakt'ın oran sınırını korumak
    // için var, bu istek Trakt'a gitmiyor.
    const pTakvim = fetchTakvim(33);

    // ARKA PLAN (İKİNCİL) İSTEKLER - Aşağıda ayrı ele alınacak

    const [showsData, wlistShows, takvim] = await Promise.all([pShowsData, pWlistShows, pTakvim]);

    // 🔴 `null` = ALAMADIM (önbellek korunur) · boş dizi = gerçekten yok.
    // Ayrım `fetchTakvim`de kuruluyor; burada sadece açılıyor.
    const calShows = takvim ? takvim.diziler : null;
    const calMovies = takvim ? takvim.filmler : null;

    // Üçü de null ise (her biri kendi .catch'iyle null'a düştüyse) kritik
    // Tier-1 isteklerinin TAMAMI başarısız demektir — ağ/sunucu sorunu. Kısmi
    // başarı (en az biri döndüyse) hata bayrağını temizler: elimizdeki veri
    // güvenilir sayılır, eski (stale ama geçerli) önbellek de aynı şekilde
    // güvenilir kabul edilir (bkz. aşağıdaki `if (x !== null) setX(x)` —
    // başarısız olan dilimler önbellekteki son bilinen değerini KORUR, asla
    // boşla ezilmez).
    setHasSyncError(showsData === null && wlistShows === null && calShows === null);

    const deltaCache = await safeMultiGet([
      CACHE_KEYS.watchedShows,
      CACHE_KEYS.calendarSeasonsMap
    ]);

    let oldWatchedShowsMap = new Map();
    let oldSeasonsMap: Record<string, any> = {};

    if (deltaCache[CACHE_KEYS.watchedShows]) {
      try {
        const arr = JSON.parse(deltaCache[CACHE_KEYS.watchedShows] as string);
        arr.forEach((item: any) => {
          if (item.show?.ids?.trakt) {
            oldWatchedShowsMap.set(item.show.ids.trakt, item.last_watched_at);
          }
        });
      } catch (e) {}
    }

    // Chunk'lanmış format: artık safeMultiGet'in düz anahtar listesinde değil,
    // ayrı bir okuma ile (parçaları birleştirerek) alınıyor. Object yerine
    // gerçek bir Map'e çevrilir: binlerce dizili büyük kütüphanelerde düz
    // obje üzerinde `obj[id]` erişimi V8'de "dictionary mode"a düşüp
    // yavaşlayabilir; Map her koşulda garantili O(1) hash erişimi sağlar —
    // aşağıdaki iki forEach döngüsünde (satır ~178, ~186) tekrar tekrar
    // sorgulanan bu haritanın performansı doğrudan delta-sync'in hızını belirler.
    const rawOldProgressMap = await readChunkedRecord(CACHE_KEYS.showProgressMap);
    const oldProgressMap = new Map<number, any>(
      Object.entries(rawOldProgressMap).map(([showId, progress]) => [Number(showId), progress])
    );

    if (deltaCache[CACHE_KEYS.calendarSeasonsMap]) {
      try { oldSeasonsMap = JSON.parse(deltaCache[CACHE_KEYS.calendarSeasonsMap] as string); } catch (e) {}
    }

    const showIds = new Set<number>();
    let fetchCount = 0;

    // ESKİ DAVRANIŞ: bir dizinin ilerlemesi (getShowProgress) SADECE kullanıcı
    // o dizide yeni bir şey izlediğinde (last_watched_at değiştiğinde) yeniden
    // çekiliyordu. Sorun: Trakt'ta yeni bir sezon/bölüm duyurulması kullanıcının
    // eyleminden TAMAMEN bağımsız bir olaydır — kullanıcı hiçbir şey izlemese
    // bile olabilir. Bir diziyi bitirip (next_episode: null, tamamlandı) aylarca
    // dokunmayan kullanıcı için, dizi yeniden onaylansa/yeni sezon duyurulsa
    // bile uygulama bunu ASLA öğrenmiyordu — dizi ya "tamamlandı" sayılıp tüm
    // takip listelerinden kayboluyordu ya da (ancak bir tam senkron/cache
    // temizleme sonrası) yanlış kategoriye düşüyordu.
    // ÇÖZÜM: dizi hâlâ yayında ise (status 'ended'/'canceled' DEĞİLSE) VE yerel
    // önbellek onu "tamamlandı" (next_episode yok) olarak biliyorsa, bu tam
    // olarak "belki yenilendi, kontrol etmemiz lazım" sinyalidir — yeniden
    // çekme setine eklenir. Zaten bir next_episode'u OLAN diziler bu ek
    // kontrole ihtiyaç duymaz: onların ilerlemesi zaten kullanıcı o dizide bir
    // sonraki bölümü izlediğinde mutation'lar tarafından (services/library/
    // mutations/progress.ts) doğrudan güncelleniyor. Bu, aşağıdaki calShowIds'te
    // (takvim sezonları için) zaten kullanılan "hâlâ yayında mı" kontrolüyle
    // AYNI mantık — API maliyetini yalnızca gerçekten riskli diziler için artırır,
    // her senkronda TÜM aktif dizileri yeniden çekmez.
    showsData?.forEach((item: any) => {
      const traktId = item.show.ids.trakt;
      const oldWatchedAt = oldWatchedShowsMap.get(traktId);
      const status = item.show?.status;
      const stillAiring = status !== 'ended' && status !== 'canceled';
      const cachedProgress = oldProgressMap.get(traktId);
      const looksComplete = !!cachedProgress && !cachedProgress.next_episode;

      if (oldWatchedAt !== item.last_watched_at || !oldProgressMap.has(traktId) || (stillAiring && looksComplete)) {
        showIds.add(traktId);
        fetchCount++;
      }
    });

    wlistShows?.forEach((item: any) => {
      const traktId = item.show.ids.trakt;
      if (!oldProgressMap.has(traktId)) {
        showIds.add(traktId);
      }
    });

    console.log(`Delta Sync: Toplam ${(showsData?.length || 0) + (wlistShows?.length || 0)} diziden sadece ${showIds.size} tanesinin ilerlemesi yeniden çekilecek.`);

    if (showsData !== null) setWatchedShows(showsData);
    if (wlistShows !== null) setWatchlistShows(wlistShows);
    if (calShows !== null) setCalendarShows(calShows);

    // UI KİLİDİNİ AÇ! Ana sayfa için gerekenler geldi.
    setIsLoading(false);

    // TIER 2: FİLMLER SEKME İHTİYAÇLARI (Acil)
    //
    // ⛔ `getUserStats()` KALDIRILDI (T6.2, 2026-09-14). Trakt'ın
    // `/users/me/stats`ı profil istatistiğini besliyordu; artık o hesap
    // BİZDE yapılıyor (`utils/yerelIstatistik.ts` → `gosterilecekIstatistik`,
    // T6.2'de öncelik yerele çevrildi). Girdileri (`watchedShows`,
    // `watchedMovies`, `showProgressMap`) T6.1'den beri zaten bizden geliyor
    // ve eksiksiz; Trakt'a sormaya devam etmek kendi verimiz dururken dış
    // servise sormak olurdu.
    //
    // 🔑 Önbellekteki `userStats` SİLİNMİYOR: `gosterilecekIstatistik` onu
    // yerel hesap BOŞKEN yedek olarak kullanıyor (ilk senkron bitmeden profil
    // açılırsa "0 saat" göstermekten iyi). Yalnızca TAZELENMİYOR.
    // ⛔ `getMyCalendarMovies()` de KALKTI (T6.2b): film takvimi artık
    // tier 1'deki TEK `fetchTakvim` çağrısından geliyor. İki Trakt takvim
    // isteği → sıfır.
    Promise.all([
      requestQueue.enqueue(() => getWatchlistMovies(), 'NORMAL').catch((e) => { console.error('getWatchlistMovies failed', e.message); return null; }),
    ]).then(([wlistMovies]) => {
      if (wlistMovies !== null) setWatchlistMovies(wlistMovies);
      if (calMovies !== null) setCalendarMovies(calMovies);

      setIsMoviesLoading(false); // Filmler kalkanı kalktı!

      const multiSetDataMovies: [string, string][] = [];
      const prevWatchlistMovies = wlistMovies !== null ? wlistMovies : useLibraryStore.getState().watchlistMovies;
      const prevCalendarMovies = calMovies !== null ? calMovies : useLibraryStore.getState().calendarMovies;

      multiSetDataMovies.push([CACHE_KEYS.watchlistMovies, JSON.stringify(prevWatchlistMovies)]);
      multiSetDataMovies.push([CACHE_KEYS.calendarMovies, JSON.stringify(prevCalendarMovies)]);
      AsyncStorage.multiSet(multiSetDataMovies).catch(err => console.log(err));
    });

    // TIER 3: ARKA PLAN İSTEKLERİ (Ağır Yük - Geçmiş, Puanlar vb.)
    // ESKİ DAVRANIŞ: bu 7 istek `Promise.all` ile HİÇBİR eşzamanlılık sınırı
    // olmadan aynı anda ateşleniyordu — tier1'in "sadece 3 istek" disiplinini
    // görmezden gelip Trakt'ı 429'a zorlayan asıl gizli darboğazlardan biri
    // buydu. Artık LOW öncelikle requestQueue'ya alınıp merkezi eşzamanlılık
    // sınırına (3) tabi oluyorlar; ayrıca TIER1/TIER2'nin CRITICAL/NORMAL
    // istekleriyle aynı kuyrukta yarıştıklarında öncelik her zaman onlarda kalır.
    setTimeout(() => {
      Promise.all([
        requestQueue.enqueue(() => getWatchedMovies(), 'LOW').catch((e) => { console.error('getWatchedMovies failed', e.message); return null; }),
        requestQueue.enqueue(() => getCustomLists(), 'LOW').catch((e) => { console.error('getCustomLists failed', e.message); return null; }),
        requestQueue.enqueue(() => getLikedShows(), 'LOW').catch((e) => { console.error('getLikedShows failed', e.message); return null; }),
        requestQueue.enqueue(() => getLikedMovies(), 'LOW').catch((e) => { console.error('getLikedMovies failed', e.message); return null; }),
        requestQueue.enqueue(() => getUserRatings('shows'), 'LOW').catch((e) => { console.error('getUserRatings shows failed', e.message); return null; }),
        requestQueue.enqueue(() => getUserRatings('movies'), 'LOW').catch((e) => { console.error('getUserRatings movies failed', e.message); return null; }),
        requestQueue.enqueue(() => getUserRatings('episodes'), 'LOW').catch((e) => { console.error('getUserRatings episodes failed', e.message); return null; })
        // NOT: `getHiddenShows`/`getHiddenMovies` BİLİNÇLİ OLARAK bu turdan
        // ÇIKARILDI — artık `syncHiddenLists` ile, bu ağır `Promise.all`'un
        // ve `LOW` önceliğin arkasında beklemeden, çok daha erken çekiliyorlar
        // (sebebi için o fonksiyonun başındaki nota bakınız).
      ]).then(([moviesData, listsData, fShowsData, fMoviesData, rShowsData, rMoviesData, rEpisodesData]) => {
        if (moviesData !== null) setWatchedMovies(moviesData);
        if (listsData !== null) setCustomLists(listsData);
        if (fShowsData !== null) setFavShows(fShowsData);
        if (fMoviesData !== null) setFavMovies(fMoviesData);
        if (rShowsData !== null) setUserRatingsShows(rShowsData);
        if (rMoviesData !== null) setUserRatingsMovies(rMoviesData);
        if (rEpisodesData !== null) setUserRatingsEpisodes(rEpisodesData);

        const multiSetDataInitial: [string, string][] = [];
        const setIfValidInitial = (key: string, data: any, prevData: any) => {
          const finalData = data !== null ? data : prevData;
          multiSetDataInitial.push([key, JSON.stringify(finalData)]);
        };

        setIfValidInitial(CACHE_KEYS.watchedShows, showsData, useLibraryStore.getState().watchedShows);
        setIfValidInitial(CACHE_KEYS.watchedMovies, moviesData, useLibraryStore.getState().watchedMovies);
        setIfValidInitial(CACHE_KEYS.customLists, listsData, useLibraryStore.getState().customLists);
        setIfValidInitial(CACHE_KEYS.favShows, fShowsData, useLibraryStore.getState().favShows);
        setIfValidInitial(CACHE_KEYS.favMovies, fMoviesData, useLibraryStore.getState().favMovies);
        setIfValidInitial(CACHE_KEYS.watchlistShows, wlistShows, useLibraryStore.getState().watchlistShows);
        setIfValidInitial(CACHE_KEYS.calendarShows, calShows, useLibraryStore.getState().calendarShows);
        setIfValidInitial(CACHE_KEYS.userRatingsShows, rShowsData, useLibraryStore.getState().userRatingsShows);
        setIfValidInitial(CACHE_KEYS.userRatingsMovies, rMoviesData, useLibraryStore.getState().userRatingsMovies);
        setIfValidInitial(CACHE_KEYS.userRatingsEpisodes, rEpisodesData, useLibraryStore.getState().userRatingsEpisodes);
        // hiddenShowIds/hiddenMovieIds burada YAZILMAZ — kendi kalıcılığını
        // `syncHiddenLists` yapıyor. Buradan da yazmak, o hızlı yolun az önce
        // kaydettiği TAZE listeyi, bu geç biten turun elindeki daha ESKİ
        // store anlık görüntüsüyle geri ezme riski taşırdı.

        AsyncStorage.multiSet(multiSetDataInitial).catch(err => console.log('Initial cache save error:', err));
      });
    }, 500);

    // `backgroundWork`in referansı tutuluyor: bu IIFE bitene kadar (ilerleme +
    // takvim sezonları chunk döngüleri) `isFetchingFreshData` kilidi açık kalır
    // — asıl "senkronlar birbirine stack oluyor" riskinin kaynağı bu uzun
    // döngülerdi, üstteki hızlı TIER1/2/3 değil.
    const backgroundWork = (async () => {
      const uniqueIds = Array.from(showIds);
      const CHUNK_SIZE = 6;

      // ── FAZ 0: TOPLU TOHUMLAMA (bulk seed) ─────────────────────────────
      // ESKİ DAVRANIŞ: ilerlemesi eksik/bayat HER dizi için tek tek
      // `/shows/:id/progress/watched` çekiliyordu. İlk girişte (önbellek boş)
      // bu, yüzlerce LOW öncelikli isteğe dönüşüp 2-3 DAKİKA sürüyordu; o
      // süre boyunca progress'i henüz gelmemiş her dizi "hesaplanıyor"
      // kartıyla Aktif İzlenenler'e düşüyor, verisi gelince gerçek kovasına
      // (Ara Verilenler / Güncel / ...) taşınıyordu — kullanıcının gördüğü
      // "diziler bir listeden diğerine akıyor" kargaşasının kök nedeni buydu.
      // ÇÖZÜM: eksik sayısı eşiği aşıyorsa önce Trakt'ın TOPLU özet uç
      // noktasından (`/sync/progress/up_next_nitro?intent=all`, ~100 dizi/istek)
      // tüm özetler tek seferde alınıp haritaya yazılır → kategoriler birkaç
      // saniyede doğru oturur. Sezon/bölüm kırılımı (`seasons`) özet yanıtında
      // OLMADIĞI için, bölüm bazlı ekranların ihtiyacı olan tam çekim aşağıdaki
      // döngüde arka planda DEVAM eder; ama artık kullanıcı bunu hissetmez.
      // Toplu istek başarısız olursa (ağ/CORS/uç nokta) eski yol aynen çalışır.
      const BULK_SEED_MIN_IDS = 10;
      let remainingIds = uniqueIds;
      if (uniqueIds.length >= BULK_SEED_MIN_IDS) {
        try {
          const seeded: Record<string, any> = {};
          const currentMap = useLibraryStore.getState().showProgressMap;

          // ══════════════════════════════════════════════════════════════
          // 🔄 T6.1 — TOHUMU BİZDEN AL (2026-09-13)
          // ══════════════════════════════════════════════════════════════
          // 🔬 §D14'ÜN KÖKÜ TAM OLARAK BURASI. Trakt'ın toplu ucu
          // (`getUpNextProgress`) dizi ÖZETİ veriyor ama SEZON KIRILIMI
          // VERMİYOR — bu yüzden aşağıdaki filtre "sezonu yok" diyen her
          // diziyi tam çekim kuyruğuna atıyor ve kuyruk dizi başına BİR
          // Trakt isteği açıyordu. Kullanıcının raporunda ölçülen desen:
          // 57 × `/shows/:id/progress/watched`, ortalama 282 ms,
          // toplam 16,1 sn.
          //
          // ✅ Bizim `/library/sync` ucumuz ilerlemeyi SEZONLARIYLA ve TEK
          // İSTEKTE veriyor. Tohum buradan gelince filtre hiçbir diziyi
          // kuyrukta bırakmıyor — 57 istek 1'e iniyor.
          //
          // 🔴 KAPI YOK — CEVABI VERİNİN KENDİSİ VERİR (M372).
          // İlk sürüm bunu `kaymak_trakt_import_onay_v1` bayrağına bağlamıştı.
          // Kırılgandı ve daha kötüsü GÖZLEMLENEMEZDİ: bayrağın cihazda ne
          // olduğu uzaktan okunamıyor, `console.log` kurulu APK'da
          // görünmüyor — yani "tohum çalıştı mı?" sorusunun CEVAPLANACAK bir
          // yolu yoktu. Üç tur boyunca ayırt edilemedi.
          //
          // ✅ Şimdi her zaman soruyoruz ve YANITA bakıyoruz: anlamlı sayıda
          // dizi geldiyse tohum bizden, gelmediyse Trakt'ın toplu özetine
          // düşülür. Kendi kendini doğruluyor (tablolar boşsa zaten geri
          // düşer) ve `wrangler tail`de GÖRÜNÜYOR. Maliyet aynı: atılmayan
          // `getUpNextProgress` de tek istekti.
          //
          // ⚠️ Takvim · özel listeler · istatistik HÂLÂ Trakt'tan — onların
          // Kaymak karşılığı yok (T6.2'nin işi). Bu yüzden burası okuma
          // yolunun TAMAMINI değil, YALNIZCA ilerleme tohumunu çeviriyor.
          const sezonluTohum = new Set<number>();
          let bizdenAlindi = false;
          {
            try {
              const yanit = await syncLibrary();
              for (const d of yanit?.diziler ?? []) {
                const id = d?.traktId;
                if (!id || !d?.ilerleme) continue;
                const sezonSayisi = (d.ilerleme as any)?.seasons?.length ?? 0;

                // 🔴 BOŞ İLERLEME MAĞAZAYI EZMESİN — `kaymakIlerlemeTazele`
                // ile AYNI guard. Aynada sezon/bölüm kırılımı olmayan
                // diziler var (ölçüldü: 541 dizinin 18i). Elimizde DOLU bir
                // kayıt varken boş bir kayıtla değiştirmek kullanıcının tüm
                // tiklerini ekrandan silerdi. Böyle dizide özet alanları
                // tazelenir, sezon kırılımı KORUNUR — ve dizi tam çekim
                // kuyruğunda KALIR (`sezonluTohum`a eklenmiyor).
                const existing = currentMap[id];
                if (sezonSayisi === 0 && existing?.seasons?.length) {
                  seeded[id] = { ...existing, ...(d.ilerleme as any), seasons: existing.seasons };
                  continue;
                }

                seeded[id] = d.ilerleme;
                if (sezonSayisi > 0) sezonluTohum.add(id);
              }
              // 🔑 ÖLÇÜT: SEZONLU tohumun KAPSAMI. "Kaç dizi döndü" yetmez,
              // "kaçında sezon kırılımı var" gerekir.
              //
              // 🔴 NEDEN YARISI: tohumumuz çoğunlukla sezonsuz gelirse Trakt'ın
              // toplu özetini atlamak, kalan her diziyi tam çekim kuyruğuna
              // yollardı — yani §D14'ün 57 isteğini AZALTMAK yerine
              // ÇOĞALTIRDIK. Kapsam yarıyı bulmuyorsa Trakt özetine düşmek
              // hem daha hızlı hem daha güvenli.
              bizdenAlindi = sezonluTohum.size >= Math.max(1, Math.floor(uniqueIds.length / 2));
              console.log(`[T6.1] Tohum BİZDEN: ${Object.keys(seeded).length} dizi, ${sezonluTohum.size}/${uniqueIds.length} sezonlu, kullanildi=${bizdenAlindi}`);
            } catch (e) {
              // Fail-soft: bizim uç düşerse Trakt yolu aynen çalışır.
              // Sessiz değil — M366/M370'in dersi.
              console.warn('[T6.1] Kaymak tohumu alınamadı, Trakt toplu özetine düşülüyor:', e);
            }
          }

          if (!bizdenAlindi) {
            const bulk = await requestQueue.enqueue(() => getUpNextProgress(), 'NORMAL');
            for (const item of bulk as any[]) {
              const id = item?.show?.ids?.trakt;
              if (!id || !item?.progress) continue;
              const existing = currentMap[id];
              // Mevcut TAM kaydın sezon kırılımı korunur, özet alanları
              // (aired/completed/next_episode/last_watched_at) tazelenir.
              seeded[id] = existing ? { ...existing, ...item.progress } : item.progress;
            }
          }
          if (Object.keys(seeded).length > 0) {
            setShowProgressMap((prev: any) => ({ ...prev, ...seeded }));
            // Kalıcılık: kullanıcı uygulamayı hemen kapatsa bile özetler
            // diskte — bir sonraki açılış spinner'sız başlar.
            writeChunkedRecord(
              CACHE_KEYS.showProgressMap,
              useLibraryStore.getState().showProgressMap,
              { silent: true }
            ).catch(() => {});
          }

          // Özet yeterli olan dizileri tam çekim kuyruğundan düş: yalnızca
          // sezon kırılımı hiç olmayanlar (ilk giriş / yeni dizi) veya son
          // izlemesi değişenler (kırılımı bayat) kuyrukta kalır. "Hâlâ
          // yayında + tamamlanmış görünüyor" tedbir çekimleri (looksComplete)
          // artık gereksiz — taze next_episode bilgisini toplu özet verdi.
          const newWatchedAtMap = new Map<number, string>();
          showsData?.forEach((item: any) => {
            const id = item?.show?.ids?.trakt;
            if (id) newWatchedAtMap.set(id, item.last_watched_at);
          });
          remainingIds = uniqueIds.filter((id) => {
            // 🔄 T6.1: bizden SEZONLU tohumlanan dizinin tam çekime
            // ihtiyacı YOK — kırılım zaten elimizde. §D14'ün 57 isteğini
            // sıfıra indiren satır bu.
            if (sezonluTohum.has(id as number)) return false;
            const cached = oldProgressMap.get(id as number);
            const hadSeasons = !!cached?.seasons;
            const watchedAtUnchanged = oldWatchedShowsMap.get(id) === newWatchedAtMap.get(id as number);
            return !(hadSeasons && watchedAtUnchanged);
          });
          // En yakın zamanda izlenen en önce: kullanıcının asıl etkileşime
          // gireceği dizilerin sezon kırılımı ilk saniyelerde hazır olsun.
          const watchedTime = (id: unknown) => {
            const at = newWatchedAtMap.get(id as number);
            const t = at ? new Date(at).getTime() : 0;
            return Number.isFinite(t) ? t : 0;
          };
          remainingIds = [...remainingIds].sort((a, b) => watchedTime(b) - watchedTime(a));
          console.log(`Bulk seed: ${Object.keys(seeded).length} dizi özeti tek turda yüklendi; ${remainingIds.length}/${uniqueIds.length} dizi tam (sezonlu) çekim kuyruğunda kaldı.`);
        } catch (e) {
          console.log('Up Next toplu özet alınamadı, tek tek çekime devam ediliyor:', e);
          logError('fetchers.upNextBulkSeed', e);
        }
      }
      // Diske her yayında değil, birkaç yayında bir yaz (büyük haritayı
      // sürekli serileştirmemek için).
      const PERSIST_EVERY_PUBLISHES = 4;
      // ESKİ DAVRANIŞ: her ağ chunk'ı (6 dizi) bittiği ANDA store'a yazılıyordu.
      // Büyük kütüphanelerde (ör. 300 dizi → 50 chunk) bu, art arda 50 kez
      // "store güncellendi → kategorizasyon baştan hesaplandı → SectionList
      // yeniden çizildi" dalgasına yol açıp senkron sırasında arayüzü
      // kilitliyordu. ÇÖZÜM: sonuçlar bir tampona (`pendingResults`) birikir,
      // store'a yalnızca ~400ms'de bir (ya da son chunk'ta) TEK seferde
      // yayınlanır. Ağ isteklerinin hızı/sırası DEĞİŞMEDİ — yalnızca kaç kez
      // render tetiklendiği azaldı.
      const PUBLISH_INTERVAL_MS = 400;
      let pendingResults: Record<string, any> = {};
      let lastPublishAt = Date.now();
      let publishCount = 0;

      const flushPending = () => {
        if (Object.keys(pendingResults).length === 0) return;
        setShowProgressMap((prev: any) => ({ ...prev, ...pendingResults }));
        pendingResults = {};
        lastPublishAt = Date.now();

        // KADEMELİ KALICILIK: senkron yarıda kesilirse (kullanıcı uygulamayı
        // kapatırsa) o ana kadarki ilerleme diskte kalır; sonraki açılış delta
        // sayesinde yalnızca eksikleri çeker. Eskiden hiçbir şey kaydedilmediği
        // için her açılış sıfırdan başlıyordu — "hiç bitmeyen senkron" döngüsü.
        publishCount++;
        if (publishCount % PERSIST_EVERY_PUBLISHES === 0) {
          // silent:true — bu arka plan checkpoint'i her birkaç yayında bir
          // tetiklenir; hata durumunda kullanıcıya art arda "Depolama Dolu"
          // uyarısı spam'lenmesin diye sessizce loglanır.
          writeChunkedRecord(
            CACHE_KEYS.showProgressMap,
            useLibraryStore.getState().showProgressMap,
            { silent: true }
          ).catch(() => {});
        }
      };

      for (let i = 0; i < remainingIds.length; i += CHUNK_SIZE) {
        const chunk = remainingIds.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (id) => {
          try {
            pendingResults[id as number] = await requestQueue.enqueue(() => getShowProgress(id as number), 'LOW');
          } catch(e) {
            console.log('Progress çekilemedi: ', id);
          }
        }));

        const isLastChunk = i + CHUNK_SIZE >= remainingIds.length;
        if (isLastChunk || Date.now() - lastPublishAt >= PUBLISH_INTERVAL_MS) {
          flushPending();
        }

        if (!isLastChunk) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
      // Güvence: döngü zaten son chunk'ta flush ediyor ama olası bir kalıntı
      // (örn. hatalı `isLastChunk` hesaplamasına karşı) için ek çağrı zararsız
      // (fonksiyon boş tamponda hiçbir şey yapmıyor).
      flushPending();

      // Son birleşim: eski harita + store'daki güncel hali (senkron sırasında
      // kullanıcının yaptığı işaretlemeler dahil). oldProgressMap artık bir Map
      // olduğu için object spread öncesi düz obje haline çevrilir.
      const mergedProgress = { ...Object.fromEntries(oldProgressMap), ...useLibraryStore.getState().showProgressMap };
      setShowProgressMap(mergedProgress);
      // Faz 7 — bellek/depolama ayak izi gözlemlenebilirliği: tam senkron
      // başına bir kez (chunk başına değil) kaydedilir, gereksiz gauge churn'ü
      // önlenir.
      setMemoryGauge('showProgressMap.entries', Object.keys(mergedProgress).length);

      const updatedTime = Date.now();
      lastFetchTimeRef.current = updatedTime;

      // showProgressMap artık 100'lük parçalara bölünerek ayrı anahtarlara
      // yazılıyor (Android SQLite CursorWindow limiti koruması) — lastFetchTime
      // küçük olduğu için ayrı, düz bir anahtar olarak kalıyor.
      writeChunkedRecord(CACHE_KEYS.showProgressMap, mergedProgress, { silent: true }).catch((err) => {
        console.error('AsyncStorage progress save error:', err);
      });
      AsyncStorage.setItem(CACHE_KEYS.lastFetchTime, JSON.stringify(updatedTime)).catch((err) => {
        console.error('AsyncStorage lastFetchTime save error:', err);
      });

      if (true) { // calShows koşulunu kaldırdık çünkü progressMap ve watchlist de kullanılacak
        try {
          const calShowIds = new Set<number>();
          if (calShows) {
            calShows.forEach((item: any) => {
              const id = item.show?.ids?.trakt;
              if (id) calShowIds.add(id);
            });
          }

          if (showsData) {
            showsData.forEach((item: any) => {
              const id = item.show?.ids?.trakt;
              const status = item.show?.status;
              if (id && status !== 'ended' && status !== 'canceled') {
                calShowIds.add(id);
              }
            });
          }

          if (wlistShows) {
            wlistShows.forEach((item: any) => {
              const id = item.show?.ids?.trakt;
              const status = item.show?.status;
              if (id && status !== 'ended' && status !== 'canceled') {
                calShowIds.add(id);
              }
            });
          }

          const calUniqueIds = Array.from(calShowIds);
          let updatedSeasonsMap = { ...oldSeasonsMap };
          let fetchedAny = false;

          const nowMillis = Date.now();

          // Progress döngüsündeki aynı toplulaştırma tekniği: store'a her ağ
          // chunk'ında değil, ~400ms'de bir (veya son chunk'ta) tek seferde
          // yayınlanır — aksi halde bu döngü de progress döngüsüyle aynı anda
          // koşarken kendi render dalgasını üstüne bindirirdi.
          const SEASONS_PUBLISH_INTERVAL_MS = 400;
          let pendingSeasonsEntries: Record<string, any> = {};
          let lastSeasonsPublishAt = Date.now();
          let seasonsPublishCount = 0;

          const flushPendingSeasons = () => {
            if (Object.keys(pendingSeasonsEntries).length === 0) return;
            setCalendarSeasonsMap((prev: any) => ({ ...prev, ...pendingSeasonsEntries }));
            pendingSeasonsEntries = {};
            lastSeasonsPublishAt = Date.now();

            // KADEMELİ KALICILIK: "Yaklaşanlar", 33 günlük takvimin ötesindeki
            // bölümleri BU haritadan görür. Eskiden harita yalnızca tüm döngü
            // bitince yazıldığından, senkronu hiç tamamlanamayan cihazlarda 33
            // günden ötesi asla görünmüyordu — "bende 100 gün sonrası var, onda
            // yok" farkının sebebi buydu.
            seasonsPublishCount++;
            if (seasonsPublishCount % 3 === 0) {
              AsyncStorage.setItem(
                CACHE_KEYS.calendarSeasonsMap,
                JSON.stringify(updatedSeasonsMap)
              ).catch(() => {});
            }
          };

          for (let i = 0; i < calUniqueIds.length; i += CHUNK_SIZE) {
            const chunk = calUniqueIds.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (id) => {
              const cachedData = updatedSeasonsMap[id];
              if (!cachedData || !cachedData.fetchedAt || (nowMillis - cachedData.fetchedAt > CACHE_TTL.CALENDAR_SEASONS)) {
                try {
                  const seasons = await requestQueue.enqueue(() => getShowSeasons(id), 'LOW');

                  // VERİ BUDAMA (Data Pruning): Sadece gelecekte olan bölümleri ve minimum veriyi tut.
                  // AsyncStorage (SQLite) boyut limitini (CursorWindow size limit) aşmamak için kritik.
                  const minimalSeasons = seasons.map((s: any) => ({
                    number: s.number,
                    episodes: s.episodes?.filter((ep: any) => {
                      if (!ep.first_aired) return false;
                      const airedTime = new Date(ep.first_aired).getTime();
                      return airedTime > nowMillis;
                    }).map((ep: any) => ({
                      season: ep.season,
                      number: ep.number,
                      title: ep.title,
                      first_aired: ep.first_aired
                    })) || []
                  })).filter((s: any) => s.episodes.length > 0);

                  const entry = {
                    fetchedAt: nowMillis,
                    data: minimalSeasons
                  };
                  updatedSeasonsMap[id] = entry;
                  pendingSeasonsEntries[id] = entry;
                  fetchedAny = true;
                } catch(e) {
                  console.log('Seasons çekilemedi: ', id);
                }
              }
            }));

            const isLastSeasonsChunk = i + CHUNK_SIZE >= calUniqueIds.length;
            if (isLastSeasonsChunk || Date.now() - lastSeasonsPublishAt >= SEASONS_PUBLISH_INTERVAL_MS) {
              flushPendingSeasons();
            }

            if (!isLastSeasonsChunk) {
              await new Promise(resolve => setTimeout(resolve, 150));
            }
          }
          flushPendingSeasons();

          setCalendarSeasonsMap((prev: any) => ({ ...prev, ...updatedSeasonsMap }));

          if (fetchedAny) {
            safeStorageSet(CACHE_KEYS.calendarSeasonsMap, JSON.stringify(updatedSeasonsMap));
          }
        } catch (e) {
          console.log('Calendar seasons background fetch error', e);
        }
      }

    })();

    backgroundWork.finally(releaseFetchLock);
  } catch (error) {
    console.log('Trakt veri çekme hatası:', error);
    logError('fetchFreshData', error);
    setIsLoading(false);
    setHasSyncError(true);
    releaseFetchLock();
  }
};

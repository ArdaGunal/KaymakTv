import { syncLibrary, type KutuphaneYaniti } from '../api/library';
import { logError } from '../../utils/errorLog';
import {
  CACHE_KEYS,
  safeStorageSet,
  setWatchedShows,
  setWatchedMovies,
  setShowProgressMap,
  persistShowProgressMap,
  setHasSyncError,
  setIsLoading,
  setIsMoviesLoading,
  setUserRatingsShows,
  setUserRatingsMovies,
  setUserRatingsEpisodes,
  setWatchlistShows,
  setWatchlistMovies,
  setFavShows,
  setFavMovies,
  setHiddenShowIds,
  setHiddenMovieIds,
} from './utils';
import { reconcileHiddenIds } from './hiddenSyncGuard';

/**
 * ==========================================================================
 * KAYMAK KÜTÜPHANE SENKRONU — `fetchFreshData`'nın Trakt'sız karşılığı
 * ==========================================================================
 * Faz T · T1 okuma. Google-only kullanıcının kütüphanesini BİZDEN çeker.
 *
 * 🔴 NEDEN AYRI DOSYA: `fetchers.ts` `BACKLOG` §B'de dar kapsamlı — kilidi
 * YALNIZCA yönlendirme mantığı için açıldı (kullanıcı kararı, 2026-09-07:
 * *"400 satır kuralı için genel bir refactor veya temizlik YAPILMAYACAK"*).
 * 250 satırlık bir senkronu oraya eklemek o kararı ihlal ederdi; orada
 * yalnızca birkaç satırlık dal duruyor.
 *
 * ==========================================================================
 * ⚠️ BU DOSYA TRAKT'IN ŞEKLİNİ ÜRETİYOR — bilinçli
 * ==========================================================================
 * `trackingLogic.ts` `item.show.ids.trakt` okuyor, `useLibraryFilters.ts`
 * `showProgressMap[traktId].aired` okuyor. Adaptörün kuralı gereği
 * (*"UI hiçbir şeyin değiştiğini bilmez"*) buradan çıkan veri Trakt'tan
 * gelmiş gibi görünmek ZORUNDA. Şekli "temizlemek" cazip ama o an onlarca
 * tüketici bozulur.
 *
 * 🔑 İLERLEME BURADA HESAPLANMIYOR — Worker hesaplıyor. Katalog "kaç bölüm
 * yayınlandı"yı biliyor, istemci bilmiyor. Buraya taşımak, tüm bölüm
 * listesini cihaza indirmek demekti.
 */

// 🗂️ `yapimNesnesi` ve `yanitiSekillendir` `kaymakSekil.ts`'e TAŞINDI
// (§C17.2): bu dosya `axios` zincirini içe aktardığı için düz Node test
// koşucusunda yüklenemiyor ve "saf" olduğu yazılan şekillendirici pratikte
// HİÇ test edilemiyordu. Yeniden dışa aktarılıyor — çağıranlar değişmedi.
export { yanitiSekillendir } from './kaymakSekil';
import { yanitiSekillendir } from './kaymakSekil';


/**
 * Kaymak kullanıcısının kütüphanesini çeker ve mağazaya yazar.
 *
 * 🔴 ASLA THROW ETMEZ — `fetchFreshData` da etmiyor ve çağıranları
 * (ekran odaklanması, çekmeli yenileme) hata yakalamıyor. Atılan bir hata
 * yakalanmamış promise reddi olurdu.
 *
 * @returns başarılı mı — çağıran TTL'i buna göre işaretler.
 */
export const kaymakKutuphaneSenkronu = async (): Promise<boolean> => {
  try {
    const yanit = await syncLibrary();
    if (!yanit.success) {
      // Sunucu "başarısız" dedi ama HTTP hata vermedi — yine de hata.
      setHasSyncError(true);
      return false;
    }

    const { watchedShows, showProgressMap, watchedMovies } = yanitiSekillendir(yanit);

    // ⚠️ TAMAMEN BOŞ YANIT ÖNBELLEĞİ EZMEZ. `fetchers.ts`'in
    // `if (x !== null) setX(x)` kuralıyla aynı gerekçe: geçici bir sunucu
    // arızası kullanıcının kütüphanesini SİLİNMİŞ göstermemeli.
    //
    // 🔴 "BOŞ" ÖLÇÜTÜ TÜM AİLELERİ KAPSAMALI. Önce yalnızca izlemelere
    // bakıyordu ve bu bir HATAYDI: hiç bölüm izlememiş ama izleme listesi
    // dolu bir kullanıcıda erken çıkılıyor, dört koleksiyon ailesi
    // mağazaya HİÇ yazılmıyordu. Yeni kullanıcının tipik hâli tam olarak bu.
    const bosYanit =
      watchedShows.length === 0 &&
      watchedMovies.length === 0 &&
      yanit.puanDiziler.length === 0 &&
      yanit.puanFilmler.length === 0 &&
      yanit.puanBolumler.length === 0 &&
      yanit.izlemeListesiDiziler.length === 0 &&
      yanit.izlemeListesiFilmler.length === 0 &&
      yanit.favoriDiziler.length === 0 &&
      yanit.favoriFilmler.length === 0 &&
      yanit.gizliDiziler.length === 0 &&
      yanit.gizliFilmler.length === 0;
    if (bosYanit) {
      setHasSyncError(false);
      return true;
    }

    // ⚠️ İzleme dilimleri yalnızca DOLU geldiğinde yazılıyor: koleksiyonu
    // dolu ama izlemesi boş bir kullanıcıda buraya ulaşılıyor ve boş dizi
    // yazmak, önbellekteki geçmişi silmek olurdu.
    if (watchedShows.length > 0) {
      setWatchedShows(watchedShows);
      safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(watchedShows));
    }
    if (watchedMovies.length > 0) {
      setWatchedMovies(watchedMovies);
      safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(watchedMovies));
    }

    // 🔴 İLERLEME HARİTASI BİRLEŞTİRİLMEZ, DEĞİŞTİRİLİR. Sunucu tek gerçek
    // kaynak; eski bir girdiyi korumak, kullanıcı başka cihazda bir diziyi
    // geçmişinden sildiğinde onu bu cihazda hayatta bırakırdı.
    if (Object.keys(showProgressMap).length > 0) {
      setShowProgressMap(showProgressMap);
      persistShowProgressMap(showProgressMap);
    }

    koleksiyonlariYaz(yanit);

    setHasSyncError(false);
    return true;
  } catch (error) {
    console.error('[KAYMAK SYNC] Kütüphane çekilemedi:', error);
    logError('library.kaymakKutuphaneSenkronu', error);
    // Önbellek KORUNUYOR — kullanıcı çevrimdışıyken son bilinen kütüphanesini
    // görmeye devam etsin.
    setHasSyncError(true);
    return false;
  } finally {
    setIsLoading(false);
    setIsMoviesLoading(false);
  }
};

/**
 * Dört koleksiyon ailesini mağazaya yazar: puanlar · izleme listesi ·
 * favoriler · gizlenenler.
 *
 * 🔴 GİZLENENLER SANILANDAN KRİTİK: `hiddenShowIds` yalnızca kütüphaneyi
 * değil, `mapCalendar.ts` üzerinden BİLDİRİMLERİ de süzüyor. Burada bir
 * kayıp, kullanıcının gizlediği dizi için bildirim almasına yol açar —
 * sinsi ve geç fark edilir.
 *
 * ⚠️ `state` (bırakıldı) ailesi YOK — istemcide ne yazılıyor ne okunuyor
 * ("Bırak" eylemi `hidden`'a bağlı, bkz. `useTrackingStore` notu).
 */
const koleksiyonlariYaz = (yanit: KutuphaneYaniti) => {
  setUserRatingsShows(yanit.puanDiziler);
  safeStorageSet(CACHE_KEYS.userRatingsShows, JSON.stringify(yanit.puanDiziler));
  setUserRatingsMovies(yanit.puanFilmler);
  safeStorageSet(CACHE_KEYS.userRatingsMovies, JSON.stringify(yanit.puanFilmler));
  setUserRatingsEpisodes(yanit.puanBolumler);
  safeStorageSet(CACHE_KEYS.userRatingsEpisodes, JSON.stringify(yanit.puanBolumler));

  setWatchlistShows(yanit.izlemeListesiDiziler);
  safeStorageSet(CACHE_KEYS.watchlistShows, JSON.stringify(yanit.izlemeListesiDiziler));
  setWatchlistMovies(yanit.izlemeListesiFilmler);
  safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(yanit.izlemeListesiFilmler));

  setFavShows(yanit.favoriDiziler);
  safeStorageSet(CACHE_KEYS.favShows, JSON.stringify(yanit.favoriDiziler));
  setFavMovies(yanit.favoriFilmler);
  safeStorageSet(CACHE_KEYS.favMovies, JSON.stringify(yanit.favoriFilmler));

  // 🔴 `reconcileHiddenIds` ŞART, düz atama DEĞİL. Kullanıcı bir diziyi az
  // önce gizlediyse ve bu senkron o yazmadan ÖNCEKİ sunucu anlık
  // görüntüsünü taşıyorsa, düz atama o gizlemeyi GERİ ALIR — M322'de
  // ilerlemede yaşanan bayat-yanıt yarışının aynısı. Muhafız uçuştaki
  // mutasyonların beklenen durumunu sunucu listesinin ÜSTÜNE uyguluyor
  // (`hiddenSyncGuard.ts`, Trakt yolu da bunu kullanıyor).
  const gizliDizi = reconcileHiddenIds('show', yanit.gizliDiziler);
  setHiddenShowIds(gizliDizi);
  safeStorageSet(CACHE_KEYS.hiddenShowIds, JSON.stringify(gizliDizi));

  const gizliFilm = reconcileHiddenIds('movie', yanit.gizliFilmler);
  setHiddenMovieIds(gizliFilm);
  safeStorageSet(CACHE_KEYS.hiddenMovieIds, JSON.stringify(gizliFilm));
};

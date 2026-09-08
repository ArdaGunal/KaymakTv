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
} from './utils';

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

/** `watchedShows`/`watchedMovies` girdilerinin beklediği yapım nesnesi. */
const yapimNesnesi = (k: { traktId: number; title: string | null; year: number | null; tmdbId: number | null }) => ({
  // 🔴 `ids.trakt` ZORUNLU — mağazanın TÜM anahtarlaması bunun üzerinde
  // (`trackingLogic.ts:146`). `ids.tmdb` posterin tek dayanağı.
  ids: { trakt: k.traktId, tmdb: k.tmdbId ?? undefined },
  title: k.title ?? '',
  year: k.year ?? undefined,
});

/**
 * Yanıtı mağaza şekline çevirir. SAF — ağ yok, yan etki yok, test edilebilir.
 */
export const yanitiSekillendir = (yanit: KutuphaneYaniti) => {
  const watchedShows = (yanit.diziler || []).map((d) => ({
    show: yapimNesnesi(d),
    // `trackingLogic` "Ara Verilenler" kovasını bu tarihe göre ayırıyor
    // (45 günden eski). `null` bırakmak diziyi yanlış kovaya atardı.
    last_watched_at: d.ilerleme?.last_watched_at ?? null,
  }));

  const showProgressMap: Record<number, any> = {};
  for (const d of yanit.diziler || []) {
    if (d?.traktId) showProgressMap[d.traktId] = d.ilerleme;
  }

  const watchedMovies = (yanit.filmler || []).map((f) => ({
    plays: f.plays ?? 1,
    last_watched_at: f.last_watched_at ?? null,
    movie: yapimNesnesi(f),
  }));

  return { watchedShows, showProgressMap, watchedMovies };
};

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

    // ⚠️ BOŞ YANIT ÖNBELLEĞİ EZMEZ. `fetchers.ts`'in `if (x !== null) setX(x)`
    // kuralıyla aynı gerekçe: geçici bir sunucu arızası kullanıcının
    // kütüphanesini SİLİNMİŞ göstermemeli. Gerçekten boş bir kütüphane ile
    // "veri gelmedi" ayırt edilemediği için güvenli taraf: dokunma.
    const bosYanit = watchedShows.length === 0 && watchedMovies.length === 0;
    if (bosYanit) {
      setHasSyncError(false);
      return true;
    }

    setWatchedShows(watchedShows);
    safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(watchedShows));

    setWatchedMovies(watchedMovies);
    safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(watchedMovies));

    // 🔴 İLERLEME HARİTASI BİRLEŞTİRİLMEZ, DEĞİŞTİRİLİR. Sunucu tek gerçek
    // kaynak; eski bir girdiyi korumak, kullanıcı başka cihazda bir diziyi
    // geçmişinden sildiğinde onu bu cihazda hayatta bırakırdı.
    setShowProgressMap(showProgressMap);
    persistShowProgressMap(showProgressMap);

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

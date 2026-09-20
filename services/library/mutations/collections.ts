import {
  addToWatchlistTrakt,
  removeFromWatchlistTrakt,
  hideItemTrakt,
  unhideItemTrakt,
  removeFromHistoryTrakt,
  toggleLikedMedia,
  createCustomList,
  deleteCustomList,
  addMediaToCustomList,
  removeMediaFromCustomList
} from '../../traktApi';
// ==========================================================================
// 🎯 ADAPTÖR — Faz T · T1 (kullanıcı kararı, 2026-09-07)
// ==========================================================================
// `progress.ts` ile AYNI desen: token tipine bakıp isteği ya Trakt'a ya
// `services/api/library.ts`'e yönlendiriyoruz. 🔴 UI hiçbir şeyin
// değiştiğini bilmez — çağrı imzaları aynı kaldı.
//
// Kilit YALNIZCA bu yönlendirme için açıktır; 400 satır kuralı için genel
// bir refactor ya da temizlik YAPILMADI (kullanıcının dar kapsam kararı).
//
// ⚠️ ÖZEL LİSTE FONKSİYONLARI (`createNewList` · `toggleMediaInList` ·
// `deleteListById` · `getOrCreateDefaultList`) ADAPTE EDİLMEDİ — Worker'da
// liste ailesi, veritabanında `user_lists` tablosu YOK. Kapsam sürünmesini
// önlemek için bilinçli ertelendi (kullanıcı kararı, 2026-09-07):
// altyapı işi `BACKLOG.md` §T2'de, T1'in çekirdeği değil.
//
// 🔴 O YÜZDEN BU DÖRDÜ KAYMAK KULLANICISINDA AÇIKÇA HATA FIRLATIR
// (`KaymakDesteklenmiyorError`). Asıl koruma UI'da — bu fonksiyonlara
// götüren butonlar Kaymak kullanıcısına hiç GÖSTERİLMİYOR. Buradaki fırlatma
// SAVUNMA HATTI: yeni bir çağrı yeri eklenirse ham bir Trakt 401'i yerine
// ne olduğunu söyleyen bir hata alınsın.
import * as libraryApi from '../../api/library';
import { retractLocalActivity } from '../../../features/feed/services/feedPublish';
import {
  CACHE_KEYS,
  safeStorageSet,
  setWatchedShows,
  setWatchedMovies,
  setCustomLists,
  setFavShows,
  setFavMovies,
  setWatchlistShows,
  setWatchlistMovies,
  setShowProgressMap,
  persistShowProgressMap,
  setCalendarShows,
  setCalendarSeasonsMap,
  setHiddenShowIds,
  setHiddenMovieIds,
} from '../utils';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { beginHiddenMutation, endHiddenMutation } from '../hiddenSyncGuard';
import { logError } from '../../../utils/errorLog';
import { recordMutationResult } from '../../../utils/metrics';
import {
  DEFAULT_LIST_NAME,
  MAX_USER_LISTS,
  MAX_LIST_ITEMS,
  ListLimitError,
} from '../../../utils/listHelpers';

/** Bu kullanıcı Faz T yolunu mu kullanıyor? (bkz. `api/library.ts`) */
const kaymakYoluMu = () => libraryApi.kaymakKullanicisiMi();

/**
 * UI'ın `(id, type)` ikilisini Worker'ın beklediği Trakt konumuna çevirir.
 * Tek satırlık ama DÖRT yerde tekrar ederdi; çeviri hatası bu dosyada
 * yanlış yapıma yazmak demek olurdu.
 */
const konumu = (id: number, type: 'show' | 'movie'): libraryApi.TraktKonumu =>
  type === 'show' ? { showId: id } : { movieId: id };

/**
 * Kaymak kullanıcısında henüz arkasında altyapı olmayan bir eylem denendi.
 *
 * Ayrı bir sınıf çünkü çağıran taraf bunu bir AĞ hatasından ayırt edebilmeli:
 * yeniden denemek ya da "bağlantını kontrol et" demek anlamsız — özellik
 * henüz yok. `ListLimitError` ile aynı desen (`utils/listHelpers.ts`).
 */
export class KaymakDesteklenmiyorError extends Error {
  constructor(public readonly ozellik: string) {
    super(`Bu özellik Kaymak hesabında henüz desteklenmiyor: ${ozellik}`);
    this.name = 'KaymakDesteklenmiyorError';
  }
}

/**
 * Liste fonksiyonlarının savunma hattı. UI zaten butonları gizliyor
 * (`useKaymakYetenekleri`); buraya ulaşan bir çağrı ya yeni eklenmiş bir
 * çağrı yeridir ya da gizleme kaçağıdır — ikisi de sessizce Trakt'a gidip
 * 401 almamalı.
 */
const listeKapisi = async (ozellik: string) => {
  if (await kaymakYoluMu()) throw new KaymakDesteklenmiyorError(ozellik);
};

export const toggleWatchlistStatus = async (id: number, type: 'show' | 'movie', isCurrentlyWatchlisted: boolean, mediaData: any) => {
  let previousWatchlistShows: any[] | null = null;
  let previousWatchlistMovies: any[] | null = null;
  const kaymak = await kaymakYoluMu();

  if (type === 'show') {
    setWatchlistShows((prev: any) => {
      previousWatchlistShows = prev;
      const newWatchlist = isCurrentlyWatchlisted
        ? prev.filter((p: any) => p.show?.ids?.trakt !== id)
        : [{ listed_at: new Date().toISOString(), show: mediaData }, ...prev];
      safeStorageSet(CACHE_KEYS.watchlistShows, JSON.stringify(newWatchlist));
      return newWatchlist;
    });
  } else {
    setWatchlistMovies((prev: any) => {
      previousWatchlistMovies = prev;
      const newWatchlist = isCurrentlyWatchlisted
        ? prev.filter((p: any) => p.movie?.ids?.trakt !== id)
        : [{ listed_at: new Date().toISOString(), movie: mediaData }, ...prev];
      safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(newWatchlist));
      return newWatchlist;
    });
  }

  try {
    if (kaymak) {
      const konum = konumu(id, type);
      if (isCurrentlyWatchlisted) {
        await libraryApi.removeFromWatchlist(konum);
      } else {
        await libraryApi.addToWatchlist(konum);
      }
    } else if (isCurrentlyWatchlisted) {
      await removeFromWatchlistTrakt(id, type);
    } else {
      await addToWatchlistTrakt(id, type);
    }
    recordMutationResult('toggleWatchlistStatus', true);
  } catch (err) {
    console.error('Toggle watchlist hatası, rollback yapılıyor:', err);
    logError('mutations.collections.toggleWatchlistStatus', err);
    recordMutationResult('toggleWatchlistStatus', false);
    if (type === 'show' && previousWatchlistShows !== null) {
      setWatchlistShows(previousWatchlistShows);
      safeStorageSet(CACHE_KEYS.watchlistShows, JSON.stringify(previousWatchlistShows));
    } else if (type === 'movie' && previousWatchlistMovies !== null) {
      setWatchlistMovies(previousWatchlistMovies);
      safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(previousWatchlistMovies));
    }
    throw err;
  }
};

export const toggleFavoriteStatus = async (id: number, type: 'show' | 'movie', isCurrentlyFavorited: boolean, mediaData: any) => {
  let previousFavShows: any[] | null = null;
  let previousFavMovies: any[] | null = null;
  const kaymak = await kaymakYoluMu();

  if (type === 'show') {
    setFavShows((prev: any) => {
      previousFavShows = prev;
      const newFavs = isCurrentlyFavorited
        ? prev.filter((p: any) => p.show?.ids?.trakt !== id)
        : [{ listed_at: new Date().toISOString(), show: mediaData }, ...prev];
      safeStorageSet(CACHE_KEYS.favShows, JSON.stringify(newFavs));
      return newFavs;
    });
  } else {
    setFavMovies((prev: any) => {
      previousFavMovies = prev;
      const newFavs = isCurrentlyFavorited
        ? prev.filter((p: any) => p.movie?.ids?.trakt !== id)
        : [{ listed_at: new Date().toISOString(), movie: mediaData }, ...prev];
      safeStorageSet(CACHE_KEYS.favMovies, JSON.stringify(newFavs));
      return newFavs;
    });
  }

  try {
    if (kaymak) {
      // ⚠️ Trakt'ta favori, gizli bir ÖZEL LİSTEDİR (`toggleLikedMedia` bir
      // liste işlemidir). Bizde ayrı bir tablo: `user_favorites`. Bu yüzden
      // burada liste API'sinin karşılığını aramıyoruz — `favorite` ailesi
      // doğrudan karşılığıdır.
      const konum = konumu(id, type);
      if (isCurrentlyFavorited) {
        await libraryApi.removeFromFavorites(konum);
      } else {
        await libraryApi.addToFavorites(konum);
      }
    } else {
      // Trakt API'ye özel listeye ekleme/çıkarma isteğini gönder
      await toggleLikedMedia(id, type, !isCurrentlyFavorited);
    }
    recordMutationResult('toggleFavoriteStatus', true);
  } catch (err) {
    console.error('Toggle favorite hatası, rollback yapılıyor:', err);
    logError('mutations.collections.toggleFavoriteStatus', err);
    recordMutationResult('toggleFavoriteStatus', false);
    if (type === 'show' && previousFavShows !== null) {
      setFavShows(previousFavShows);
      safeStorageSet(CACHE_KEYS.favShows, JSON.stringify(previousFavShows));
    } else if (type === 'movie' && previousFavMovies !== null) {
      setFavMovies(previousFavMovies);
      safeStorageSet(CACHE_KEYS.favMovies, JSON.stringify(previousFavMovies));
    }
    throw err;
  }
};

// "İlerlemeyi Gizle/Göster" — dizinin/filmin izleme geçmişine/puanlarına HİÇ
// dokunmaz, yalnızca Trakt'ın "gizlenen" listesine ekler/çıkarır (diziler için
// `progress_watched`, filmler için `calendar` bölümü — bkz. hideItemTrakt).
// Bu, uygulamanın TEK "Bırak" (Drop) mekanizmasıdır: ayrı bir yerel/Supabase
// "bırakıldı" durumu YOKTUR — Trakt hesabı tüm cihazlarda tek gerçek kaynaktır
// (bkz. hiddenShowIds/hiddenMovieIds store dilimleri + store/tracking/
// trackingLogic.ts, store/tracking/movieTrackingLogic.ts). ESKİ DAVRANIŞ:
// yalnızca hide yönü vardı ve arayüzü güncellemek için HER seferinde tam bir
// `fetchFreshData(force=true)` (13+ endpoint'lik tüm kütüphane resync'i) tetikliyordu
// — tek bir diziyi gizlemek için orantısız bir maliyetti (bkz. performans raporu).
// Artık `toggleFavoriteStatus` ile AYNI optimistic desen kullanılıyor: yerel
// `hiddenShowIds`/`hiddenMovieIds` anında güncellenir, arayüz aynı anda yenilenir,
// tam resync'e hiç gerek kalmaz.
export const toggleHiddenFromProgress = async (id: number, type: 'show' | 'movie', isCurrentlyHidden: boolean) => {
  let previousHiddenShowIds: number[] | null = null;
  let previousHiddenMovieIds: number[] | null = null;
  // 🔴 Yönlendirme kararı `beginHiddenMutation`'DAN ÖNCE alınır. Sonrasında
  // alınsaydı `await` gizleme muhafızının penceresini gereksiz uzatırdı;
  // muhafızın amacı pencereyi DAR tutmak (bkz. hiddenSyncGuard.ts).
  const kaymak = await kaymakYoluMu();

  // Aynı anda çalışan bir tam senkron, bu iyimser güncellemeyi ESKİ bir sunucu
  // anlık görüntüsüyle geri almasın (bkz. services/library/hiddenSyncGuard.ts).
  beginHiddenMutation(type, id, !isCurrentlyHidden);

  if (type === 'show') {
    setHiddenShowIds((prev: number[]) => {
      previousHiddenShowIds = prev;
      const next = isCurrentlyHidden ? prev.filter((existing) => existing !== id) : [...prev, id];
      safeStorageSet(CACHE_KEYS.hiddenShowIds, JSON.stringify(next));
      return next;
    });
  } else {
    setHiddenMovieIds((prev: number[]) => {
      previousHiddenMovieIds = prev;
      const next = isCurrentlyHidden ? prev.filter((existing) => existing !== id) : [...prev, id];
      safeStorageSet(CACHE_KEYS.hiddenMovieIds, JSON.stringify(next));
      return next;
    });
  }

  try {
    if (kaymak) {
      if (isCurrentlyHidden) {
        await (type === 'show' ? libraryApi.unhideShow(id) : libraryApi.unhideMovie(id));
      } else {
        await (type === 'show' ? libraryApi.hideShow(id) : libraryApi.hideMovie(id));
      }
    } else if (isCurrentlyHidden) {
      await unhideItemTrakt(id, type);
    } else {
      await hideItemTrakt(id, type);
    }
    recordMutationResult('toggleHiddenFromProgress', true);
  } catch (err) {
    console.error('Gizle/Göster hatası, rollback yapılıyor:', err);
    logError('mutations.collections.toggleHiddenFromProgress', err);
    recordMutationResult('toggleHiddenFromProgress', false);
    if (type === 'show' && previousHiddenShowIds !== null) {
      setHiddenShowIds(previousHiddenShowIds);
      safeStorageSet(CACHE_KEYS.hiddenShowIds, JSON.stringify(previousHiddenShowIds));
    } else if (type === 'movie' && previousHiddenMovieIds !== null) {
      setHiddenMovieIds(previousHiddenMovieIds);
      safeStorageSet(CACHE_KEYS.hiddenMovieIds, JSON.stringify(previousHiddenMovieIds));
    }
    throw err;
  } finally {
    // Başarı VEYA rollback fark etmez: istek artık uçuşta değil, sonraki
    // senkronlar yine sunucuyu tek gerçek kaynak saysın.
    endHiddenMutation(type, id);
  }
};

export const deleteMediaFromHistory = async (id: number, type: 'show' | 'movie') => {
  const kaymak = await kaymakYoluMu();

  // 🔴 M421 (denetim C) — GERİ ALMA İÇİN FOTOĞRAF. Eski hâl iyimser siliyor,
  // yazma düşerse HİÇBİR ŞEY geri almıyordu; tek "telafi" `fetchFreshData(null)`
  // çağrısıydı ve o fonksiyon ilk satırında `if (!accessToken) return` diyor —
  // yani telafi HİÇBİR kullanıcıda çalışmıyordu (ölü kod).
  const onceki = {
    watchedShows: useLibraryStore.getState().watchedShows,
    watchedMovies: useLibraryStore.getState().watchedMovies,
    showProgressMap: useLibraryStore.getState().showProgressMap,
    calendarShows: useLibraryStore.getState().calendarShows,
    calendarSeasonsMap: useLibraryStore.getState().calendarSeasonsMap,
  };

  if (type === 'show') {
    setWatchedShows((prev: any) => {
      const newWatched = prev.filter((p: any) => p.show?.ids?.trakt !== id);
      safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(newWatched));
      return newWatched;
    });
    setShowProgressMap((prev: any) => {
      const newMap = { ...prev };
      delete newMap[id];
      persistShowProgressMap(newMap);
      return newMap;
    });

    // "Yaklaşanlar" (calendar) sekmesi, watchedShows/showProgressMap'ten TAMAMEN
    // AYRI kendi kopyasını (calendarShows/calendarSeasonsMap) tutan bir dilim —
    // yukarıdaki iki temizlik bu kopyaya hiç dokunmaz. ESKİ DAVRANIŞ: dizi bu
    // iki dilimden kaldırılsa bile calendarShows'daki kopyası olduğu gibi
    // kalıyor, kullanıcı "Geçmişten Sil"e bastığı bir dizi bir sonraki doğal
    // senkrona (10 dk TTL) kadar hâlâ "Yaklaşanlar"da görünmeye devam ediyordu.
    // Dizi HÂLÂ watchlist'teyse (Trakt'ın takvimi watchlist'i de kapsar) calendar
    // kopyası KASITLI OLARAK dokunulmadan bırakılır — o dizi hâlâ meşru bir
    // şekilde takip ediliyor demektir, yalnızca izleme geçmişi silinmiştir.
    const stillWatchlisted = (useLibraryStore.getState().watchlistShows || [])
      .some((p: any) => p.show?.ids?.trakt === id);

    if (!stillWatchlisted) {
      setCalendarShows((prev: any) => {
        const newCal = prev.filter((p: any) => p.show?.ids?.trakt !== id);
        safeStorageSet(CACHE_KEYS.calendarShows, JSON.stringify(newCal));
        return newCal;
      });
      setCalendarSeasonsMap((prev: any) => {
        if (!prev[id]) return prev;
        const newMap = { ...prev };
        delete newMap[id];
        safeStorageSet(CACHE_KEYS.calendarSeasonsMap, JSON.stringify(newMap));
        return newMap;
      });
    }
  } else {
    setWatchedMovies((prev: any) => {
      const newWatched = prev.filter((p: any) => p.movie?.ids?.trakt !== id);
      safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(newWatched));
      return newWatched;
    });
  }

  try {
    if (kaymak) {
      // 🔴 DİZİ ile FİLM AYNI ÇAĞRI DEĞİL. `user_watched` satırları bölüm
      // kimliğinde durduğu için dizi, Worker'ın alt ağaç yolundan gitmek
      // zorunda (`unwatchShow` → `delete_watched_subtree`, migration 038).
      // `unwatchMovie`'yi dizi için çağırmak 200 döner, sıfır satır siler.
      await (type === 'show' ? libraryApi.unwatchShow(id) : libraryApi.unwatchMovie(id));
    } else {
      await removeFromHistoryTrakt(id, type);
    }
    // 🔴 M421 (denetim I) — AKIŞTAKİ KAYIT DA GERİ ÇEKİLİR. Bölüm geri
    // almada bu vardı (`progress.ts`), film/dizi geçmişi silmede YOKTU:
    // kullanıcı "izlemedim" dese bile akışta "izledi" kartı kalıyordu.
    retractLocalActivity((a: any) =>
      a.showId === id
      && (type === 'movie'
        ? a.activityType === 'watched_movie'
        : a.activityType === 'watched_episode'));

    recordMutationResult('deleteMediaFromHistory', true);
  } catch (err) {
    console.error('Delete from history hatası:', err);
    logError('mutations.collections.deleteMediaFromHistory', err);
    recordMutationResult('deleteMediaFromHistory', false);
    // 🔴 M421 — GERÇEK GERİ ALMA (eski "telafi" ölü koddu, bkz. yukarısı).
    setWatchedShows(onceki.watchedShows);
    safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(onceki.watchedShows));
    setWatchedMovies(onceki.watchedMovies);
    safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(onceki.watchedMovies));
    setShowProgressMap(onceki.showProgressMap);
    persistShowProgressMap(onceki.showProgressMap);
    setCalendarShows(onceki.calendarShows);
    safeStorageSet(CACHE_KEYS.calendarShows, JSON.stringify(onceki.calendarShows));
    setCalendarSeasonsMap(onceki.calendarSeasonsMap);
    safeStorageSet(CACHE_KEYS.calendarSeasonsMap, JSON.stringify(onceki.calendarSeasonsMap));
    throw err;
  }
};

export const createNewList = async (name: string, description?: string) => {
  await listeKapisi('createNewList');
  // Trakt limiti: kullanıcıya en fazla MAX_USER_LISTS izin verilir (1 slot favori
  // listesine rezerve). Kontrol store'daki (favori zaten süzülmüş) sayı üzerinden
  // yapılır — ekstra ağ isteği gerektirmez.
  const currentUserLists = useLibraryStore.getState().customLists || [];
  if (currentUserLists.length >= MAX_USER_LISTS) {
    throw new ListLimitError('maxLists');
  }

  try {
    const newList = await createCustomList(name, description);
    setCustomLists((prev: any) => {
      const updated = [newList, ...prev];
      safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(updated));
      return updated;
    });
    recordMutationResult('createNewList', true);
    return newList;
  } catch (err) {
    console.error('Liste oluşturma hatası:', err);
    logError('mutations.collections.createNewList', err);
    recordMutationResult('createNewList', false);
    throw err;
  }
};

// "Listeye ekle" akışının varsayılan hedefi. Varsa mevcut "Koleksiyonum"u döndürür,
// yoksa oluşturur (limit createNewList içinde uygulanır).
export const getOrCreateDefaultList = async () => {
  const lists = useLibraryStore.getState().customLists || [];
  const existing = lists.find((l: any) => l.name === DEFAULT_LIST_NAME);
  if (existing) return existing;
  return await createNewList(DEFAULT_LIST_NAME, 'Kaydettiğim içerikler.');
};

export const toggleMediaInList = async (listId: number, mediaId: number, type: 'show' | 'movie', isAdding: boolean) => {
  await listeKapisi('toggleMediaInList');
  // Ekleme öncesi 250 öğe limitini uygula (Trakt liste başına sınır).
  if (isAdding) {
    const list = (useLibraryStore.getState().customLists || []).find((l: any) => l.ids?.trakt === listId);
    if (list && (list.item_count || 0) >= MAX_LIST_ITEMS) {
      throw new ListLimitError('maxItems');
    }
  }

  // İyimser güncelleme: item_count'u ANINDA değiştir, hata olursa geri al.
  let previousLists: any[] | null = null;
  setCustomLists((prev: any) => {
    previousLists = prev;
    const updated = prev.map((list: any) => {
      if (list.ids?.trakt === listId) {
        return {
          ...list,
          item_count: isAdding ? (list.item_count || 0) + 1 : Math.max(0, (list.item_count || 0) - 1)
        };
      }
      return list;
    });
    safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(updated));
    return updated;
  });

  try {
    if (isAdding) {
      await addMediaToCustomList(listId, mediaId, type);
    } else {
      await removeMediaFromCustomList(listId, mediaId, type);
    }
    recordMutationResult('toggleMediaInList', true);
  } catch (err) {
    console.error('Liste medyası ekle/çıkar hatası, geri alınıyor:', err);
    logError('mutations.collections.toggleMediaInList', err);
    recordMutationResult('toggleMediaInList', false);
    if (previousLists !== null) {
      setCustomLists(previousLists);
      safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(previousLists));
    }
    throw err;
  }
};

// Listeyi Trakt'tan siler ve store'dan iyimser olarak kaldırır.
export const deleteListById = async (listId: number | string) => {
  await listeKapisi('deleteListById');
  let previousLists: any[] | null = null;
  setCustomLists((prev: any) => {
    previousLists = prev;
    const updated = prev.filter((l: any) => String(l.ids?.trakt) !== String(listId));
    safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(updated));
    return updated;
  });

  try {
    await deleteCustomList(listId);
    recordMutationResult('deleteListById', true);
  } catch (err) {
    console.error('Liste silme hatası, geri alınıyor:', err);
    logError('mutations.collections.deleteListById', err);
    recordMutationResult('deleteListById', false);
    if (previousLists !== null) {
      setCustomLists(previousLists);
      safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(previousLists));
    }
    throw err;
  }
};

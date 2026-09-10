import { addRating, removeRating } from '../../traktApi';
// ==========================================================================
// 🎯 ADAPTÖR — Faz T · T1 (2026-09-09)
// ==========================================================================
// 🔴 BU DOSYA M317'DE ATLANDI. `progress.ts` ve `collections.ts` adapte
// edildi, puanlama YOLU GÖZDEN KAÇTI — Kaymak kullanıcısında puan vermek
// doğrudan Trakt'a gidip 401 alıyordu (kullanıcı cihazda bildirdi).
//
// ⚠️ DERS: "yazma yollarını adapte ettim" demek, mutasyon KLASÖRÜNÜN
// tamamını taramak demektir. İki dosyaya bakıp üçüncüyü varsaymak yetmedi.
import * as libraryApi from '../../api/library';
import { logError } from '../../../utils/errorLog';
import { resolveMediaMeta } from '../mediaMeta';
import { publishActivities, retractLocalActivity, nowStamp } from '../../../features/feed/services/feedPublish';
import {
  CACHE_KEYS,
  safeStorageSet,
  setUserRatingsShows,
  setUserRatingsMovies,
  setUserRatingsEpisodes,
} from '../utils';

export const setLocalRating = (id: number, type: 'show' | 'movie' | 'episode', rating: number) => {
  const updateStateAndCache = (
    setFn: (updater: any) => void,
    cacheKey: string,
    itemKey: string
  ) => {
    setFn((prev: any) => {
      // Eğer zaten varsa güncelle
      const existsIndex = prev.findIndex((r: any) => r[itemKey]?.ids?.trakt === id);
      let updated;
      if (existsIndex >= 0) {
        updated = [...prev];
        updated[existsIndex] = { ...updated[existsIndex], rating };
      } else {
        // Yoksa ekle
        updated = [...prev, { rating, [itemKey]: { ids: { trakt: id } } }];
      }
      safeStorageSet(cacheKey, JSON.stringify(updated));
      return updated;
    });
  };

  if (type === 'show') updateStateAndCache(setUserRatingsShows, CACHE_KEYS.userRatingsShows, 'show');
  else if (type === 'movie') updateStateAndCache(setUserRatingsMovies, CACHE_KEYS.userRatingsMovies, 'movie');
  else if (type === 'episode') updateStateAndCache(setUserRatingsEpisodes, CACHE_KEYS.userRatingsEpisodes, 'episode');
};

export const removeLocalRating = (id: number, type: 'show' | 'movie' | 'episode') => {
  const removeStateAndCache = (
    setFn: (updater: any) => void,
    cacheKey: string,
    itemKey: string
  ) => {
    setFn((prev: any) => {
      const updated = prev.filter((r: any) => r[itemKey]?.ids?.trakt !== id);
      safeStorageSet(cacheKey, JSON.stringify(updated));
      return updated;
    });
  };

  if (type === 'show') removeStateAndCache(setUserRatingsShows, CACHE_KEYS.userRatingsShows, 'show');
  else if (type === 'movie') removeStateAndCache(setUserRatingsMovies, CACHE_KEYS.userRatingsMovies, 'movie');
  else if (type === 'episode') removeStateAndCache(setUserRatingsEpisodes, CACHE_KEYS.userRatingsEpisodes, 'episode');
};

// ─────────────────────────────────────────────────────────────────────────
// PUANLAMA + AKIŞA ANINDA YAYIN
//
// ESKİ DAVRANIŞ: ekranlar `addRating`i (ham Trakt katmanı) DOĞRUDAN çağırıyordu
// — 6 ayrı çağrı noktası, hiçbiri Akış'tan haberdar değil. Bir puan verildiğinde
// akışa düşmesi için uygulamanın kapanıp yeniden açılması gerekiyordu.
//
// `rateMedia`, dizi/film puanlaması için TEK giriş noktasıdır: Trakt'a yazar ve
// aynı damgayla Akış'a yayınlar. BÖLÜM puanları bilinçli olarak kapsam dışı —
// Akış şeması yalnızca dizi/film puanı taşıyor (bkz. Worker handleFeedSync,
// /sync/ratings/{shows,movies}); bölüm puanı için `addRating` doğrudan
// çağrılmaya devam eder.
// ─────────────────────────────────────────────────────────────────────────
/**
 * ==========================================================================
 * 🌓 GÖLGE YAZIM (Dual Write) — kullanıcı kararı, 2026-09-09
 * ==========================================================================
 * Trakt'lı kullanıcı puan verdiğinde puan İKİ yere gider: Trakt'a (ekosistemi
 * bozulmasın — başka Trakt uygulamalarıyla bağı sürsün) VE bizim
 * `user_ratings`'e (puanlar tek yerde toplansın, Trakt kopsa kaybolmasın).
 *
 * 🔴 İSTİSNA YALNIZCA PUANLAR İÇİN. İzleme geçmişi HÂLÂ tek yönlü:
 * Trakt'lı kullanıcının izlemesi yalnızca Trakt'a yazılıyor (devir §4.7).
 * Kullanıcının kararı bunu açıkça sınırladı: *"İzleme geçmişine dokunmadan
 * bu istisnayı sadece puanlar için açıyoruz."*
 *
 * 🔴 GÖLGE YAZIM ASLA ANA YAZMAYI BOZAMAZ. Kullanıcının eylemi Trakt'ta
 * başarılıysa BAŞARILIDIR. Bizim kopyamız düşerse:
 *   · en sık sebep `katalogda_yok` (409) — aynamızda olmayan bir yapım;
 *     kullanıcının hatası değil, KAPSAM boşluğu
 *   · T5'in içe aktarımı o satırı zaten geri getirecek
 * Bu yüzden hata YUTULUYOR ama `logError` ile İZ BIRAKIYOR — sessiz kayıp
 * değil, görünür bir eksik.
 */
const golgeYaz = async (yer: string, islem: () => Promise<unknown>) => {
  try {
    await islem();
  } catch (e) {
    logError(`mutations.ratings.golge.${yer}`, e);
  }
};

export const rateMedia = async (id: number, type: 'show' | 'movie', rating: number) => {
  // Damga Trakt'a ve Akış'a AYNI gönderilir — bir sonraki tam senkron aynı
  // dedup anahtarını üretsin diye (bkz. mutations/progress.ts başlığı).
  const ratedAt = nowStamp();
  const kaymak = await libraryApi.kaymakKullanicisiMi();
  const bizeYaz = () =>
    type === 'show' ? libraryApi.rateShow(id, rating) : libraryApi.rateMovie(id, rating);

  let result;
  if (kaymak) {
    result = await bizeYaz();
  } else {
    // ANA yazma — bu düşerse çağıran hatayı görür ve iyimser UI geri alınır.
    result = await addRating(id, type, rating, undefined, undefined, ratedAt);
    // GÖLGE — beklenmiyor, hata yutuluyor (bkz. `golgeYaz` notu).
    await golgeYaz(`rate.${type}`, bizeYaz);
  }

  // Başlık/poster kütüphane dilimlerinden çözülür — çağıranların imzasını
  // Akış yüzünden değiştirmemek için (bkz. services/library/mediaMeta.ts).
  const meta = resolveMediaMeta(id, type);
  if (meta.title) {
    publishActivities([
      {
        activityType: 'rated',
        showId: id,
        mediaType: type,
        showTitle: meta.title,
        tmdbId: meta.tmdbId,
        rating,
        activityAt: ratedAt,
      },
    ]);
  }

  return result;
};

// Puan kaldırıldığında akıştaki kart da düşmeli — aksi halde kullanıcı
// sildiği bir puanı akışında görmeye devam ederdi. Yalnızca YEREL akış
// temizlenir; Supabase satırını bir sonraki tam senkron geri alma mantığıyla
// siler (bkz. mutations/progress.ts'teki aynı gerekçe).
export const unrateMedia = async (id: number, type: 'show' | 'movie') => {
  const kaymak = await libraryApi.kaymakKullanicisiMi();
  const bizdenSil = () =>
    type === 'show' ? libraryApi.unrateShow(id) : libraryApi.unrateMovie(id);

  let result;
  if (kaymak) {
    result = await bizdenSil();
  } else {
    result = await removeRating(id, type);
    // 🔴 SİLME DE GÖLGELENMELİ. Yalnızca yazmayı gölgeleseydik kullanıcı
    // puanını kaldırdığında bizim kopyamız KALIRDI — ve T5 içe aktarımında
    // "silinmiş puan" geri dirilirdi.
    await golgeYaz(`unrate.${type}`, bizdenSil);
  }
  retractLocalActivity((a) => a.activityType === 'rated' && a.showId === id && a.mediaType === type);
  return result;
};

// ─────────────────────────────────────────────────────────────────────────
// BÖLÜM PUANI — mutasyon katmanına ALINDI (2026-09-09)
// ─────────────────────────────────────────────────────────────────────────
// 🔴 ESKİDEN `useEpisodeActions` ham `addRating`i DOĞRUDAN çağırıyordu ve bu
// dosyanın kendi notu bunu "bilinçli kapsam dışı" diye açıklıyordu (gerekçe:
// akış şeması bölüm puanı taşımıyor). Faz T'de o gerekçe ARTIK YETMİYOR:
// yönlendirme kararı mutasyon katmanında yaşıyor, hook'ta değil. Ham çağrı
// kalsaydı Kaymak kullanıcısı bölüm puanlayamazdı.
//
// ⚠️ AKIŞA YAYIN HÂLÂ YOK — o kısım gerçekten kapsam dışı (şema dizi/film
// puanı taşıyor). Değişen tek şey YAZMANIN NEREYE gittiği.
//
// 🔑 İMZA YALNIZCA `epTraktId` ALIYOR — bilinçli. İki çağrı yerinden biri
// (`useShowDetailHandlers.handleRateEpisode`) sezon/bölüm numarası TAŞIMIYOR
// ve o kimlikten türetilemez. Çağrı yerlerini zorlamak yerine Worker bölüm
// kimliğini doğrudan çözüyor (`resolveTraktLocator` → `{ episodeId }`).
// Böylece iki yol da TEK imzayı kullanıyor ve `epTraktId` zaten yerel puan
// dilimi için elde olan tek şey.

export const rateEpisodeMedia = async (epTraktId: number, rating: number) => {
  if (await libraryApi.kaymakKullanicisiMi()) {
    return libraryApi.rateEpisodeById(epTraktId, rating);
  }
  const result = await addRating(epTraktId, 'episode', rating);
  await golgeYaz('rate.episode', () => libraryApi.rateEpisodeById(epTraktId, rating));
  return result;
};

export const unrateEpisodeMedia = async (epTraktId: number) => {
  if (await libraryApi.kaymakKullanicisiMi()) {
    return libraryApi.unrateEpisodeById(epTraktId);
  }
  const result = await removeRating(epTraktId, 'episode');
  await golgeYaz('unrate.episode', () => libraryApi.unrateEpisodeById(epTraktId));
  return result;
};

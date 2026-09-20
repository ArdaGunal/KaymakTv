import {
  addEpisodeToHistory,
  addSeasonToHistory,
  addEpisodesBulkToHistory,
  removeEpisodeFromHistoryTrakt,
  removeSeasonFromHistoryTrakt,
  addMovieToHistory,
  addToWatchlistTrakt,
} from '../../traktApi';
// ==========================================================================
// 🎯 ADAPTÖR — Faz T · T1 (kullanıcı kararı, 2026-09-07)
// ==========================================================================
// Bu dosya `BACKLOG.md` §B'de DONDURULMUŞ'tu. Kilit YALNIZCA aşağıdaki
// yönlendirme mantığı için açıldı; 400 satır kuralı için genel bir refactor
// ya da temizlik YAPILMADI.
//
// 🔴 UI HİÇBİR ŞEYİN DEĞİŞTİĞİNİ BİLMEZ. Bileşenler hâlâ
// `markEpisodeAsWatched(showId, season, episode)` çağırıyor; token tipine
// göre Trakt'a mı bizim API'ye mi gideceği kararı BU DOSYADA veriliyor.
import * as libraryApi from '../../api/library';
import { bolumleriIsaretle, sezonuIsaretle, bolumleriGeriAl } from './optimistikIlerleme';
import { izlenenFilmeEkle } from './optimistikFilm';
import { fetchFreshData } from '../fetchers';
import {
  CACHE_KEYS,
  safeStorageSet,
  setWatchedMovies,
  setWatchedShows,
  setWatchlistMovies,
  setShowProgressMap,
  persistShowProgressMap,
} from '../utils';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { toggleHiddenFromProgress } from './collections';
import { logError } from '../../../utils/errorLog';
import { recordMutationResult } from '../../../utils/metrics';
import {
  publishActivities,
  retractLocalActivity,
  formatEpisodeCode,
  nowStamp,
} from '../../../features/feed/services/feedPublish';
import { resolveMediaMeta } from '../mediaMeta';

// ─────────────────────────────────────────────────────────────────────────
// AKIŞA ANINDA YAYIN
//
// ESKİ DAVRANIŞ: bir bölümü/filmi işaretlemek yalnızca Trakt'a yazıyordu;
// aktivitenin Akış'a düşmesi için uygulamanın kapanıp yeniden açılması ve
// oradaki `/feed/sync`in çalışması gerekiyordu. Artık Trakt yazımı başarılı
// olur olmaz aktivite Akış'a da yayınlanıyor.
//
// İKİ KURAL:
//  1. ATEŞLE-VE-UNUT — yayın, kullanıcının "izledim" akışını ASLA bloklamaz
//     ve başarısız olsa bile izleme işlemini başarısız SAYDIRMAZ (yayın
//     kendi içinde iyimser kartı geri alıp loglar).
//  2. AYNI ZAMAN DAMGASI — Trakt'a `watched_at`/`rated_at` olarak gönderilen
//     damganın AYNISI yayınlanır. Bir sonraki tam senkron Trakt'tan aynı
//     damgayı okuyup aynı dedup anahtarını üretir; satır ne kopyalanır ne
//     de "Trakt'ta yok" sanılıp silinir.
// ─────────────────────────────────────────────────────────────────────────

/** Yayın için gereken meta (başlık + poster id) — bkz. services/library/mediaMeta.ts */
const showMetaFor = (showId: number) => resolveMediaMeta(showId, 'show');

// Kullanıcı "Bırak" ile Trakt'ta gizlediği bir diziyi/filmi sonradan yeniden
// izlemeye başlarsa gizleme otomatik kaldırılır — aksi halde dizi/film Trakt'ın
// gizlenen listesinde takılı kalır ve ana vitrin listelerine asla geri dönmez.
//
// Gizleme kaldırma mantığı BİLİNÇLİ OLARAK burada tekrar YAZILMAZ:
// `toggleHiddenFromProgress` zaten iyimser güncelleme + diske yazma + hata
// halinde rollback + metrik kaydı + senkron yarış koruması (hiddenSyncGuard)
// içeriyor. Buradaki ilk sürüm bu adımların yalnızca bir kısmını kopyalamıştı
// ve rollback'i yoktu — istek başarısız olduğunda yerel durum "gizli değil",
// Trakt "gizli" kalıyor, ilk senkronda dizi kullanıcının gözü önünde geri
// gizleniyordu. Tek kaynağa devredilerek bu sapma kapatıldı.
//
// Çağrı ateşle-ve-unut: kullanıcının "izledim" akışını bloklamamalı, bu yüzden
// `await` edilmez; hata halinde `toggleHiddenFromProgress` kendi rollback'ini
// zaten yapar.
const unhideShowIfNeeded = (showId: number) => {
  if (!useLibraryStore.getState().hiddenShowIds.includes(showId)) return;
  toggleHiddenFromProgress(showId, 'show', true).catch((e) =>
    console.error('Otomatik gizleme kaldırma (show) hatası:', e)
  );
};

const unhideMovieIfNeeded = (movieId: number) => {
  if (!useLibraryStore.getState().hiddenMovieIds.includes(movieId)) return;
  toggleHiddenFromProgress(movieId, 'movie', true).catch((e) =>
    console.error('Otomatik gizleme kaldırma (movie) hatası:', e)
  );
};

// Kullanıcı bir dizinin yeni bir bölümünü/sezonunu izlediğinde (tek bölüm,
// toplu bölüm veya sezon işaretleme — geri alma DEĞİL), o dizi artık "aktif
// izleniyor" sayılmalı: Diziler > İzleme sekmesindeki normal bir dizi gibi
// davranmalı.
//   1. "Bırak" ile Trakt'ta gizlenmişse gizleme kaldırılır (Bırak, tarihten/
//      ilerlemeden tamamen bağımsız, en yüksek öncelikli bir kova olduğu için
//      progress güncellemesi tek başına bunu geçersiz kılamaz — açıkça temizlemek gerekir).
//   2. `watchedShows`'taki `last_watched_at` "şimdi"ye çekilir — aksi halde
//      "Ara Verilenler" (45 günden eski) kovasındaki bir dizi, eski tarih
//      hâlâ orada dururken bölüm işaretlese bile pasif görünmeye devam ederdi.
//      (Henüz `watchedShows`'ta hiç yoksa — örn. yalnızca watchlist'ten gelen
//      bir dizi — dokunmuyoruz: trackingLogic zaten "son izleme bilinmiyor"
//      durumunu güvenli varsayılan olarak aktif sayıyor.)
const reactivateShowTracking = (showId: number) => {
  unhideShowIfNeeded(showId);

  setWatchedShows((prev: any[]) => {
    const idx = (prev || []).findIndex((item: any) => item?.show?.ids?.trakt === showId);
    if (idx === -1) return prev;
    const updated = [...prev];
    updated[idx] = { ...updated[idx], last_watched_at: new Date().toISOString() };
    safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(updated));
    return updated;
  });
};

// ==========================================================================
// 🔴 İLERLEME TAZELEME — adaptörün İKİNCİ (ve kolayca atlanan) ayağı
// ==========================================================================
// 🔄 T6.1 SONRASI DURUM (2026-09-13): yazma sonrası ilerleme HER KULLANICIDA
// `libraryApi.fetchShowProgress(showId)` ile BİZDEN tazeleniyor — Worker'ın
// `/library/sync` ucunun tek dizilik kipi, şekil Trakt'ınkiyle aynı.
// `getShowProgress` (Trakt, dizi başına istek) bu dosyadan TAMAMEN KALKTI.
//
// 📜 TARİHÇE — buraya nasıl gelindi:
// Eskiden hepsi yazma sonrası Trakt'ın `getShowProgress`ini çağırıyordu.
// Google-only kullanıcının Trakt token'ı YOK; o çağrı 401 döner, fonksiyon
// `catch`e düşer ve iyimser UI GERİ ALINIR — yazma BAŞARILI olsa bile
// kullanıcı "olmadı" görürdü. M319 bunu Kaymak kullanıcısı için çözdü;
// T6.1 aynı yolu Trakt'lı kullanıcıya da açtı ve dizi-başına Trakt
// isteğini (§D14 / Y28) tamamen kaldırdı.
//
// 🔴 ÖNCEKİ TUR NEDEN YETMEDİ: iyimser durumu döndürüp bırakıyorduk.
// Ama iyimser güncelleme (aşağıda) YALNIZCA `next_episode.number`'ı
// artırıyor; `seasons[].episodes[].completed`'a HİÇ dokunmuyor. Takip
// kartı `next_episode` okuyor (ilerliyordu ✅), dizi detay ekranı
// `seasons[].episodes[].completed` okuyor (`useShowDetail.ts:212`) —
// işaretlenen bölüm "izlenmemiş" görünmeye devam ediyordu. İki farklı
// alan, tek güncelleme.
const kaymakYoluMu = () => libraryApi.kaymakKullanicisiMi();

/**
 * 🔄 ÇİFT YAZMA — T6 kararı (kullanıcı, 2026-09-13).
 *
 * Trakt'lı kullanıcı artık BİZDEN okuyor; bu yüzden işaretleme HER İKİ
 * yere birden gitmek zorunda. Yalnızca Trakt'a yazsaydık ekran bizden
 * okuduğu için işaretleme **fark turuna kadar (6 saat) görünmezdi**.
 *
 * 🔴 SIRA ÖNEMLİ — ÖNCE BİZE. Arayüzün gördüğü satır bizimki. Ters sırada
 * Trakt tutup bizimki düşerse kullanıcı hiçbir şey görmez, tekrar işaretler
 * ve YENİ damgayla Trakt'a gerçek bir yeniden-izleme satırı düşer (M318).
 *
 * 🔴 TRAKT DÜŞERSE BİZİMKİ GERİ ALINMAZ (yine M318): kalıcı yazılmış bir
 * işaretlemeyi ekrandan silmek kullanıcıyı hayalet üretmeye iter. Trakt
 * yazması "elden geldiğince"dir.
 *
 * ✅ ÇİFT SAYIM YOK: aynı `watchedAt` ikisine de gidiyor; fark turu izlemeyi
 * Trakt'tan geri getirdiğinde `user_id,kaymak_id,watched_at` çakışması
 * tutuyor ve aktarım "yok say" politikasıyla satırı ATLIYOR. Süpürme de
 * yalnızca `source=trakt` siliyor, bizimki `kaymak`.
 *
 * @param trakte Google-only kullanıcıda `null` — Trakt token'ı yok, 401 alırdı.
 */
const ciftYaz = async (
  bize: () => Promise<unknown>,
  trakte: (() => Promise<unknown>) | null,
): Promise<void> => {
  await bize();
  if (!trakte) return;
  try {
    await trakte();
  } catch (error) {
    // Yutuluyor ama SESSİZ DEĞİL — M366/M370'in dersi: bir işi çökertmemek
    // doğru, "yapıldı" göstermek yanlış. Bizim satırımız yazıldı ve okuma
    // yolu artık biziz; Trakt bu işaretlemeyi kaçırdı.
    console.warn("[ciftYaz] Trakt yazması düştü, bizimki KALICI:", (error as any)?.message || error);
  }
};

/** Mağazadaki mevcut ilerleme — tazeleme başarısız olursa geri düşülür. */
const mevcutIlerleme = (showId: number) =>
  (useLibraryStore.getState() as any)?.showProgressMap?.[showId] ?? null;

/**
 * Kaymak kullanıcısı için ilerlemeyi SUNUCUDAN tazeler, mağazaya yazar ve
 * döndürür — Trakt dalındaki `getShowProgress` + `setShowProgressMap`
 * ikilisinin karşılığı.
 *
 * ⚠️ HATA YUTULUYOR, BİLİNÇLİ: yazma ZATEN BAŞARILI olmuştur (bu fonksiyon
 * ancak ondan sonra çağrılıyor). Tazeleme başarısız diye `catch`e düşüp
 * iyimser durumu GERİ ALMAK, kalıcı olarak yazılmış bir işaretlemeyi
 * ekrandan silmek olurdu — kullanıcı "olmadı" sanıp tekrar işaretler ve
 * hayalet yeniden-izleme satırı üretir (M318'de tam olarak bu yaşandı).
 */
// ==========================================================================
// 🏁 YARIŞ KORUMASI — bayat tazeleme, taze iyimser durumu EZMESİN (M322)
// ==========================================================================
// Kullanıcı hızlı işaretlediğinde görülen "E7 oldu, E6'ya geri döndü":
//
//   t=0    E5 işaretle → iyimser: sıradaki E6 → tazeleme R1 gider
//   t=200  E6 işaretle → iyimser: sıradaki E7 → tazeleme R2 gider
//   t=1000 R1 DÖNER — ama sunucuda E6 YAZILMADAN ÖNCE hesaplanmıştı:
//          "E5 izlendi, sıradaki E6" → mağazaya yazılır → EKRAN GERİ DÜŞER
//
// 🔴 UI'I YAVAŞLATMAK BU HATAYI GİZLER, ÇÖZMEZ. Yarış ağ gecikmesinde;
// kullanıcı yeterince hızlıysa hangi eşiği koyarsak koyalım tekrar açılır.
//
// İki parçalı çözüm:
//   1. NESİL SAYACI — her mutasyon diziye ait sayacı artırır. Tazeleme
//      döndüğünde sayaç değiştiyse yanıt BAYATTIR ve ATILIR.
//   2. GECİKMELİ TAZELEME — arka arkaya işaretlemeler tek bir tazelemede
//      birleşir. Hem istek sayısı düşer (oran sınırı!) hem de çalışan tek
//      tazeleme SON yazmadan sonra olur.
const ilerlemeNesli = new Map<number, number>();
const bekleyenTazeleme = new Map<number, ReturnType<typeof setTimeout>>();

/** Kullanıcı arka arkaya basarken tazelemeleri birleştirme penceresi. */
const TAZELEME_GECIKMESI_MS = 700;

/** Bir mutasyon başladı — bu diziye ait uçuştaki tazelemeler bayatladı. */
const nesliArtir = (showId: number) => {
  const n = (ilerlemeNesli.get(showId) ?? 0) + 1;
  ilerlemeNesli.set(showId, n);
  return n;
};

/**
 * Tazelemeyi GECİKTİREREK planlar. Aynı dizi için bekleyen bir tazeleme
 * varsa iptal edilir — 10 bölümü hızlıca işaretleyen kullanıcı 10 değil
 * TEK istek üretir.
 *
 * ⚠️ Ateşle-unut: çağıran beklemez. İyimser durum zaten doğru (M321);
 * tazelemenin tek işi sunucuyla teyit etmek.
 */
const tazelemeyiPlanla = (showId: number) => {
  // 🔴 İYİMSER DURUMU HEMEN DİSKE YAZ — tazeleme artık BEKLENMİYOR ve
  // kalıcılığı o yapıyordu. Yazmazsak: kullanıcı işaretler, uygulamayı
  // hemen kapatır, 10 dakikalık TTL yüzünden açılışta senkron ATLANIR ve
  // önbellekten yüklenen harita o işareti taşımaz — sunucuda kayıt VAR
  // ama ekranda YOK. Dar ama gerçek bir pencere.
  persistShowProgressMap(useLibraryStore.getState().showProgressMap);

  const mevcut = bekleyenTazeleme.get(showId);
  if (mevcut) clearTimeout(mevcut);
  bekleyenTazeleme.set(
    showId,
    setTimeout(() => {
      bekleyenTazeleme.delete(showId);
      void kaymakIlerlemeTazele(showId, ilerlemeNesli.get(showId) ?? 0);
    }, TAZELEME_GECIKMESI_MS),
  );
};

const kaymakIlerlemeTazele = async (showId: number, beklenenNesil?: number) => {
  try {
    const taze = await libraryApi.fetchShowProgress(showId);

    // 🔴 BAYAT YANIT KONTROLÜ — ağ turu sırasında kullanıcı yeni bir bölüm
    // işaretlediyse bu yanıt onu BİLMİYOR. Yazmak, kullanıcının az önce
    // yaptığı işi ekrandan geri almak olurdu (bildirilen "E7 → E6" hatası).
    if (beklenenNesil !== undefined && (ilerlemeNesli.get(showId) ?? 0) !== beklenenNesil) {
      return mevcutIlerleme(showId);
    }

    // ══════════════════════════════════════════════════════════════════
    // 🔴 İKİ SESSİZ ÇIKIŞ KAPATILDI (M320)
    // ══════════════════════════════════════════════════════════════════
    // Buradaki `if (!taze) return` HİÇBİR iz bırakmıyordu: `logError` yok,
    // `console.warn` da üretim derlemesinde siliniyor. Yani "tazeleme
    // çalıştı ama boş döndü" senaryosunun cihazda GÖZLEMLENEBİLİR TEK BİR
    // İZİ yoktu — tam olarak aradığımız semptomu üreten kör nokta.
    if (!taze) {
      logError(
        'mutations.progress.kaymakIlerlemeTazele',
        new Error(`Sunucu bu dizi için ilerleme döndürmedi (showId=${showId}).`),
      );
      return mevcutIlerleme(showId);
    }

    // 🔴 BOŞ İLERLEME MAĞAZAYI EZMESİN. Sunucu 200 + `seasons: []`
    // döndürebilir (ör. aynada o dizinin sezon/bölümleri yoksa — ölçüldü:
    // 541 dizinin 18'i böyle). Bunu yazsaydık VAR OLAN tüm tikler silinirdi
    // ve kullanıcı ilerlemesini kaybederdi. Elimizde dolu bir kayıt varken
    // boş bir kayıtla değiştirmek her koşulda yanlış.
    const oncekiSezonSayisi = mevcutIlerleme(showId)?.seasons?.length ?? 0;
    if ((taze.seasons?.length ?? 0) === 0 && oncekiSezonSayisi > 0) {
      logError(
        'mutations.progress.kaymakIlerlemeTazele',
        new Error(`Sunucu BOŞ ilerleme döndürdü, mevcut korunuyor (showId=${showId}).`),
      );
      return mevcutIlerleme(showId);
    }

    setShowProgressMap((prev: any) => {
      const guncel = { ...prev, [showId]: taze };
      persistShowProgressMap(guncel);
      return guncel;
    });
    return taze;
  } catch (e) {
    // ⚠️ `console.warn` üretimde SİLİNİYOR — tek kalıcı iz `logError`.
    logError('mutations.progress.kaymakIlerlemeTazele', e);
    return mevcutIlerleme(showId);
  }
};

export const markEpisodeAsWatched = async (showId: number, season: number, episode: number) => {
  let previousState: any = null;
  let optimistikProgress: any = null;
  const kaymak = await kaymakYoluMu();
  // 🔴 NESLİ HEMEN ARTIR: bu andan itibaren uçuşta olan her tazeleme
  // BAYATTIR (bkz. yarış koruması notu). Yazma başarısız olsa bile artırmak
  // doğru — bayat bir yanıtı yazmaktansa bir tazelemeyi atlamak güvenli.
  nesliArtir(showId);

  console.log(`[OPTIMISTIC UI] Bölüm UI'da işaretleniyor: Show ${showId}, S${season}E${episode}`);
  reactivateShowTracking(showId);

  const iyimserDamga = nowStamp();

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    // ══════════════════════════════════════════════════════════════════
    // 🔴 EKSİKSİZ İYİMSER YAMA (M321) — eskiden BURASI YARIMDI
    // ══════════════════════════════════════════════════════════════════
    // Eski hâli YALNIZCA `next_episode.number`'ı artırıyordu. Ama
    // `seasons[].episodes[].completed`'ı ÜÇ tüketici okuyor:
    //   1. bölüm listesindeki yeşil tik (`useShowDetail.ts:212`)
    //   2. "bu bölüm izlendi mi" (`useEpisodeActions.ts:54`)
    //   3. 🔴 "ATLANAN BÖLÜM VAR MI" (`useEpisodeActions.ts:103`)
    //
    // Üçüncüsü kullanıcının bildirdiği hatayı üretiyordu: arka arkaya
    // bölüm işaretleyen kullanıcı, önceki işaretlemenin sunucu turu
    // dönmeden sonrakine basıyor; kontrol `completed: false` görüp
    // "atladın mı?" diye soruyordu — hâlbuki az önce işaretlenmişti.
    const yamali = bolumleriIsaretle(prev[showId], season, [episode], iyimserDamga);
    if (!yamali) return prev;   // elde ilerleme yok — sunucu turunu bekle

    optimistikProgress = yamali;
    return { ...prev, [showId]: yamali };
  });

  // Damga Trakt'a ve Akış'a AYNI gönderilir (bkz. dosya başındaki not).
  const watchedAt = nowStamp();

  try {
    await ciftYaz(
      () => libraryApi.markEpisodeWatched(showId, season, episode, watchedAt),
      kaymak ? null : () => addEpisodeToHistory(showId, season, episode, watchedAt),
    );

    const meta = showMetaFor(showId);
    publishActivities([
      {
        activityType: 'watched_episode',
        showId,
        mediaType: 'show',
        showTitle: meta.title,
        tmdbId: meta.tmdbId,
        episodeNumber: formatEpisodeCode(season, episode),
        activityAt: watchedAt,
      },
    ]);

    // 🔄 T6.1 — İLERLEME ARTIK HER ZAMAN BİZDEN TAZELENİYOR.
    // Bu blok eskiden YALNIZCA Kaymak kullanıcısınındı; Trakt'lı kullanıcı
    // aşağıdaki `getShowProgress(showId)` yolundan geçiyordu — DİZİ BAŞINA
    // BİR TRAKT İSTEĞİ, planın §6.2'de Y28 diye yasakladığı desen ve
    // §D14'ün 57 isteğinin kaynağı. T6 kararıyla okuma yolu BİZ olduğumuz
    // için o kuyruk kaldırıldı.
    //
    // ⛔ TRAKT'A GERİ DÜŞÜŞ EKLENMEDİ — bilinçli. Geri düşüş tam da
    // öldürdüğümüz dizi-başına isteği geri getirirdi. `kaymakIlerlemeTazele`
    // zaten iki ucu da savunuyor: katalogda olmayan dizide mevcut ilerlemeyi
    // KORUYOR (ezmiyor), boş `seasons` yanıtında mağazayı BOZMUYOR.
    recordMutationResult('markEpisodeAsWatched', true);
    // 🔴 İYİMSER DEĞER ANINDA DÖNÜYOR, ağ TURU BEKLENMİYOR (M322).
    // İyimser durum M321'den beri EKSİKSİZ; beklemek yalnızca gecikme
    // ekliyordu ve dönen bayat yanıt ekranı geri düşürüyordu.
    // Tazeleme arkada, gecikmeli ve nesil korumalı çalışır.
    //
    // ⚠️ İyimser yama üretilemediyse (elde ilerleme yok — dizi ilk kez
    // açılıyor) BEKLEMEK ZORUNDAYIZ: aksi hâlde kullanıcıya boş ekran
    // döner. O ilk turda yarış da yok, çünkü ortada eski durum yok.
    const nesil = ilerlemeNesli.get(showId) ?? 0;
    const yerel = mevcutIlerleme(showId);
    if (!yerel) return await kaymakIlerlemeTazele(showId, nesil);
    tazelemeyiPlanla(showId);
    return yerel;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    logError('mutations.progress.markEpisodeAsWatched', error);
    recordMutationResult('markEpisodeAsWatched', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => ({ ...prev, [showId]: previousState }));
    }
    throw error;
  }
};

export const unwatchEpisode = async (showId: number, season: number, episode: number) => {
  let previousState: any = null;
  const kaymak = await kaymakYoluMu();
  // 🔴 NESLİ HEMEN ARTIR: bu andan itibaren uçuşta olan her tazeleme
  // BAYATTIR (bkz. yarış koruması notu). Yazma başarısız olsa bile artırmak
  // doğru — bayat bir yanıtı yazmaktansa bir tazelemeyi atlamak güvenli.
  nesliArtir(showId);

  console.log(`[OPTIMISTIC UI] Bölüm UI'da Kaldırılıyor: Show ${showId}, S${season}E${episode}`);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    // 🔴 EKSİKSİZ İYİMSER YAMA (M321) — bkz. `markEpisodeAsWatched`.
    // `seasons[].episodes[].completed` güncellenmezse "atlanan bölüm"
    // kontrolü ve yeşil tik sunucu turu dönene kadar YANLIŞ kalır.
    const yamali = bolumleriGeriAl(prev[showId], season, [episode]);
    if (!yamali) return prev;
    return { ...prev, [showId]: yamali };
  });

  try {
    console.log(`[API REQUEST] Trakt'tan Bölüm Siliniyor...`);
    await ciftYaz(
      () => libraryApi.unwatchEpisode(showId, season, episode),
      kaymak ? null : () => removeEpisodeFromHistoryTrakt(showId, season, episode),
    );
    console.log(`[API SUCCESS] Trakt üzerinden silindi. Gerçek veri çekiliyor...`);

    // Geri alınan bölüm akıştan da düşmeli — aksi halde kullanıcı "izlemedim"
    // dediği bir bölümü akışında görmeye devam ederdi. Yalnızca YEREL akış
    // temizlenir; Supabase'deki satırı bir sonraki tam senkron kendi geri
    // alma (retraction) mantığıyla siler (bkz. Worker handleFeedSync) —
    // aynı işi ikinci bir uç noktayla tekrarlamıyoruz.
    const removedCode = formatEpisodeCode(season, episode);
    retractLocalActivity(
      (a) =>
        a.activityType === 'watched_episode' &&
        a.showId === showId &&
        a.episodeNumber === removedCode
    );

    // 🔄 T6.1 — İLERLEME ARTIK HER ZAMAN BİZDEN TAZELENİYOR.
    // Bu blok eskiden YALNIZCA Kaymak kullanıcısınındı; Trakt'lı kullanıcı
    // aşağıdaki `getShowProgress(showId)` yolundan geçiyordu — DİZİ BAŞINA
    // BİR TRAKT İSTEĞİ, planın §6.2'de Y28 diye yasakladığı desen ve
    // §D14'ün 57 isteğinin kaynağı. T6 kararıyla okuma yolu BİZ olduğumuz
    // için o kuyruk kaldırıldı.
    //
    // ⛔ TRAKT'A GERİ DÜŞÜŞ EKLENMEDİ — bilinçli. Geri düşüş tam da
    // öldürdüğümüz dizi-başına isteği geri getirirdi. `kaymakIlerlemeTazele`
    // zaten iki ucu da savunuyor: katalogda olmayan dizide mevcut ilerlemeyi
    // KORUYOR (ezmiyor), boş `seasons` yanıtında mağazayı BOZMUYOR.
    recordMutationResult('unwatchEpisode', true);
    // 🔴 İYİMSER DEĞER ANINDA DÖNÜYOR, ağ TURU BEKLENMİYOR (M322).
    // İyimser durum M321'den beri EKSİKSİZ; beklemek yalnızca gecikme
    // ekliyordu ve dönen bayat yanıt ekranı geri düşürüyordu.
    // Tazeleme arkada, gecikmeli ve nesil korumalı çalışır.
    //
    // ⚠️ İyimser yama üretilemediyse (elde ilerleme yok — dizi ilk kez
    // açılıyor) BEKLEMEK ZORUNDAYIZ: aksi hâlde kullanıcıya boş ekran
    // döner. O ilk turda yarış da yok, çünkü ortada eski durum yok.
    const nesil = ilerlemeNesli.get(showId) ?? 0;
    const yerel = mevcutIlerleme(showId);
    if (!yerel) return await kaymakIlerlemeTazele(showId, nesil);
    tazelemeyiPlanla(showId);
    return yerel;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    logError('mutations.progress.unwatchEpisode', error);
    recordMutationResult('unwatchEpisode', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => {
        const updated = { ...prev, [showId]: previousState };
        persistShowProgressMap(updated);
        return updated;
      });
    }
    throw error;
  }
};

export const unwatchSeason = async (showId: number, season: number) => {
  let previousState: any = null;
  const kaymak = await kaymakYoluMu();
  // 🔴 NESLİ HEMEN ARTIR: bu andan itibaren uçuşta olan her tazeleme
  // BAYATTIR (bkz. yarış koruması notu). Yazma başarısız olsa bile artırmak
  // doğru — bayat bir yanıtı yazmaktansa bir tazelemeyi atlamak güvenli.
  nesliArtir(showId);

  console.log(`[OPTIMISTIC UI] Sezon UI'da Kaldırılıyor: Show ${showId}, S${season}`);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    // 🔴 EKSİKSİZ İYİMSER YAMA (M321) — bkz. `markEpisodeAsWatched`.
    // `seasons[].episodes[].completed` güncellenmezse "atlanan bölüm"
    // kontrolü ve yeşil tik sunucu turu dönene kadar YANLIŞ kalır.
    const yamali = bolumleriGeriAl(prev[showId], season, 'tumu');
    if (!yamali) return prev;
    return { ...prev, [showId]: yamali };
  });

  try {
    console.log(`[API REQUEST] Trakt'tan Sezon Siliniyor...`);
    await ciftYaz(
      () => libraryApi.unwatchSeason(showId, season),
      kaymak ? null : () => removeSeasonFromHistoryTrakt(showId, season),
    );
    console.log(`[API SUCCESS] Trakt üzerinden silindi. Gerçek veri çekiliyor...`);

    // Bkz. unwatchEpisode'daki aynı not — geri alınan sezonun TÜM bölümleri
    // yerel akıştan düşer ("S{season}E" önekiyle eşleşenler).
    const seasonPrefix = `S${String(season).padStart(2, '0')}E`;
    retractLocalActivity(
      (a) =>
        a.activityType === 'watched_episode' &&
        a.showId === showId &&
        !!a.episodeNumber?.startsWith(seasonPrefix)
    );

    // 🔄 T6.1 — İLERLEME ARTIK HER ZAMAN BİZDEN TAZELENİYOR.
    // Bu blok eskiden YALNIZCA Kaymak kullanıcısınındı; Trakt'lı kullanıcı
    // aşağıdaki `getShowProgress(showId)` yolundan geçiyordu — DİZİ BAŞINA
    // BİR TRAKT İSTEĞİ, planın §6.2'de Y28 diye yasakladığı desen ve
    // §D14'ün 57 isteğinin kaynağı. T6 kararıyla okuma yolu BİZ olduğumuz
    // için o kuyruk kaldırıldı.
    //
    // ⛔ TRAKT'A GERİ DÜŞÜŞ EKLENMEDİ — bilinçli. Geri düşüş tam da
    // öldürdüğümüz dizi-başına isteği geri getirirdi. `kaymakIlerlemeTazele`
    // zaten iki ucu da savunuyor: katalogda olmayan dizide mevcut ilerlemeyi
    // KORUYOR (ezmiyor), boş `seasons` yanıtında mağazayı BOZMUYOR.
    recordMutationResult('unwatchSeason', true);
    // 🔴 İYİMSER DEĞER ANINDA DÖNÜYOR, ağ TURU BEKLENMİYOR (M322).
    // İyimser durum M321'den beri EKSİKSİZ; beklemek yalnızca gecikme
    // ekliyordu ve dönen bayat yanıt ekranı geri düşürüyordu.
    // Tazeleme arkada, gecikmeli ve nesil korumalı çalışır.
    //
    // ⚠️ İyimser yama üretilemediyse (elde ilerleme yok — dizi ilk kez
    // açılıyor) BEKLEMEK ZORUNDAYIZ: aksi hâlde kullanıcıya boş ekran
    // döner. O ilk turda yarış da yok, çünkü ortada eski durum yok.
    const nesil = ilerlemeNesli.get(showId) ?? 0;
    const yerel = mevcutIlerleme(showId);
    if (!yerel) return await kaymakIlerlemeTazele(showId, nesil);
    tazelemeyiPlanla(showId);
    return yerel;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    logError('mutations.progress.unwatchSeason', error);
    recordMutationResult('unwatchSeason', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => {
        const updated = { ...prev, [showId]: previousState };
        persistShowProgressMap(updated);
        return updated;
      });
    }
    throw error;
  }
};

export const rewatchEpisode = async (showId: number, season: number, episode: number) => {
  return markEpisodeAsWatched(showId, season, episode);
};

export const markSeasonAsWatched = async (showId: number, season: number) => {
  let previousState: any = null;
  const kaymak = await kaymakYoluMu();
  // 🔴 NESLİ HEMEN ARTIR: bu andan itibaren uçuşta olan her tazeleme
  // BAYATTIR (bkz. yarış koruması notu). Yazma başarısız olsa bile artırmak
  // doğru — bayat bir yanıtı yazmaktansa bir tazelemeyi atlamak güvenli.
  nesliArtir(showId);
  console.log(`[OPTIMISTIC UI] Sezon UI'da işaretleniyor: Show ${showId}, S${season}`);
  reactivateShowTracking(showId);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    // 🔴 EKSİKSİZ İYİMSER YAMA (M321) — bkz. `markEpisodeAsWatched`.
    // `seasons[].episodes[].completed` güncellenmezse "atlanan bölüm"
    // kontrolü ve yeşil tik sunucu turu dönene kadar YANLIŞ kalır.
    const yamali = sezonuIsaretle(prev[showId], season, nowStamp());
    if (!yamali) return prev;
    return { ...prev, [showId]: yamali };
  });

  const watchedAt = nowStamp();

  try {
    console.log(`[API REQUEST] Trakt'a gönderiliyor (Sezon)...`);
    await ciftYaz(
      () => libraryApi.markSeasonWatched(showId, season, watchedAt),
      kaymak ? null : () => addSeasonToHistory(showId, season, watchedAt),
    );
    console.log(`[API SUCCESS] Trakt ile senkronize edildi. Gerçek veri çekiliyor...`);

    // 🔄 T6.1 — İLERLEME ARTIK HER ZAMAN BİZDEN TAZELENİYOR.
    // Bu blok eskiden YALNIZCA Kaymak kullanıcısınındı; Trakt'lı kullanıcı
    // aşağıdaki `getShowProgress(showId)` yolundan geçiyordu — DİZİ BAŞINA
    // BİR TRAKT İSTEĞİ, planın §6.2'de Y28 diye yasakladığı desen ve
    // §D14'ün 57 isteğinin kaynağı. T6 kararıyla okuma yolu BİZ olduğumuz
    // için o kuyruk kaldırıldı.
    //
    // ⛔ TRAKT'A GERİ DÜŞÜŞ EKLENMEDİ — bilinçli. Geri düşüş tam da
    // öldürdüğümüz dizi-başına isteği geri getirirdi. `kaymakIlerlemeTazele`
    // zaten iki ucu da savunuyor: katalogda olmayan dizide mevcut ilerlemeyi
    // KORUYOR (ezmiyor), boş `seasons` yanıtında mağazayı BOZMUYOR.
    recordMutationResult('markSeasonAsWatched', true);
    // 🔴 İYİMSER DEĞER ANINDA DÖNÜYOR, ağ TURU BEKLENMİYOR (M322).
    // İyimser durum M321'den beri EKSİKSİZ; beklemek yalnızca gecikme
    // ekliyordu ve dönen bayat yanıt ekranı geri düşürüyordu.
    // Tazeleme arkada, gecikmeli ve nesil korumalı çalışır.
    //
    // ⚠️ İyimser yama üretilemediyse (elde ilerleme yok — dizi ilk kez
    // açılıyor) BEKLEMEK ZORUNDAYIZ: aksi hâlde kullanıcıya boş ekran
    // döner. O ilk turda yarış da yok, çünkü ortada eski durum yok.
    const nesil = ilerlemeNesli.get(showId) ?? 0;
    const yerel = mevcutIlerleme(showId);
    if (!yerel) return await kaymakIlerlemeTazele(showId, nesil);
    tazelemeyiPlanla(showId);
    return yerel;
  } catch (error) {
    console.error(`[API ERROR] Sezon işaretleme başarısız, eski haline dönülüyor!`, error);
    logError('mutations.progress.markSeasonAsWatched', error);
    recordMutationResult('markSeasonAsWatched', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => ({ ...prev, [showId]: previousState }));
    }
    throw error;
  }
};

// Trakt'ın /sync/history uç noktası her POST'ta yeni bir "izlenme" (play) ekler
// — aynı sezonu ikinci kez göndermek, önce geçmişi silmeden doğrudan "tekrar
// izlendi" anlamına gelir. Bu yüzden markSeasonAsWatched'ın aynısı, sadece
// niyeti (ve ayrı optimistic UI mesajını) netleştirmek için ayrı isimle.
export const rewatchSeason = async (showId: number, season: number) => {
  return markSeasonAsWatched(showId, season);
};

export const markEpisodesUpToAsWatched = async (showId: number, season: number, episodes: number[]) => {
  let previousState: any = null;
  const kaymak = await kaymakYoluMu();
  // 🔴 NESLİ HEMEN ARTIR: bu andan itibaren uçuşta olan her tazeleme
  // BAYATTIR (bkz. yarış koruması notu). Yazma başarısız olsa bile artırmak
  // doğru — bayat bir yanıtı yazmaktansa bir tazelemeyi atlamak güvenli.
  nesliArtir(showId);
  console.log(`[OPTIMISTIC UI] Bölümler toplu UI'da işaretleniyor: Show ${showId}, S${season}`);
  reactivateShowTracking(showId);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    // 🔴 EKSİKSİZ İYİMSER YAMA (M321) — bkz. `markEpisodeAsWatched`.
    // `seasons[].episodes[].completed` güncellenmezse "atlanan bölüm"
    // kontrolü ve yeşil tik sunucu turu dönene kadar YANLIŞ kalır.
    const yamali = bolumleriIsaretle(prev[showId], season, episodes, nowStamp());
    if (!yamali) return prev;
    return { ...prev, [showId]: yamali };
  });

  const watchedAt = nowStamp();

  try {
    console.log(`[API REQUEST] Trakt'a gönderiliyor (Toplu Bölüm)...`);
    await ciftYaz(
      () => libraryApi.markEpisodesWatched(showId, season, episodes, watchedAt),
      kaymak ? null : () => addEpisodesBulkToHistory(showId, season, episodes, watchedAt),
    );
    console.log(`[API SUCCESS] Trakt ile senkronize edildi. Gerçek veri çekiliyor...`);

    const meta = showMetaFor(showId);
    publishActivities(
      episodes.map((num) => ({
        activityType: 'watched_episode' as const,
        showId,
        mediaType: 'show' as const,
        showTitle: meta.title,
        tmdbId: meta.tmdbId,
        episodeNumber: formatEpisodeCode(season, num),
        activityAt: watchedAt,
      }))
    );

    // 🔄 T6.1 — İLERLEME ARTIK HER ZAMAN BİZDEN TAZELENİYOR.
    // Bu blok eskiden YALNIZCA Kaymak kullanıcısınındı; Trakt'lı kullanıcı
    // aşağıdaki `getShowProgress(showId)` yolundan geçiyordu — DİZİ BAŞINA
    // BİR TRAKT İSTEĞİ, planın §6.2'de Y28 diye yasakladığı desen ve
    // §D14'ün 57 isteğinin kaynağı. T6 kararıyla okuma yolu BİZ olduğumuz
    // için o kuyruk kaldırıldı.
    //
    // ⛔ TRAKT'A GERİ DÜŞÜŞ EKLENMEDİ — bilinçli. Geri düşüş tam da
    // öldürdüğümüz dizi-başına isteği geri getirirdi. `kaymakIlerlemeTazele`
    // zaten iki ucu da savunuyor: katalogda olmayan dizide mevcut ilerlemeyi
    // KORUYOR (ezmiyor), boş `seasons` yanıtında mağazayı BOZMUYOR.
    recordMutationResult('markEpisodesUpToAsWatched', true);
    // 🔴 İYİMSER DEĞER ANINDA DÖNÜYOR, ağ TURU BEKLENMİYOR (M322).
    // İyimser durum M321'den beri EKSİKSİZ; beklemek yalnızca gecikme
    // ekliyordu ve dönen bayat yanıt ekranı geri düşürüyordu.
    // Tazeleme arkada, gecikmeli ve nesil korumalı çalışır.
    //
    // ⚠️ İyimser yama üretilemediyse (elde ilerleme yok — dizi ilk kez
    // açılıyor) BEKLEMEK ZORUNDAYIZ: aksi hâlde kullanıcıya boş ekran
    // döner. O ilk turda yarış da yok, çünkü ortada eski durum yok.
    const nesil = ilerlemeNesli.get(showId) ?? 0;
    const yerel = mevcutIlerleme(showId);
    if (!yerel) return await kaymakIlerlemeTazele(showId, nesil);
    tazelemeyiPlanla(showId);
    return yerel;
  } catch (error) {
    console.error(`[API ERROR] Toplu bölüm işaretleme başarısız, eski haline dönülüyor!`, error);
    logError('mutations.progress.markEpisodesUpToAsWatched', error);
    recordMutationResult('markEpisodesUpToAsWatched', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => ({ ...prev, [showId]: previousState }));
    }
    throw error;
  }
};

/**
 * @param mediaData 🆕 M417 — filmin kendisi (çağıran ekranın elindeki Trakt
 *   nesnesi). Film İZLEME LİSTESİNDE DEĞİLKEN iyimser girdi ancak bununla
 *   kurulabiliyor; verilmezse eski davranış (ekran sunucu senkronunu bekler).
 */
export const markMovieAsWatched = async (movieId: number, mediaData?: any) => {
  let previousWatchlist: any = null;
  let previousWatched: any = null;
  let movieItemToMove: any = null;

  console.log(`[OPTIMISTIC UI] Film UI'da anında işaretleniyor: Movie ${movieId}`);

  // Kullanıcı "Bırak" ile gizlediği bir filmi sonradan izlediyse artık
  // Gizlenenler/Bırakılanlar'da görünmemeli. Gizlenmiş olmak en yüksek
  // öncelikli kova olduğu için (bkz. movieTrackingLogic), geçmişe eklenmesi
  // tek başına bunu geçersiz kılmaz — gizlemeyi açıkça kaldırmak gerekir.
  // Dizilerdeki `reactivateShowTracking` kuralının film karşılığı.
  unhideMovieIfNeeded(movieId);

  setWatchlistMovies((prev: any) => {
    previousWatchlist = prev;
    const item = prev.find((p: any) => p.movie.ids.trakt === movieId);
    if (item) {
      movieItemToMove = item;
      const newWatchlist = prev.filter((p: any) => p.movie.ids.trakt !== movieId);
      safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(newWatchlist));
      return newWatchlist;
    }
    return prev;
  });

  setWatchedMovies((prev: any) => {
    previousWatched = prev;
    // 🔴 M417: eskiden girdi YALNIZCA `movieItemToMove` (izleme listesinden
    // taşınan film) varken ekleniyordu → listede olmayan film işaretlenince
    // ekran hiç değişmiyordu. Karar ve gerekçe: `optimistikFilm.ts`.
    const newWatched = izlenenFilmeEkle(prev, movieId, movieItemToMove?.movie || mediaData);
    if (newWatched !== prev) {
      safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(newWatched));
      return newWatched;
    }
    return prev;
  });

  const watchedAt = nowStamp();

  try {
    const kaymakFilm = await kaymakYoluMu();
    await ciftYaz(
      () => libraryApi.markMovieWatched(movieId, watchedAt),
      kaymakFilm ? null : () => addMovieToHistory(movieId, watchedAt),
    );

    // Film izlemeleri artık Akış'ta görünüyor (yeni `watched_movie` tipi) —
    // eskiden akış YALNIZCA bölüm izlemelerini ve puanlamaları taşıyordu,
    // bir filmi izlediğini işaretlemek hiçbir yerde görünmüyordu.
    const movie = movieItemToMove?.movie
      || (useLibraryStore.getState().watchedMovies || []).find((m: any) => m?.movie?.ids?.trakt === movieId)?.movie;
    if (movie?.title) {
      publishActivities([
        {
          activityType: 'watched_movie',
          showId: movieId,
          mediaType: 'movie',
          showTitle: movie.title,
          tmdbId: movie?.ids?.tmdb,
          activityAt: watchedAt,
        },
      ]);
    }

    recordMutationResult('markMovieAsWatched', true);
  } catch (error) {
    console.error(`[API ERROR] Film işaretleme başarısız, eski haline dönülüyor!`, error);
    logError('mutations.progress.markMovieAsWatched', error);
    recordMutationResult('markMovieAsWatched', false);
    if (previousWatchlist !== null) {
      setWatchlistMovies(previousWatchlist);
      safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(previousWatchlist));
    }
    if (previousWatched !== null) {
      setWatchedMovies(previousWatched);
      safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(previousWatched));
    }
    throw error;
  }
};

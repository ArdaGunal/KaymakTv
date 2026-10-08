// M439: eski ortak durum/yarış koruması buraya taşındı; tek kaynak.
import * as libraryApi from '../../api/library';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { toggleHiddenFromProgress } from './collections';
import { CACHE_KEYS, safeStorageSet, setWatchedShows, setWatchlistShows, setShowProgressMap, persistShowProgressMap } from '../utils';
import { izlenenDiziyeEkle, izlemeListesindenDus } from './optimistikDizi';
import { resolveMediaMeta } from '../mediaMeta';
import { logError } from '../../../utils/errorLog';

/** Yayın için gereken meta (başlık + poster id) — bkz. services/library/mediaMeta.ts */
export const showMetaFor = (showId: number) => resolveMediaMeta(showId, 'show');

// Kullanıcı "Bırak" ile Trakt'ta gizlediği bir diziyi/filmi sonradan yeniden
// izlemeye başlarsa gizleme otomatik kaldırılır — aksi halde dizi/film Trakt'ın
// gizlenen listesinde takılı kalır ve ana vitrin listelerine asla geri dönmez.
//
// Gizleme kaldırma mantığı BİLİNÇLİ OLARAK burada tekrar YAZILMAZ:
// `toggleHiddenFromProgress` disk ACK + kalıcı kuyruk + senkron projection
// içeriyor. Ağ hatasında niyet korunur; disk hatasında başarı gösterilmez.
//
// Çağrı ateşle-ve-unut: kullanıcının "izledim" akışını bloklamamalı, bu yüzden
// `await` edilmez; disk hatası runtime'da görünür bant + logError üretir.
const unhideShowIfNeeded = (showId: number) => {
  if (!useLibraryStore.getState().hiddenShowIds.includes(showId)) return;
  toggleHiddenFromProgress(showId, 'show', true).catch((e) =>
    console.error('Otomatik gizleme kaldırma (show) hatası:', e)
  );
};

export const unhideMovieIfNeeded = (movieId: number) => {
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
export const reactivateShowTracking = (showId: number, mediaData?: any) => {
  unhideShowIfNeeded(showId);

  // 🔴 M421 — İZLEME LİSTESİNDEN DÜŞÜR (ürün kararı, kullanıcı 2026-09-20:
  // "Diziler, ilk bölüm izlendiği an İzleme Listesinden düşmeli"). Filmde bu
  // davranış zaten vardı. Düşen girdi aynı zamanda `watchedShows`'a
  // ekleyeceğimiz dizi nesnesinin en güvenilir kaynağı.
  let listedenDusen: any = null;
  setWatchlistShows((prev: any[]) => {
    const { liste, dusen } = izlemeListesindenDus(prev, showId);
    if (!dusen) return prev;
    listedenDusen = dusen;
    safeStorageSet(CACHE_KEYS.watchlistShows, JSON.stringify(liste));
    return liste;
  });

  setWatchedShows((prev: any[]) => {
    const idx = (prev || []).findIndex((item: any) => item?.show?.ids?.trakt === showId);
    if (idx !== -1) {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], last_watched_at: new Date().toISOString() };
      safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(updated));
      return updated;
    }
    // 🔴 M421 (denetim B) — DİZİ LİSTEDE YOKSA EKLE. Eski hâl `return prev`
    // diyordu: ilk kez işaretlenen dizi "izlenenler"e hiç girmiyor, dizi
    // seviyesi durum/sekme/rozet tam senkrona kadar yanlış kalıyordu.
    const dizi = listedenDusen?.show || mediaData || null;
    const eklenmis = izlenenDiziyeEkle(prev, showId, dizi);
    if (eklenmis === prev) return prev;
    safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(eklenmis));
    return eklenmis;
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
export const kaymakYoluMu = () => libraryApi.kaymakKullanicisiMi();

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
export const ciftYaz = async (
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
    // 🔴 M419 (bağımsız denetim): tek iz `console.warn`'du ve bu dosyanın
    // kendi kuralı «tek kalıcı iz `logError`» diyor. Trakt'a hiç ulaşmayan
    // işaretlemenin cihazda gözlemlenebilir bir izi kalmıyordu.
    logError('mutations.progress.ciftYaz', error);
  }
};

/** Mağazadaki mevcut ilerleme — tazeleme başarısız olursa geri düşülür. */
export const mevcutIlerleme = (showId: number) =>
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
export const ilerlemeNesli = new Map<number, number>();
const bekleyenTazeleme = new Map<number, ReturnType<typeof setTimeout>>();

/** Kullanıcı arka arkaya basarken tazelemeleri birleştirme penceresi. */
const TAZELEME_GECIKMESI_MS = 700;

/** Mark artık outbox'ın TEK tam okumasını kullanır; eski undo zamanlayıcısı yarışmasın. */
export const cancelProgressRefresh = (showId: number) => {
  const timer = bekleyenTazeleme.get(showId);
  if (timer) clearTimeout(timer);
  bekleyenTazeleme.delete(showId);
};

/** Bir mutasyon başladı — bu diziye ait uçuştaki tazelemeler bayatladı. */
export const nesliArtir = (showId: number) => {
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
export const tazelemeyiPlanla = (showId: number) => {
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

/**
 * 🔴 M419 (bağımsız denetim) — GERİ ALMA DA NESİL KORUMALI.
 * `previousState` mutasyonun BAŞINDA çekilmiş fotoğraf. Eski hâl onu
 * koşulsuz yazıyordu: E5 asılı kalıp 15 sn sonra düşerse, arada BAŞARILI
 * olan E6'nın işareti de ekrandan siliniyordu. Üstelik geri alma diske
 * YAZILMIYORDU (mağaza ile önbellek ıraksıyordu) ve yeni bir tazeleme de
 * planlanmıyordu, yani ekran uygulama yeniden açılana kadar yanlış kalıyordu.
 *
 * Nesil değiştiyse (araya yeni bir mutasyon girdiyse) geri alma YAPILMAZ;
 * doğruyu sunucudan getirmek üzere tazeleme planlanır.
 */
export const geriAlVeyaTazele = (showId: number, nesilBaslangic: number, previousState: any) => {
  if ((ilerlemeNesli.get(showId) ?? 0) !== nesilBaslangic) {
    tazelemeyiPlanla(showId);
    return;
  }
  // ⚠️ `undefined` de yazılmamalı: dizinin ilk işaretlemesinde `prev[showId]`
  // yoktur ve haritaya açık `undefined` koymak sayım/gezinti yapan kodlar
  // için gizli bir tuzaktır.
  if (previousState === null || previousState === undefined) return;
  setShowProgressMap((prev: any) => {
    const guncel = { ...prev, [showId]: previousState };
    persistShowProgressMap(guncel);
    return guncel;
  });
};

export const kaymakIlerlemeTazele = async (showId: number, beklenenNesil?: number) => {
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



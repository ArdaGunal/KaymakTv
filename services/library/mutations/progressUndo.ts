// M439: geri alma davranışı korundu; önce kalıcı ekleme kuyruğu tamamlanır.
import { removeEpisodeFromHistoryTrakt, removeSeasonFromHistoryTrakt } from '../../traktApi';
import * as libraryApi from '../../api/library';
import { bolumleriGeriAl } from './optimistikIlerleme';
import { setShowProgressMap } from '../utils';
import { formatEpisodeCode, retractLocalActivity } from '../../../features/feed/services/feedPublish';
import { recordMutationResult } from '../../../utils/metrics';
import { logError } from '../../../utils/errorLog';
import { flushWatchedOutbox } from '../outbox/runtime';
import { kaymakYoluMu, ciftYaz, nesliArtir, ilerlemeNesli, mevcutIlerleme, kaymakIlerlemeTazele, tazelemeyiPlanla, geriAlVeyaTazele } from './progressState';

export const unwatchEpisode = async (showId: number, season: number, episode: number) => {
  await flushWatchedOutbox();
  let previousState: any = null;
  const kaymak = await kaymakYoluMu();
  // 🔴 NESLİ HEMEN ARTIR: bu andan itibaren uçuşta olan her tazeleme
  // BAYATTIR (bkz. yarış koruması notu). Yazma başarısız olsa bile artırmak
  // doğru — bayat bir yanıtı yazmaktansa bir tazelemeyi atlamak güvenli.
  const nesilBaslangic = nesliArtir(showId);

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
    geriAlVeyaTazele(showId, nesilBaslangic, previousState);
    throw error;
  }
};

export const unwatchSeason = async (showId: number, season: number) => {
  await flushWatchedOutbox();
  let previousState: any = null;
  const kaymak = await kaymakYoluMu();
  // 🔴 NESLİ HEMEN ARTIR: bu andan itibaren uçuşta olan her tazeleme
  // BAYATTIR (bkz. yarış koruması notu). Yazma başarısız olsa bile artırmak
  // doğru — bayat bir yanıtı yazmaktansa bir tazelemeyi atlamak güvenli.
  const nesilBaslangic = nesliArtir(showId);

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
    geriAlVeyaTazele(showId, nesilBaslangic, previousState);
    throw error;
  }
};



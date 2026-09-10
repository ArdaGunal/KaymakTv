import axios from 'axios';
// 🔴 `expo-secure-store` DEĞİL, PLATFORM FARKINDA SARMALAYICI (2026-09-10).
// Web'de yerel bir anahtarlık yok; ham SecureStore orada FIRLATIYOR. Bu dosya
// havuzdaki 13 token okuyucudan (`social.ts`, `traktClient.ts`, `feedPublish.ts`
// …) sapan İKİ dosyadan biriydi ve sapma sessizdi: aşağıdaki
// `kaymakKullanicisiMi` her web isteğinde `catch`'e düşüp `false` dönüyordu —
// yani Google-only kullanıcının TÜM kütüphane yazmaları Trakt'a yönleniyor ve
// 401 alıyordu. Web'e Faz T kodu hiç dağıtılmadığı için turlarca görünmedi.
import * as SecureStore from '../../utils/secureStorage';

import { isKaymakSessionToken } from './traktClient';

/**
 * KÜTÜPHANE API'si — Worker'ın `/library/*` uçlarının istemci tarafı.
 * Faz T · T1. Hedef tablolar `supabase/schema/037_user_data.sql`.
 *
 * ==========================================================================
 * 🎯 BU DOSYA BİR ADAPTÖRÜN YARISIDIR
 * ==========================================================================
 * Diğer yarısı `services/library/mutations/progress.ts` ve
 * `collections.ts` içinde: oradaki fonksiyonlar kullanıcının token tipine
 * bakıp isteği ya Trakt'a ya BURAYA yönlendiriyor.
 *
 * 🔴 ADAPTÖRÜN KAPSAMI — buradan oku, tahmin etme (2026-09-07):
 *   ✅ `progress.ts` — izleme yazmaları
 *   ✅ `collections.ts` — izleme listesi · favori · gizleme · geçmiş silme
 *      (dizi dalı `unwatchShow` → `delete_watched_subtree`, migration 038)
 *   ✅ `fetchers.ts` → `kaymakSync.ts` — OKUMA. `POST /library/sync`:
 *      · izleme + ilerleme (katalogdan hesaplanıyor; 039'un `first_aired`'ı
 *        olmadan `aired` yanlış olurdu)
 *      · **puanlar · izleme listesi · favoriler · gizlenenler** (2026-09-08)
 *   ❌ ÖZEL LİSTELER — Worker'da liste ailesi, DB'de `user_lists` YOK.
 *      Kapsam sürünmesini önlemek için ertelendi (`BACKLOG` §D8);
 *      UI'da gizli (`useKaymakYetenekleri`), serviste `listeKapisi` fırlatır
 *   ❌ `state` (bırakıldı) — istemcide ne yazılıyor ne okunuyor; "Bırak"
 *      eylemi `hidden`'a bağlı (`useTrackingStore`'un kendi notu)
 *
 * ⚠️ HÂLÂ TRAKT'TAN OKUNAN: takvim ("Yaklaşanlar") ve kullanıcı
 * istatistikleri. Kaymak kullanıcısında bunlar BOŞ gelir.
 *
 * 🔴 UI HİÇBİR ŞEYİN DEĞİŞTİĞİNİ BİLMEZ (kullanıcı kararı, 2026-09-07).
 * Bileşenler hâlâ `markEpisodeAsWatched(showId, season, episode)` çağırıyor;
 * yönlendirme adaptörün içinde, çağrı yerlerinde DEĞİL.
 *
 * ==========================================================================
 * 🔑 NEDEN TRAKT KİMLİKLERİ GÖNDERİYORUZ, `kaymak_id` DEĞİL
 * ==========================================================================
 * İstemcinin elinde `kaymak_id` YOK — yıllardır Trakt id'leriyle çalışıyor.
 * Çeviriyi Worker yapıyor (`lib/catalog.js` → `resolveTraktLocator`):
 * `trakt:show <id>` → dizi, sonra `parent_id`+`season_number` → sezon,
 * sonra `parent_id`+`episode_number` → bölüm.
 *
 * ⚡ Bir sezonun 20 bölümü de sorulsa Worker tarafında **3 istek** eder;
 * bölüm başına sorgu, plan §6.2'nin (Y28) yasakladığı desendir. Bu yüzden
 * `markEpisodesWatched` bir DİZİ alıyor — döngü içinde tek tek çağırma.
 */

const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

/** Worker'ın `AILELER` haritasıyla AYNI olmak zorunda. */
export type LibraryAilesi =
  | 'watched'
  | 'rating'
  | 'watchlist'
  | 'favorite'
  | 'hidden'
  | 'state';

/** Trakt konumu — Worker bunu `kaymak_id`'ye çevirir. */
export type TraktKonumu =
  | { movieId: number }
  | { showId: number }
  | { showId: number; season: number }
  | { showId: number; season: number; episode: number }
  | { showId: number; season: number; episodes: number[] }
  /** `"*"` = sezonun TÜM bölümleri — listeyi katalog biliyor. */
  | { showId: number; season: number; episodes: "*" };

export type LibraryYanit = {
  success: boolean;
  /** `'katalogda_yok'` → kapsam boşluğu, kullanıcı hatası DEĞİL. */
  code?: string;
  message?: string;
  yazilan?: number;
  /** Alt ağaç silmede kaç satır gitti (bkz. `unwatchShow`). */
  silinen?: number;
  /** Kısmen çözülemeyen konum (ör. sezonun bir bölümü katalogda yok). */
  eksik?: string;
};

/**
 * 🔴 BU KULLANICI BİZİM SİSTEMİMİZE Mİ YAZMALI?
 *
 * Ayrım token tipinde: Google-only kullanıcının `accessToken`'ı Trakt
 * token'ı DEĞİL, `kaymak_session_v1.` önekli bir Worker oturum token'ıdır
 * (bkz. `traktClient.ts` → `isKaymakSessionToken`, plan §5.8).
 *
 * ⚠️ Trakt'lı kullanıcı bugün HÂLÂ Trakt'a yazıyor — T5 (içe aktarım) ve
 * T6 (geri yazma kararı) bitene kadar bu bilinçli. Yani bu fonksiyon
 * "Faz T yolunu kullan mı?" sorusunun cevabıdır, "giriş yapmış mı?" değil.
 */
export const kaymakKullanicisiMi = async (): Promise<boolean> => {
  try {
    const token = await SecureStore.getItemAsync('traktAccessToken');
    return isKaymakSessionToken(token);
  } catch {
    // SecureStore okunamıyorsa GÜVENLİ TARAF Trakt yoludur: bilinmeyen bir
    // durumda kullanıcının verisini bizim sisteme yazmak, iki yerde yarım
    // geçmiş bırakırdı.
    return false;
  }
};

const istek = async (
  aile: LibraryAilesi,
  govde: Record<string, unknown>,
): Promise<LibraryYanit> => {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');

  // 🔴 `user_id` GÖNDERİLMİYOR — Worker onu TOKEN'DAN çözüyor (plan §5.3).
  // Buraya bir `userId` alanı eklemek klasik mass-assignment açığı olurdu.
  const token = await SecureStore.getItemAsync('traktAccessToken');

  try {
    const res = await axios.post(
      `${KAYMAK_WORKER_URL}/library/${aile}`,
      { ...govde, traktAccessToken: token },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
    );
    return res.data as LibraryYanit;
  } catch (error: any) {
    // Worker hata durumlarında da JSON gövde döner; axios 4xx/5xx'i
    // exception'a çeviriyor ama gövde `error.response.data`'da duruyor
    // (googleAuth.ts ile aynı desen).
    const govdeHata = error?.response?.data;
    if (govdeHata) {
      // ⚠️ `katalogda_yok` (409) ÇAĞIRANA AYNEN GEÇİYOR, yutulmuyor.
      // Bu kullanıcı hatası değil KAPSAM boşluğu (plan §6.5): arşivimizde
      // olmayan bir yapım. T5'in eksikler kuyruğu buraya bağlanacak.
      const e: any = new Error(govdeHata.message || 'Kütüphane isteği başarısız.');
      e.libraryCode = govdeHata.code;
      e.libraryEksik = govdeHata.eksik;
      e.status = error?.response?.status;
      throw e;
    }
    throw error;
  }
};

// ── İzleme ────────────────────────────────────────────────────────────────

/** Tek bölüm. `watchedAt` verilmezse sunucu şimdiyi kullanır. */
export const markEpisodeWatched = (
  showId: number, season: number, episode: number, watchedAt?: string,
) => istek('watched', { op: 'ekle', trakt: { showId, season, episode }, watchedAt });

/**
 * Aynı sezondan ÇOK bölüm — TEK istek.
 * ⚡ Döngü içinde `markEpisodeWatched` çağırmak yerine bunu kullan.
 */
export const markEpisodesWatched = (
  showId: number, season: number, episodes: number[], watchedAt?: string,
) => istek('watched', { op: 'ekle', trakt: { showId, season, episodes }, watchedAt });

/**
 * Sezonun TAMAMI. `episodes: "*"` Worker tarafinda "bu sezonun tum
 * bolumleri" demek — bolum listesini ne istemci ne cagiran biliyor, katalog
 * biliyor. Yine TEK istek.
 */
export const markSeasonWatched = (showId: number, season: number, watchedAt?: string) =>
  istek('watched', { op: 'ekle', trakt: { showId, season, episodes: '*' }, watchedAt });

export const unwatchSeason = (showId: number, season: number) =>
  istek('watched', { op: 'sil', trakt: { showId, season, episodes: '*' }, tumu: true });

export const markMovieWatched = (movieId: number, watchedAt?: string) =>
  istek('watched', { op: 'ekle', trakt: { movieId }, watchedAt });

/**
 * İzleme kaydını kaldırır.
 *
 * 🔴 `tumu: true` ŞART — Worker `watchedAt` ya da `tumu` istiyor. Aksi hâlde
 * "bu izlemeyi sil" isteği sessizce TÜM geçmişi silerdi. UI'daki "izlemedim"
 * eylemi zaten "hepsini kaldır" demek.
 */
export const unwatchEpisode = (showId: number, season: number, episode: number) =>
  istek('watched', { op: 'sil', trakt: { showId, season, episode }, tumu: true });

export const unwatchEpisodes = (showId: number, season: number, episodes: number[]) =>
  istek('watched', { op: 'sil', trakt: { showId, season, episodes }, tumu: true });

export const unwatchMovie = (movieId: number) =>
  istek('watched', { op: 'sil', trakt: { movieId }, tumu: true });

/**
 * "Bu diziyi hiç izlemedim" — TÜM bölümlerinin izleme kaydını siler.
 *
 * 🔴 SUNUCUDA ÖZEL YOL VAR, DÜZ SİLME DEĞİL. `user_watched` satırları BÖLÜM
 * kimliğinde durur; `{ showId }` ise DİZİ kimliğine çözülür. Worker bunu
 * fark edip `delete_watched_subtree`'ye (migration 038) yönlendiriyor —
 * tek istek, tek işlem. Bu ayrım olmadan istek 200 döner ve SIFIR satır
 * silerdi; ilk turda tam olarak bu oluyordu.
 *
 * Yanıtta `silinen` (satır sayısı) gelir. Sıfır bir hata DEĞİLDİR
 * ("zaten izlememiştim") ama çağıran ayırt edebilsin diye taşınıyor.
 */
export const unwatchShow = (showId: number) =>
  istek('watched', { op: 'sil', trakt: { showId }, tumu: true });

// ── Puan ──────────────────────────────────────────────────────────────────
//
// 🔴🔴 ÖLÇEK SÖZLEŞMESİ — BURADAN GEÇEN HER SAYI 1-10'DUR
// ==========================================================================
// UI **5 YILDIZ** gösteriyor ama dahili ölçek **1-10** (Trakt'la aynı):
//   `StarSlider` `width / 10` adımla çalışır; tam yıldızda
//   `Math.ceil(discrete / 2) * 2` ile ÇİFT sayıya oturur.
//     5 yıldız → 10 · 4 yıldız → 8 · 4,5 yıldız → 9 (TEK sayı)
//   Geri okurken `utils/formatRating.ts` İKİYE BÖLER.
//
// ⚠️ İKİYLE ÇARPMA. `StarSlider` zaten 1-10 döndürüyor; çağrı yerlerindeki
// "tekrar ×2 yapılmamalı" notları bu yüzden var (geçmişte yaşanmış hata).
//
// 🔴 GELECEKTEKİ "KENDİ ORTALAMAMIZ" İŞİNE NOT (`BACKLOG` §D11): ham
// `AVG(rating)` **10 üzerinden** gelir. Gösterime çevirmeden ikiye bölünmezse
// kullanıcı "10/10" görür — sessiz ve utandırıcı bir hata.

export const rateShow = (showId: number, rating: number) =>
  istek('rating', { op: 'ekle', trakt: { showId }, rating, ratedType: 'show' });

export const rateMovie = (movieId: number, rating: number) =>
  istek('rating', { op: 'ekle', trakt: { movieId }, rating, ratedType: 'movie' });

export const rateEpisode = (showId: number, season: number, episode: number, rating: number) =>
  istek('rating', { op: 'ekle', trakt: { showId, season, episode }, rating, ratedType: 'episode' });

export const unrateShow = (showId: number) =>
  istek('rating', { op: 'sil', trakt: { showId } });

export const unrateMovie = (movieId: number) =>
  istek('rating', { op: 'sil', trakt: { movieId } });

export const unrateEpisode = (showId: number, season: number, episode: number) =>
  istek('rating', { op: 'sil', trakt: { showId, season, episode } });

/**
 * Bölüm puanı — YALNIZCA bölüm Trakt kimliğiyle.
 *
 * 🔑 NEDEN AYRI: puanlama ekranları (`useShowDetailHandlers.handleRateEpisode`)
 * yalnızca `episodeTraktId` taşıyor; sezon/bölüm numarası ellerinde YOK ve o
 * kimlikten TÜRETİLEMEZ. Çağrı yerlerini imza değiştirmeye zorlamak yerine
 * Worker çözüyor (`resolveTraktLocator` → `{ episodeId }`), ayna
 * `trakt:episode` eşlemesini zaten taşıyor.
 */
export const rateEpisodeById = (episodeId: number, rating: number) =>
  istek('rating', { op: 'ekle', trakt: { episodeId }, rating, ratedType: 'episode' });

export const unrateEpisodeById = (episodeId: number) =>
  istek('rating', { op: 'sil', trakt: { episodeId } });

// ── Listeler ──────────────────────────────────────────────────────────────

export const addToWatchlist = (konum: TraktKonumu) =>
  istek('watchlist', { op: 'ekle', trakt: konum });

export const removeFromWatchlist = (konum: TraktKonumu) =>
  istek('watchlist', { op: 'sil', trakt: konum });

export const addToFavorites = (konum: TraktKonumu) =>
  istek('favorite', { op: 'ekle', trakt: konum });

export const removeFromFavorites = (konum: TraktKonumu) =>
  istek('favorite', { op: 'sil', trakt: konum });

/**
 * 🔴 GİZLEME SANILANDAN KRİTİK (plan §6.3): `hiddenShowIds` yalnızca
 * kütüphaneyi değil, `mapCalendar.ts` üzerinden BİLDİRİMLERİ de süzüyor.
 * Burada bir kayıp, kullanıcının gizlediği dizi için bildirim almasına
 * yol açar — sinsi ve geç fark edilir.
 */
export const hideShow = (showId: number) =>
  istek('hidden', { op: 'ekle', trakt: { showId } });

export const unhideShow = (showId: number) =>
  istek('hidden', { op: 'sil', trakt: { showId } });

/**
 * ⚠️ FİLM DE GİZLENEBİLİR. Worker'ın `hidden` ailesi jenerik
 * (`basitAile("user_hidden", …)` — yalnızca `kaymak_id` görür), ama bu
 * dosyanın ilk turunda yalnızca dizi sarmalayıcısı yazılmıştı.
 * `toggleHiddenFromProgress` iki tipi de kabul ediyor; film dalı olmadan
 * adaptör yarım kalırdı.
 */
export const hideMovie = (movieId: number) =>
  istek('hidden', { op: 'ekle', trakt: { movieId } });

export const unhideMovie = (movieId: number) =>
  istek('hidden', { op: 'sil', trakt: { movieId } });

// ── Durum ─────────────────────────────────────────────────────────────────

/**
 * 🆕 "Bırakıldı" — Trakt'ta KARŞILIĞI YOK, bağımsızlığın ilk somut kazancı.
 *
 * ⚠️ Yalnızca TÜRETİLEMEZ durum buraya yazılır. `upNext`/`paused`/
 * `caughtUp` izleme geçmişinden hesaplanıyor (`useLibraryFilters.ts`);
 * onları buraya yazmak ikinci bir gerçek kaynağı yaratırdı — Worker ve
 * `037`'nin CHECK'i de reddeder.
 */
export const setShowDropped = (showId: number) =>
  istek('state', { op: 'ekle', trakt: { showId }, state: 'dropped' });

export const clearShowState = (showId: number) =>
  istek('state', { op: 'sil', trakt: { showId } });

// ── Okuma ─────────────────────────────────────────────────────────────────

/** `POST /library/sync`'in dönüşü. Şekil Trakt'ınkiyle hizalı (bkz. aşağı). */
export type KutuphaneIlerlemesi = {
  aired: number;
  completed: number;
  last_watched_at: string | null;
  seasons: Array<{
    number: number;
    aired: number;
    completed: number;
    episodes: Array<{
      number: number;
      completed: boolean;
      last_watched_at: string | null;
      title: string | null;
      first_aired: string | null;
    }>;
  }>;
  next_episode: { season: number; number: number; title: string | null } | null;
  last_episode: { season: number; number: number; title: string | null } | null;
};

export type KutuphaneYaniti = {
  success: boolean;
  diziler: Array<{
    traktId: number;
    title: string | null;
    year: number | null;
    tmdbId: number | null;
    ilerleme: KutuphaneIlerlemesi;
  }>;
  filmler: Array<{
    traktId: number;
    title: string | null;
    year: number | null;
    tmdbId: number | null;
    last_watched_at: string | null;
    plays: number;
  }>;
  /** `true` → yanıt EKSİK olabilir (sunucu tavanı aşıldı). Sessiz kırpma yok. */
  kirpildi: boolean;

  // ── Dört koleksiyon ailesi (T1 okuma, 2026-09-08) ─────────────────────
  // 🔴 ŞEKİL İSTEMCİNİN MAĞAZASINA GÖRE, ölçülerek belirlendi:
  //   `userRatingsShows` → `r.show.ids.trakt` · `useShowDetailHandlers.ts:42`
  //   `userRatingsEpisodes` → `r.episode.ids.trakt` · `app/episode/[id].tsx:115`
  //   `hiddenShowIds` → düz `number[]`
  // ⚠️ `state` (bırakıldı) ailesi YOK — istemcide hiç yazılmıyor/okunmuyor
  //    ("Bırak" eylemi `hidden`'a bağlı). Bkz. Worker `koleksiyonlar.js`.
  puanDiziler: Array<{ show: any; rating: number }>;
  puanFilmler: Array<{ movie: any; rating: number }>;
  puanBolumler: Array<{ episode: { ids: { trakt: number } }; rating: number }>;
  izlemeListesiDiziler: Array<{ listed_at: string | null; show: any }>;
  izlemeListesiFilmler: Array<{ listed_at: string | null; movie: any }>;
  favoriDiziler: Array<{ listed_at: string | null; show: any }>;
  favoriFilmler: Array<{ listed_at: string | null; movie: any }>;
  gizliDiziler: number[];
  gizliFilmler: number[];
};

/**
 * Kullanıcının kütüphanesini BİZDEN okur — `fetchers.ts`'in Trakt
 * çağrılarının Kaymak karşılığı.
 *
 * 🔴 İLERLEME SUNUCUDA HESAPLANIYOR, burada değil. Katalog "kaç bölüm
 * yayınlandı"yı biliyor; istemci bilmiyor. Trakt'ın
 * `/shows/:id/progress/watched`'ı ne yapıyorsa Worker da onu yapıyor —
 * bu yüzden dönen şekil birebir aynı ve `showProgressMap`'e doğrudan
 * yazılabiliyor.
 *
 * ⚠️ TEK İSTEK. Dizi başına çağrı yapmak plan §6.2'nin (Y28) yasakladığı
 * desendir; Worker de içeride sabit sayıda sorgu ediyor.
 */
export const syncLibrary = async (): Promise<KutuphaneYaniti> => {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const token = await SecureStore.getItemAsync('traktAccessToken');

  const res = await axios.post(
    `${KAYMAK_WORKER_URL}/library/sync`,
    { traktAccessToken: token },
    { headers: { 'Content-Type': 'application/json' }, timeout: 30000 },
  );
  const d = res.data || {};
  const dizi = (x: any) => (Array.isArray(x) ? x : []);
  return {
    success: d.success === true,
    diziler: dizi(d.diziler),
    filmler: dizi(d.filmler),
    kirpildi: d.kirpildi === true,
    puanDiziler: dizi(d.puanDiziler),
    puanFilmler: dizi(d.puanFilmler),
    puanBolumler: dizi(d.puanBolumler),
    izlemeListesiDiziler: dizi(d.izlemeListesiDiziler),
    izlemeListesiFilmler: dizi(d.izlemeListesiFilmler),
    favoriDiziler: dizi(d.favoriDiziler),
    favoriFilmler: dizi(d.favoriFilmler),
    gizliDiziler: dizi(d.gizliDiziler),
    gizliFilmler: dizi(d.gizliFilmler),
  };
};

/**
 * TEK dizinin gerçek ilerlemesi — Trakt'ın `getShowProgress(showId)`'inin
 * birebir karşılığı, aynı şekli döndürür.
 *
 * 🔴 NEDEN ŞART (M319): işaretleme sonrası iyimser güncelleme YALNIZCA
 * `next_episode`'u ilerletiyor, `seasons[].episodes[].completed`'a
 * DOKUNMUYOR (`progress.ts`). Takip kartı birincisini, dizi detay ekranı
 * ikincisini okuyor — tazeleme olmadan kart ilerliyor ama bölüm
 * "izlenmemiş" görünmeye devam ediyordu. Cihazda görülen tam olarak buydu.
 *
 * ⚠️ `syncLibrary()` ÇAĞIRMA: o TÜM kütüphaneyi getirir. Her işaretlemeden
 * sonra onlarca dizinin bölüm listesini indirmek olurdu.
 *
 * @returns ilerleme, ya da dizi katalogda yoksa `null`.
 */
export const fetchShowProgress = async (
  showId: number,
): Promise<KutuphaneIlerlemesi | null> => {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const token = await SecureStore.getItemAsync('traktAccessToken');

  const res = await axios.post(
    `${KAYMAK_WORKER_URL}/library/sync`,
    { traktAccessToken: token, traktShowId: showId },
    { headers: { 'Content-Type': 'application/json' }, timeout: 20000 },
  );
  const dizi = Array.isArray(res.data?.diziler) ? res.data.diziler[0] : null;

  // 🔴 KİMLİĞİ DOĞRULA, KÖRLEMESİNE `[0]` ALMA.
  // Dar kapsam kipi herhangi bir sebeple devreye girmezse (gövde alanı adı
  // değişir, eski bir isolate cevap verir, araya giren bir vekil gövdeyi
  // kırpar) Worker TÜM kütüphaneyi döner ve `diziler[0]` BAŞKA bir dizinin
  // ilerlemesi olur. O da `showProgressMap[showId]` altına yazılırdı:
  // bölüm numaraları tutmaz, hiçbir tik görünmez, HİÇBİR HATA da fırlamaz.
  // Aranan hatanın semptomunu birebir üreten sessiz bir yol.
  if (dizi && dizi.traktId !== showId) {
    throw new Error(
      `library/sync yanlış dizi döndürdü: istenen ${showId}, gelen ${dizi.traktId}. ` +
      `Dar kapsam kipi devrede olmayabilir.`,
    );
  }
  return dizi?.ilerleme ?? null;
};

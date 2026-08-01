/**
 * "Bu yapımı takip ediyor muyum?" sorusunun TEK GERÇEK KAYNAĞI.
 *
 * NEDEN VAR: bu soru uygulamada dört ayrı yerde (dizi/film detay sayfasındaki
 * "Takip Et" butonu, liste kartı, Keşfet grid kartı) ayrı ayrı ve BİRBİRİNDEN
 * FARKLI cevaplanıyordu:
 *   - `ShowCard` / `ExploreWebGrid`  → `isWatchlisted || isWatched`  (neredeyse doğru)
 *   - `MediaHero` (detay sayfası)    → yalnızca `isWatchlisted`      (HATALI)
 *
 * `MediaHero`'daki eksiklik somut bir hataya yol açıyordu: bu uygulamada
 * izleme listesi (watchlist) "henüz başlanmadı" anlamına gelir — bir diziyi
 * izlemeye başladığında watchlist'ten düşer (bkz. store/tracking/
 * trackingLogic.ts `notStarted` kovası ve services/library/mutations/
 * progress.ts'teki "WATCHLIST RECOVERY": ilerleme sıfıra düştüğünde dizi
 * watchlist'e GERİ eklenir). Sonuç: kullanıcının yıllardır izlediği ya da
 * bitirdiği yüzlerce dizi/film için buton hâlâ "Takip Et" diyordu — oysa
 * kullanıcı onları açıkça takip ediyordu.
 *
 * TANIM: Bir yapımı takip ediyorum demek = kütüphanemde demek.
 *
 *     takipEdiyorum = (izleme listemde VEYA izleme geçmişim var) VE bırakmadım
 *
 *   - `isWatchlisted` → bilinçli olarak eklenmiş, henüz başlanmamış.
 *   - `isWatched`     → başlanmış ya da bitirilmiş; "bitirdiysem mantıken
 *                       takip ediyorumdur" (kullanıcı ifadesi).
 *   - `isDropped`     → "Bırak" ile Trakt'ta gizlenmiş. Uygulamanın TEK bırakma
 *                       mekanizması budur (bkz. mutations/collections.ts
 *                       toggleHiddenFromProgress) ve `trackingLogic.ts`'te EN
 *                       YÜKSEK öncelikli kuraldır. Kullanıcının bilinçli olarak
 *                       bıraktığı bir yapım için "Takip Ediliyor" demek ona
 *                       YANLIŞ bilgi vermek olurdu.
 */

export type MediaType = 'show' | 'movie';

/** `useLibraryStore`'un bu hesap için gereken dilimleri. */
export interface FollowLibrarySlices {
  watchlistShows?: any[] | null;
  watchlistMovies?: any[] | null;
  watchedShows?: any[] | null;
  watchedMovies?: any[] | null;
  hiddenShowIds?: number[] | null;
  hiddenMovieIds?: number[] | null;
}

export interface MediaFollowStatus {
  isWatchlisted: boolean;
  isWatched: boolean;
  isDropped: boolean;
  /** Butonun "Takip Ediliyor" gösterip göstermeyeceği — yukarıdaki tanım. */
  isFollowing: boolean;
}

const containsId = (list: any[] | null | undefined, key: MediaType, traktId: number): boolean =>
  !!list?.some((entry: any) => entry?.[key]?.ids?.trakt === traktId);

/**
 * Kuralın kendisi — üç ham bayraktan takip durumunu türetir.
 * Bayrakları zaten elinde olan çağıranlar (ör. `MediaHero`, bunları prop
 * olarak alıyor) doğrudan bunu kullanır; store dilimlerinden hesaplaması
 * gerekenler aşağıdaki `getMediaFollowStatus`u çağırır. İki giriş noktası,
 * TEK kural.
 */
export function deriveFollowStatus(flags: {
  isWatchlisted?: boolean;
  isWatched?: boolean;
  isDropped?: boolean;
}): MediaFollowStatus {
  const isWatchlisted = !!flags.isWatchlisted;
  const isWatched = !!flags.isWatched;
  const isDropped = !!flags.isDropped;
  return {
    isWatchlisted,
    isWatched,
    isDropped,
    isFollowing: (isWatchlisted || isWatched) && !isDropped,
  };
}

/** Ham kütüphane dilimlerinden takip durumu — liste/grid kartları için. */
export function getMediaFollowStatus(
  traktId: number | undefined | null,
  type: MediaType,
  slices: FollowLibrarySlices
): MediaFollowStatus {
  if (!traktId) return deriveFollowStatus({});

  return deriveFollowStatus({
    isWatchlisted:
      type === 'movie'
        ? containsId(slices.watchlistMovies, 'movie', traktId)
        : containsId(slices.watchlistShows, 'show', traktId),
    isWatched:
      type === 'movie'
        ? containsId(slices.watchedMovies, 'movie', traktId)
        : containsId(slices.watchedShows, 'show', traktId),
    isDropped:
      type === 'movie'
        ? !!slices.hiddenMovieIds?.includes(traktId)
        : !!slices.hiddenShowIds?.includes(traktId),
  });
}

/**
 * Takip butonuna basıldığında YAPILACAK eylem.
 *
 * Buton bir aç/kapa (toggle) — ama "takip etmeyi bırak"ın karşılığı duruma
 * göre DEĞİŞİR. ESKİ DAVRANIŞ: her durumda körü körüne `toggleWatchlistStatus`
 * çağrılıyordu. İzleme geçmişi olan (ama watchlist'te olmayan) bir yapımda bu,
 * yapımı watchlist'e EKLİYOR ve butonun görünümünü hiç değiştirmiyordu — yani
 * buton "hiçbir şey yapmıyor" gibi hissettiriyordu.
 *
 *   - `addToWatchlist`      → kütüphanede hiç yok: izleme listesine ekle.
 *   - `removeFromWatchlist` → yalnızca izleme listesinde (henüz başlanmamış):
 *                             listeden çıkar. Geçmiş yok, kaybolan bir şey yok.
 *   - `drop`                → izleme geçmişi VAR: geçmişi silmek YIKICI olurdu.
 *                             Doğru karşılık, uygulamanın kendi "takibi bırak"
 *                             ilkeli olan "Bırak"tır: izleme geçmişi ve puanlar
 *                             KORUNUR, yapım yalnızca vitrin listelerinden
 *                             çıkar ve her an geri alınabilir (hatta yeni bir
 *                             bölüm izlenince kendiliğinden geri döner — bkz.
 *                             mutations/progress.ts unhideShowIfNeeded).
 *   - `undrop`              → bırakılmış: takibi geri başlat.
 */
export type FollowAction = 'addToWatchlist' | 'removeFromWatchlist' | 'drop' | 'undrop';

export function resolveFollowAction(status: MediaFollowStatus): FollowAction {
  // Bırakılmışsa (takip edilmiyor sayılır) tek anlamlı eylem geri almaktır.
  if (status.isDropped) return 'undrop';
  if (!status.isFollowing) return 'addToWatchlist';
  return status.isWatched ? 'drop' : 'removeFromWatchlist';
}

/**
 * Film Takip (Movie Tracking) modülünün TEK GERÇEK KAYNAĞI.
 *
 * Dizi tarafındaki `trackingLogic.ts` ile aynı sözleşme: buradaki fonksiyon
 * tamamen SAF (pure) ve UI'dan bağımsızdır — girdi olarak ham Zustand
 * dilimlerini (watchedMovies, watchlistMovies) alır, çıktı olarak her filmi TAM
 * OLARAK BİR kategoriye koyan deterministik bir sonuç döndürür.
 *
 * Filmler dizilerden çok daha basit: "sıradaki bölüm", "yayınlanmış mı",
 * "ara verilmiş mi" gibi kavramlar YOKTUR. Bir film ya izlenmiştir, ya izlenmeyi
 * beklemektedir, ya da kullanıcı onu elle bırakmıştır. Bu yüzden dizilerdeki
 * `pauseThresholdDays` / `readyToWatch` mantığının hiçbir karşılığı burada
 * bilerek yoktur — olmayan bir karmaşıklığı taklit etmiyoruz.
 *
 * Kurallar (bir film = bir kova, çakışma imkânsız):
 *   1. Kullanıcı elle "Bırakıldı" işaretlemiş                     → dropped
 *      (izlenmiş/izlenecek olmasından TAMAMEN bağımsız, en yüksek öncelik).
 *   2. İzleme geçmişinde var                                      → watched
 *   3. Yalnızca izleme listesinde                                 → watchlist
 */

export interface MovieTrackCard {
  id: number;
  /**
   * Filmin ham başlığı — dizilerdeki `toTitle` gibi BÜYÜK HARFE ÇEVRİLMEZ.
   * Bu değer lokal aramada da kullanılıyor; büyük harfe çevirmek Türkçe'de
   * "i → İ" dönüşümü yüzünden arama karşılaştırmasını bozardı.
   */
  title: string;
  year: number | undefined;
  tmdbId: number | undefined;
  slug: string | undefined;
  /** Yalnızca `watched` kovasında dolu olur. */
  lastWatchedAt?: string;
  /** İzleme listesine eklenme tarihi — yalnızca `watchlist` kovasında dolu olur. */
  listedAt?: string;
}

export interface MovieCategories {
  /** İzlenenler — kullanıcının bitirdiği, arşivine kattığı filmler. */
  watched: MovieTrackCard[];
  /** İzlenecekler — listeye eklenmiş ama henüz izlenmemiş filmler. */
  watchlist: MovieTrackCard[];
  /** Bırakılanlar — yalnızca ELLE işaretlenenler, otomatik hiçbir kural yok. */
  dropped: MovieTrackCard[];
}

export type MovieCategoryKey = keyof MovieCategories;

/** Filtre menüsündeki ve kategori döngülerindeki tek doğru sıra. */
export const MOVIE_CATEGORY_KEYS: readonly MovieCategoryKey[] = ['watched', 'watchlist', 'dropped'] as const;

export interface MovieTrackingLabels {
  unnamedMovie: string;
}

export interface CategorizeMoviesOptions {
  watchedMovies: any[];
  watchlistMovies: any[];
  labels: MovieTrackingLabels;
  /** Kullanıcının elle "Bırakıldı" işaretlediği FİLMLERİN trakt id'leri. */
  droppedMovieIds?: number[] | Set<number>;
}

const toCard = (movie: any, id: number, fallbackTitle: string): MovieTrackCard => ({
  id,
  title: movie?.title || fallbackTitle,
  year: movie?.year,
  tmdbId: movie?.ids?.tmdb,
  slug: movie?.ids?.slug,
});

const timeOf = (value: string | undefined) => (value ? new Date(value).getTime() || 0 : 0);

/**
 * Ham dilimleri, ekranların doğrudan gösterebileceği 3 kategoriye ayırır.
 * Her film trakt id'siyle tekilleştirilir; watched + watchlist havuzları
 * birleştirilip her kimlik yalnızca BİR kez işlenir.
 */
export function categorizeMovies({
  watchedMovies,
  watchlistMovies,
  labels,
  droppedMovieIds = [],
}: CategorizeMoviesOptions): MovieCategories {
  const droppedSet = droppedMovieIds instanceof Set ? droppedMovieIds : new Set(droppedMovieIds);

  const watched: MovieTrackCard[] = [];
  const watchlist: MovieTrackCard[] = [];
  const dropped: MovieTrackCard[] = [];

  // Aynı filmin iki kovaya birden düşmesi yapısal olarak imkânsız olsun diye
  // tek bir "işlendi" kümesi tutuluyor. İzleme geçmişi önce işlenir: bir film
  // hem geçmişte hem listede görünüyorsa (Trakt'ta olabilen bir durum)
  // "izlenmiş" hâli daha doğru bilgidir.
  const seen = new Set<number>();

  for (const item of watchedMovies || []) {
    const id = item?.movie?.ids?.trakt;
    if (id == null || seen.has(id)) continue;
    seen.add(id);

    const card: MovieTrackCard = {
      ...toCard(item.movie, id, labels.unnamedMovie),
      lastWatchedAt: item.last_watched_at,
    };

    if (droppedSet.has(id)) dropped.push(card);
    else watched.push(card);
  }

  for (const item of watchlistMovies || []) {
    const id = item?.movie?.ids?.trakt;
    if (id == null || seen.has(id)) continue;
    seen.add(id);

    const card: MovieTrackCard = {
      ...toCard(item.movie, id, labels.unnamedMovie),
      listedAt: item.listed_at,
    };

    if (droppedSet.has(id)) dropped.push(card);
    else watchlist.push(card);
  }

  // İzlenenler: en son izlenen en üstte. İzlenecekler: en son eklenen en üstte.
  // Bırakılanlar karışık kaynaklıdır (hem geçmişten hem listeden gelebilir),
  // bu yüzden elde hangi tarih varsa ona göre sıralanır.
  watched.sort((a, b) => timeOf(b.lastWatchedAt) - timeOf(a.lastWatchedAt));
  watchlist.sort((a, b) => timeOf(b.listedAt) - timeOf(a.listedAt));
  dropped.sort((a, b) => timeOf(b.lastWatchedAt || b.listedAt) - timeOf(a.lastWatchedAt || a.listedAt));

  return { watched, watchlist, dropped };
}

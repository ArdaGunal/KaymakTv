import type { UpcomingEpisode } from './planners/episodePlanners';
import type { UpcomingMovie } from './planners/movieReleasePlanner';

/**
 * Trakt takvim yanıtını planlayıcının anladığı şekle çevirir.
 *
 * 🔴 YENİ AĞ İSTEĞİ YOK. Girdi, `store/useLibraryStore.ts`'in ZATEN bellekte
 * tuttuğu `calendarShows` ve `watchedShows` dizileri (bkz.
 * `services/library/fetchers.ts` — kütüphane senkronunda `getMyCalendarShows(33)`
 * ve `getWatchedShows()` çağrılıyor). Bildirim sistemi için Trakt'a ikinci kez
 * gitmek, kullanıcı başına gereksiz kota tüketmek olurdu.
 *
 * 🔴 SAF: yalnızca `import type`. Girdiler `unknown` olarak alınıp burada
 * doğrulanıyor — Trakt yanıtı `any` olarak dolaşıyor ve şekil varsayımını
 * kontrolsüz kabul etmek, tek bir eksik alanda tüm planlamayı çökertirdi.
 */

/** Trakt'ın `/sync/watched/shows` yanıtından "izlendi" anahtar kümesi üretir. */
export function buildWatchedEpisodeKeys(watchedShows: readonly unknown[]): Set<string> {
  const keys = new Set<string>();

  for (const raw of watchedShows) {
    const item = raw as {
      show?: { ids?: { trakt?: number } };
      seasons?: { number?: number; episodes?: { number?: number }[] }[];
    };

    const showId = item?.show?.ids?.trakt;
    if (typeof showId !== 'number') continue;

    // `seasons` yalnızca `?extended=full` ile gelir. Gelmemişse bu dizi için
    // izlenme bilgisi yok demektir — sessizce atlanır, çünkü "bilmiyorum"
    // ile "izlenmedi" farklı şeyler ve ikincisini varsaymak bildirim
    // göndermeye devam etmek anlamına gelir (güvenli taraf).
    for (const season of item?.seasons ?? []) {
      if (typeof season?.number !== 'number') continue;
      for (const episode of season?.episodes ?? []) {
        if (typeof episode?.number !== 'number') continue;
        keys.add(`${showId}:${season.number}:${episode.number}`);
      }
    }
  }

  return keys;
}

/**
 * @param calendarShows `/calendars/my/shows` ham yanıtı
 * @param watchedKeys   `buildWatchedEpisodeKeys` çıktısı
 */
export function mapCalendarToUpcoming(
  calendarShows: readonly unknown[],
  watchedKeys: ReadonlySet<string>,
): UpcomingEpisode[] {
  const result: UpcomingEpisode[] = [];

  for (const raw of calendarShows) {
    const entry = raw as {
      first_aired?: string;
      episode?: { season?: number; number?: number; title?: string | null; ids?: { trakt?: number } };
      show?: { title?: string; ids?: { trakt?: number } };
    };

    const episodeTraktId = entry?.episode?.ids?.trakt;
    const showTraktId = entry?.show?.ids?.trakt;
    const showTitle = entry?.show?.title;
    const seasonNumber = entry?.episode?.season;
    const episodeNumber = entry?.episode?.number;
    const firstAiredUtc = entry?.first_aired;

    // Bu alanlardan biri eksikse bildirim ne kurulabilir ne de anlamlı bir
    // metin üretilebilir. Eksik kaydı atlamak, yarım bir bildirim
    // ("undefined S3B7 yayında") göstermekten iyidir.
    if (
      typeof episodeTraktId !== 'number' ||
      typeof showTraktId !== 'number' ||
      typeof showTitle !== 'string' ||
      typeof seasonNumber !== 'number' ||
      typeof episodeNumber !== 'number' ||
      typeof firstAiredUtc !== 'string'
    ) {
      continue;
    }

    result.push({
      showTitle,
      episodeTraktId,
      seasonNumber,
      episodeNumber,
      episodeTitle: entry?.episode?.title ?? null,
      firstAiredUtc,
      alreadyWatched: watchedKeys.has(`${showTraktId}:${seasonNumber}:${episodeNumber}`),
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// FİLMLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔴 SADECE-TARİH DEĞERLERİNİ YEREL GÜNE SABİTLER.
 *
 * Trakt film takvimi `released` alanını `"2026-09-15"` biçiminde, SAATSİZ
 * döndürür. `new Date("2026-09-15")` bunu UTC gece yarısı olarak ayrıştırır.
 * Negatif ofsetli saat dilimlerinde (ör. ABD, UTC-5) bu YEREL OLARAK BİR
 * ÖNCEKİ GÜNÜN akşamıdır — kullanıcı filmin çıkışını bir gün ERKEN haber
 * alırdı. Türkiye'de (+3) sorun görünmediği için bu hata kolayca gözden
 * kaçar; o yüzden burada, kaynağında kapatılıyor.
 *
 * Saat bilgisi İÇEREN değerler (bölüm takvimi) olduğu gibi geçer.
 */
export function normalizeDateOnly(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const local = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
  return Number.isNaN(local.getTime()) ? value : local.toISOString();
}

/** `/sync/watched/movies` yanıtından izlenen film kimlikleri. */
export function buildWatchedMovieIds(watchedMovies: readonly unknown[]): Set<number> {
  const ids = new Set<number>();
  for (const raw of watchedMovies) {
    const id = (raw as { movie?: { ids?: { trakt?: number } } })?.movie?.ids?.trakt;
    if (typeof id === 'number') ids.add(id);
  }
  return ids;
}

/**
 * @param calendarMovies `/calendars/my/movies` ham yanıtı
 * @param watchedIds     `buildWatchedMovieIds` çıktısı
 */
export function mapCalendarToUpcomingMovies(
  calendarMovies: readonly unknown[],
  watchedIds: ReadonlySet<number>,
): UpcomingMovie[] {
  const result: UpcomingMovie[] = [];

  for (const raw of calendarMovies) {
    const entry = raw as {
      released?: string;
      first_aired?: string;
      movie?: { title?: string; ids?: { trakt?: number } };
    };

    const movieTraktId = entry?.movie?.ids?.trakt;
    const title = entry?.movie?.title;
    // Trakt film takviminde alan `released`; bölüm takvimiyle aynı kodu
    // paylaşan bir yanıt gelirse diye `first_aired` de kabul ediliyor.
    const released = entry?.released ?? entry?.first_aired;

    if (typeof movieTraktId !== 'number' || typeof title !== 'string' || typeof released !== 'string') {
      continue;
    }

    result.push({
      title,
      movieTraktId,
      releasedUtc: normalizeDateOnly(released),
      alreadyWatched: watchedIds.has(movieTraktId),
    });
  }

  return result;
}

import type { ScheduledPlan } from '../../types';

/**
 * "Film Çıkışı" planlayıcısı (docs/design/notifications.md § 1).
 *
 * Veri kaynağı: `/calendars/my/movies` — `store/useLibraryStore.ts`'in
 * `calendarMovies` alanında ZATEN duruyor (`services/library/fetchers.ts`
 * NORMAL öncelikli kuyrukta 33 günlük çekiyor). Yeni ağ isteği YOK.
 *
 * 🔴 SAF: yalnızca `import type`.
 *
 * ⚠️ BU "SİNEMA VİZYONU" DEMEKTİR, "dijitalde izlenebilir" DEĞİL.
 * Trakt'ın takvimi vizyon tarihini verir; bir filmin hangi platforma ne zaman
 * geldiği Trakt'ta YOKTUR (TMDB `watch/providers`'ta var — F2'deki ayrı
 * "artık izlenebilir" kategorisi onu kullanacak). Metinler bu ayrımı
 * gözetmeli, yoksa kullanıcı bildirime tıklayıp izleyemediği bir filmle
 * karşılaşır.
 */

export interface UpcomingMovie {
  title: string;
  movieTraktId: number;
  /** Trakt `released` / takvimdeki `first_aired` — UTC ISO 8601. */
  releasedUtc: string;
  /** Kullanıcı filmi zaten izlediyse bildirim kurulmaz. */
  alreadyWatched: boolean;
}

export interface MovieCopyVars {
  title: string;
}

export interface MoviePlannerOptions {
  now: number;
  horizonDays: number;
  resolveFireTime: (releasedUtc: string) => number | null;
  renderCopy: (vars: MovieCopyVars) => { title: string; body: string };
}

const GUN_MS = 24 * 60 * 60 * 1000;

export function planMovieRelease(
  movies: readonly UpcomingMovie[],
  options: MoviePlannerOptions,
): ScheduledPlan[] {
  const { now, horizonDays, resolveFireTime, renderCopy } = options;
  const horizonEnd = now + horizonDays * GUN_MS;

  const plans: ScheduledPlan[] = [];
  const seen = new Set<number>();

  for (const movie of movies) {
    if (movie.alreadyWatched) continue;
    if (seen.has(movie.movieTraktId)) continue;

    const fireAt = resolveFireTime(movie.releasedUtc);
    if (fireAt === null) continue;
    if (fireAt > horizonEnd) continue;

    seen.add(movie.movieTraktId);

    const { title, body } = renderCopy({ title: movie.title });

    plans.push({
      identifier: `movieRelease:${movie.movieTraktId}`,
      categoryId: 'movieRelease',
      fireAt,
      title,
      body,
      data: {
        categoryId: 'movieRelease',
        entityId: String(movie.movieTraktId),
        deepLink: `/movie/${movie.movieTraktId}`,
        plannedFireAt: fireAt,
      },
    });
  }

  return plans;
}

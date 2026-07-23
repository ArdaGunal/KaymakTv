import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibrarySelector } from '../context/LibraryContext';

export type StatsTab = 'shows' | 'movies';

export interface ProfileStatsSummary {
  totalMinutes: number;
  episodesWatched: number;
  moviesWatched: number;
}

export interface ProfileStatsCompletion {
  started: number;
  finished: number;
}

export interface GenreSlice {
  /** Trakt tür kodu ('science-fiction'), "Diğer" toplamı için null. */
  slug: string | null;
  label: string;
  /** Bu türe ait içerik SAYISI (yüzde değil). */
  value: number;
  percent: number;
  color: string;
}

export interface MonthlyBar {
  label: string;
  value: number;
  /** 'YYYY-MM' — sıralama ve seçim için kararlı anahtar. */
  key: string;
}

export interface RatingBar {
  score: number;
  count: number;
}

export interface ProfileStatsRatings {
  bars: RatingBar[];
  total: number;
  average: number;
}

/** Donut dilimleri için sabit palet — sıra her zaman aynı, renkler kaymaz. */
const GENRE_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#06B6D4'];
const OTHER_COLOR = '#475569';
const MAX_GENRE_SLICES = 6;
const MONTHS_BACK = 6;

/**
 * "Detaylı Analiz" ekranının TÜM veri türetme mantığı.
 *
 * ÖNEMLİ: Tür (genre) ve aylık grafikler eskiden `mockChartData.ts` içindeki
 * SABİT sahte değerlerden besleniyordu — her kullanıcıya aynı "Bilim Kurgu %40,
 * Drama %25" tablosu gösteriliyordu ve aylar ("Şub, Mar, Nis…") gerçek tarihlerle
 * hiç ilgili değildi. Artık ikisi de kullanıcının gerçek kütüphanesinden türetiliyor.
 *
 * Veri kaynakları:
 * - Türler: `watchedShows[].show.genres` / `watchedMovies[].movie.genres`
 *   (her iki uç nokta da `extended=full` ile çekildiği için bu alan mevcut).
 * - Aylık etkinlik: `last_watched_at`. Bu alan bir içeriğin SON izlenme anıdır;
 *   dolayısıyla grafik "o ay kaç bölüm izlendi"yi değil, "o ay kaç dizi/filmle
 *   ilgilenildi"yi gösterir. Başlıklar da bunu söyleyecek şekilde yazıldı —
 *   elimizdeki veriyle dürüstçe söylenebilecek şey bu.
 * - Puanlar: `userRatingsShows` / `userRatingsMovies`.
 */
export function useProfileStatistics(activeTab: StatsTab) {
  const { t, i18n } = useTranslation('media');

  const {
    userStats,
    watchedShows,
    watchedMovies,
    watchlistMovies,
    showProgressMap,
    userRatingsShows,
    userRatingsMovies,
  } = useLibrarySelector((s) => ({
    userStats: s.userStats,
    watchedShows: s.watchedShows,
    watchedMovies: s.watchedMovies,
    watchlistMovies: s.watchlistMovies,
    showProgressMap: s.showProgressMap,
    userRatingsShows: s.userRatingsShows,
    userRatingsMovies: s.userRatingsMovies,
  }));

  /** Aktif sekmenin ham kayıtları — hepsi aynı şekilde işlenebilsin diye normalize edilir. */
  const entries = useMemo(() => {
    const source = activeTab === 'shows' ? watchedShows : watchedMovies;
    const key = activeTab === 'shows' ? 'show' : 'movie';
    return (source || [])
      .map((item: any) => ({
        media: item?.[key],
        lastWatchedAt: item?.last_watched_at as string | undefined,
      }))
      .filter((entry) => !!entry.media);
  }, [activeTab, watchedShows, watchedMovies]);

  const summary = useMemo<ProfileStatsSummary>(() => ({
    totalMinutes: (userStats?.episodes.minutes || 0) + (userStats?.movies.minutes || 0),
    episodesWatched: userStats?.episodes.watched || 0,
    moviesWatched: userStats?.movies.watched || 0,
  }), [userStats]);

  // Diziler: "başlanan" = kütüphanede izlenen dizi sayısı, "biten" = ilerleme
  // haritasında yayınlanan tüm bölümlere yetişmiş (completed >= aired) diziler.
  // Filmler: dizilerdeki "bölüm" kavramı olmadığından, izleme listesi + izlenen
  // havuzundan kaçının fiilen izlendiği oran olarak yorumlanır.
  const completion = useMemo<ProfileStatsCompletion>(() => {
    if (activeTab === 'shows') {
      const started = watchedShows?.length || 0;
      const finished = (watchedShows || []).filter((item: any) => {
        const id = item?.show?.ids?.trakt;
        const progress = id ? showProgressMap?.[id] : null;
        return !!progress && progress.aired > 0 && progress.completed >= progress.aired;
      }).length;
      return { started, finished };
    }

    const finished = watchedMovies?.length || 0;
    const started = finished + (watchlistMovies?.length || 0);
    return { started, finished };
  }, [activeTab, watchedShows, watchedMovies, watchlistMovies, showProgressMap]);

  const genres = useMemo<GenreSlice[]>(() => {
    const counts = new Map<string, number>();

    for (const entry of entries) {
      const list: unknown = entry.media?.genres;
      if (!Array.isArray(list)) continue;
      // Aynı içerik aynı türü iki kez taşırsa bir kez sayılsın.
      const unique = new Set(list.filter((g): g is string => typeof g === 'string' && g.length > 0));
      for (const slug of unique) counts.set(slug, (counts.get(slug) || 0) + 1);
    }

    if (counts.size === 0) return [];

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const top = sorted.slice(0, MAX_GENRE_SLICES);
    const restTotal = sorted.slice(MAX_GENRE_SLICES).reduce((sum, [, count]) => sum + count, 0);

    // Yüzde, TÜR ETİKETİ toplamı üzerinden hesaplanır (içerik sayısı üzerinden
    // değil): bir dizi birden fazla türe ait olabildiği için toplam, içerik
    // sayısını aşar ve "yüzdeler 100'ü geçiyor" hatası doğardı.
    const labelTotal = sorted.reduce((sum, [, count]) => sum + count, 0);
    const toPercent = (count: number) => (labelTotal > 0 ? Math.round((count / labelTotal) * 100) : 0);

    const slices: GenreSlice[] = top.map(([slug, count], index) => ({
      slug,
      label: t(`genres.${slug}`, prettifySlug(slug)),
      value: count,
      percent: toPercent(count),
      color: GENRE_COLORS[index % GENRE_COLORS.length],
    }));

    if (restTotal > 0) {
      slices.push({
        slug: null,
        label: t('otherGenres', 'Diğer'),
        value: restTotal,
        percent: toPercent(restTotal),
        color: OTHER_COLOR,
      });
    }

    return slices;
  }, [entries, t]);

  const monthly = useMemo<MonthlyBar[]>(() => {
    const locale = i18n.language === 'en' ? 'en-US' : 'tr-TR';
    const now = new Date();

    // Son 6 ay iskeleti önce kurulur: veri olmayan aylar da 0 değeriyle
    // grafikte yer alır, böylece zaman ekseni kesintisiz görünür.
    const buckets: MonthlyBar[] = [];
    const indexByKey = new Map<string, number>();

    for (let offset = MONTHS_BACK - 1; offset >= 0; offset--) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      indexByKey.set(key, buckets.length);
      buckets.push({
        key,
        label: date.toLocaleDateString(locale, { month: 'short' }),
        value: 0,
      });
    }

    for (const entry of entries) {
      if (!entry.lastWatchedAt) continue;
      const date = new Date(entry.lastWatchedAt);
      if (isNaN(date.getTime())) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const index = indexByKey.get(key);
      if (index !== undefined) buckets[index].value += 1;
    }

    return buckets;
  }, [entries, i18n.language]);

  const ratings = useMemo<ProfileStatsRatings>(() => {
    const source = activeTab === 'shows' ? userRatingsShows : userRatingsMovies;
    const bars: RatingBar[] = Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: 0 }));

    let total = 0;
    let sum = 0;

    for (const item of source || []) {
      const rating = Number(item?.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 10) continue;
      const score = Math.round(rating);
      bars[score - 1].count += 1;
      total += 1;
      sum += score;
    }

    return { bars, total, average: total > 0 ? sum / total : 0 };
  }, [activeTab, userRatingsShows, userRatingsMovies]);

  return {
    summary,
    completion,
    genres,
    monthly,
    ratings,
    /** Aktif sekmede analiz edilebilecek herhangi bir içerik var mı? */
    hasContent: entries.length > 0,
    hasStats: !!userStats,
  };
}

/** Çevirisi olmayan tür kodları için okunabilir yedek: 'game-show' → 'Game Show'. */
function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => (part ? part[0].toLocaleUpperCase() + part.slice(1) : part))
    .join(' ');
}

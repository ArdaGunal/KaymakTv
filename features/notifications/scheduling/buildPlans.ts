import { loadCopyHistory } from '../copy/history';
import { pickVariant, pushRecent } from '../copy/picker';
import { COPY_POOL, variantBodyKey, variantTitleKey } from '../copy/pool';
import { interpolate } from '../copy/interpolate';
import { mergeRemotePool } from '../copy/remoteSchema';
import { loadCachedRemotePool } from '../copy/remotePool';
import { getActiveCategories } from '../registry';
import { resolveFireTime, snapToPreferredHour } from './fireTime';
import {
  buildWatchedEpisodeKeys,
  buildWatchedMovieIds,
  mapCalendarToUpcoming,
  mapCalendarToUpcomingMovies,
} from './mapCalendar';
import { pickResumeCandidate } from './mapProgress';
import { planEpisodeToday, planSeasonPremiere } from './planners/episodePlanners';
import { planMovieRelease } from './planners/movieReleasePlanner';
import { planContinueWatching } from './planners/continueWatchingPlanner';
import { planMonthlyStats } from './planners/monthlyStatsPlanner';
import { evaluateMonthlyStats } from '../stats/snapshot';
import { loadStatsSnapshot } from '../stats/snapshotStore';
import type { CopyHistory } from '../copy/history';
import type { StatsSnapshot } from '../stats/snapshot';
import { generateEpisodeSlug } from '../../../utils/slugHelper';
import type { NotificationPrefs, ScheduledPlan } from '../types';

/**
 * 🔴 SLUG ÜRETİMİNİN TEK YERİ. Planlayıcılar SAF olduğu için
 * `utils/slugHelper`'ı doğrudan import edemiyor (testler onları `.ts`
 * uzantısıyla yüklüyor, Node'un tür soyma özelliği uzantısız çalışma-zamanı
 * import'unu çözemiyor). Bu yüzden biçim BURADA biliniyor ve planlayıcılara
 * enjekte ediliyor — `resolveFireTime`/`renderCopy` ile aynı desen.
 *
 * ⚠️ `app/episode/[id].tsx` bu slug'ı `parseEpisodeSlug` ile çözüyor.
 * Biçim değişirse İKİSİ BİRDEN değişmeli; ikinci bir kopya tutmamamızın
 * sebebi tam olarak bu.
 */
const buildEpisodeLink = (vars: {
  showTraktId: number;
  showSlug: string | null;
  showTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTraktId: number;
}): string =>
  `/episode/${generateEpisodeSlug(
    vars.showTraktId,
    vars.showSlug ?? undefined,
    vars.showTitle,
    vars.seasonNumber,
    vars.episodeNumber,
    vars.episodeTraktId,
  )}`;

/**
 * Tüm kategorilerin planlarını üretir — bildirim sisteminin "ne kurulacak?"
 * kararı (docs/design/notifications.md § 2).
 *
 * ⚠️ NEDEN AYRI DOSYA: bu blok `hooks/useNotificationSetup.ts` içindeydi ve
 * o dosyayı **424 satıra** çıkarmıştı — `AI_RULES` §1'in 400 satır sınırının
 * üstü. Ayrım aynı zamanda doğru sorumluluk sınırı: burası KARAR verir
 * (hangi plan), hook ise YAN ETKİYİ yönetir (izin, süpürme, uygulama, defter).
 *
 * 🔴 SAF DEĞİLDİR (planlayıcıları import eder) — testleri Node'da doğrudan
 * çalıştırılamaz. Karar mantığının kendisi zaten saf modüllerde ve orada
 * test ediliyor; burası yalnızca onları sırayla çağıran bir tel.
 */

/** Kaç günlük ufuk planlanır. Takvim senkronu 33 gün çekiyor; altında kalıyoruz. */
export const HORIZON_DAYS = 30;

/** Kaç gün uygulamaya girilmezse "kaldığın yerden devam" dürtmesi düşer. */
export const NUDGE_AWAY_DAYS = 7;

/** İki dürtme arasındaki en kısa süre — kullanıcının açık "rahatsız etmesin" talebi. */
export const NUDGE_COOLDOWN_DAYS = 30;

/** Aylık özet için iki anlık görüntü arasında geçmesi gereken en kısa süre. */
export const STATS_PERIOD_DAYS = 28;

export interface BuildPlansInput {
  prefs: NotificationPrefs;
  now: number;
  /** `useTranslation('notifications')` → `t`. */
  translate: (key: string, vars?: Record<string, unknown>) => string;
  /** Uzak havuzdan hangi dilin metni alınacak. */
  language: string;
  /** `store/useLibraryStore.ts`'ten okunan, ZATEN bellekteki veriler. */
  calendarShows: readonly unknown[];
  watchedShows: readonly unknown[];
  calendarMovies: readonly unknown[];
  watchedMovies: readonly unknown[];
  showProgressMap: Record<string, unknown>;
  hiddenShowIds: readonly number[];
  hiddenMovieIds: readonly number[];
  userStats: { episodes?: { minutes?: number; watched?: number }; movies?: { minutes?: number; watched?: number } } | null;
}

export interface BuildPlansResult {
  plans: ScheduledPlan[];
  /**
   * 🔴 İMZA KONTROLÜNDEN SONRA yazılmalı — çağıran öyle yapar.
   * Gerekçe: bu fonksiyon her turda çalışır ama planlar çoğu turda
   * uygulanmaz; geçmişi burada yazmak, kullanıcıya HİÇ gösterilmemiş
   * varyantları "son gösterilenler"e sokar ve çeşitliliği azaltır
   * (2026-08-31'de düzeltilen gerçek hata, bkz. § 4).
   */
  copyHistory: CopyHistory;
  /** Varsa hemen yazılabilir; plan imzasından bağımsızdır. */
  nextStatsSnapshot: StatsSnapshot | null;
}

export async function buildNotificationPlans(input: BuildPlansInput): Promise<BuildPlansResult> {
  const { prefs, now, translate: t, language } = input;

  const active = getActiveCategories(prefs);
  const plans: ScheduledPlan[] = [];

  const history = await loadCopyHistory();
  const resolve = (iso: string) => resolveFireTime(iso, prefs.preferredHour, now);
  const snapHour = (target: number) => snapToPreferredHour(target, prefs.preferredHour);

  // Uzak havuz ÖNBELLEKTEN okunur — ağ beklenmez (§ 15).
  const copyPool = mergeRemotePool(COPY_POOL, await loadCachedRemotePool(), language);

  /**
   * Bir kategori için metin üreticisi. Kategori başına ayrı bir "son
   * gösterilenler" listesi tutar ve tur boyunca günceller — aynı planlamada
   * kurulan 20 bildirimin hepsine aynı metnin düşmemesi buna bağlı.
   */
  const makeCopyRenderer = (meta: (typeof active)[number]) => {
    let recentIds = history[meta.id] ?? [];
    return {
      render: (vars: Record<string, unknown>) => {
        const variant = pickVariant(copyPool, {
          categoryId: meta.id,
          tone: meta.tone,
          now: new Date(now),
          recentIds,
          random: Math.random,
        });

        // Havuz boş kalırsa bildirim metinsiz kalmasın. `picker` asla boş
        // dönmemek üzere yazıldı; bu dal yalnızca o kategorinin TÜM
        // varyantları havuzdan silinirse çalışır.
        if (!variant) {
          return { title: t('copy.fallback.title'), body: t('copy.fallback.body', vars) };
        }

        recentIds = pushRecent(recentIds, variant.id);

        // Uzak varyantın metni kendisiyle gelir ve i18n'den GEÇMEZ; yer
        // tutucuları `interpolate` dolduruyor — beyaz listeli, kırpılmış ve
        // temizlenmiş biçimde (§ 15 güvenlik sınırı).
        if (variant.text) {
          return {
            title: interpolate(variant.text.title, vars),
            body: interpolate(variant.text.body, vars),
          };
        }

        return { title: t(variantTitleKey(variant)), body: t(variantBodyKey(variant), vars) };
      },
      commit: () => {
        history[meta.id] = recentIds;
      },
    };
  };

  const bul = (id: string) => active.find((category) => category.id === id);
  const episodeMeta = bul('episodeToday');
  const premiereMeta = bul('seasonPremiere');
  const movieMeta = bul('movieRelease');
  const resumeMeta = bul('continueWatching');
  const statsMeta = bul('monthlyStats');

  // ── Bölümler: bugün yayında + sezon prömiyeri ──────────────────────────
  if (episodeMeta || premiereMeta) {
    const watchedKeys = buildWatchedEpisodeKeys(input.watchedShows);
    const upcoming = mapCalendarToUpcoming(input.calendarShows, watchedKeys, input.hiddenShowIds);

    for (const [meta, planner] of [
      [episodeMeta, planEpisodeToday] as const,
      [premiereMeta, planSeasonPremiere] as const,
    ]) {
      if (!meta) continue;
      const copy = makeCopyRenderer(meta);
      plans.push(
        ...planner(upcoming, {
          now,
          horizonDays: HORIZON_DAYS,
          resolveFireTime: resolve,
          buildEpisodeLink,
          renderCopy: (vars) =>
            copy.render({
              showTitle: vars.showTitle,
              seasonNumber: vars.seasonNumber,
              episodeNumber: vars.episodeNumber,
            }),
        }),
      );
      copy.commit();
    }
  }

  // ── Kaldığın yerden devam (§ 13) ───────────────────────────────────────
  if (resumeMeta) {
    const candidate = pickResumeCandidate(
      input.watchedShows,
      input.showProgressMap,
      input.hiddenShowIds,
    );
    const copy = makeCopyRenderer(resumeMeta);
    plans.push(
      ...planContinueWatching(candidate, {
        now,
        buildEpisodeLink,
        awayDays: NUDGE_AWAY_DAYS,
        cooldownDays: NUDGE_COOLDOWN_DAYS,
        lastNudgeFiredAt: prefs.lastNudgeFiredAt,
        snapToPreferredHour: snapHour,
        renderCopy: (vars) =>
          copy.render({
            showTitle: vars.showTitle,
            seasonNumber: vars.seasonNumber,
            episodeNumber: vars.episodeNumber,
          }),
      }),
    );
    copy.commit();
  }

  // ── Filmler ────────────────────────────────────────────────────────────
  if (movieMeta) {
    const upcomingMovies = mapCalendarToUpcomingMovies(
      input.calendarMovies,
      buildWatchedMovieIds(input.watchedMovies),
      input.hiddenMovieIds,
    );
    const copy = makeCopyRenderer(movieMeta);
    plans.push(
      ...planMovieRelease(upcomingMovies, {
        now,
        horizonDays: HORIZON_DAYS,
        resolveFireTime: resolve,
        // `showTitle` de geçiliyor: ortak yedek metin (`copy.fallback`) onu
        // kullanıyor ve filme özel bir yedek yazmaya değmez.
        renderCopy: (vars) => copy.render({ title: vars.title, showTitle: vars.title }),
      }),
    );
    copy.commit();
  }

  // ── Aylık izleme özeti (§ 14) ──────────────────────────────────────────
  // ⚠️ Anlık görüntü, kategori KAPALI olsa bile alınır: kullanıcı özeti
  // sonradan açtığında elde bir taban bulunsun, ilk ayını boşa geçirmesin.
  const statsResult = evaluateMonthlyStats(
    await loadStatsSnapshot(),
    input.userStats
      ? {
          episodeMinutes: input.userStats.episodes?.minutes ?? 0,
          movieMinutes: input.userStats.movies?.minutes ?? 0,
          episodesWatched: input.userStats.episodes?.watched ?? 0,
          moviesWatched: input.userStats.movies?.watched ?? 0,
        }
      : null,
    now,
    STATS_PERIOD_DAYS,
  );

  if (statsMeta && statsResult.report) {
    const copy = makeCopyRenderer(statsMeta);
    plans.push(
      ...planMonthlyStats(statsResult.report, {
        now,
        snapToPreferredHour: snapHour,
        renderCopy: (vars) =>
          copy.render({
            hours: vars.hours,
            episodes: vars.episodes,
            movies: vars.movies,
            periodDays: vars.periodDays,
          }),
      }),
    );
    copy.commit();
  }

  return { plans, copyHistory: history, nextStatsSnapshot: statsResult.nextSnapshot };
}

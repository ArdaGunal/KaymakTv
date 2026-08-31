import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { logError } from '../../../utils/errorLog';
import { ensureNotificationChannels } from '../channels';
import { loadLedger, saveLedger } from '../inbox/ledger';
import { buildLedger, sweepLedger } from '../inbox/sweep';
import { ensureInboxHydrated, useInboxStore } from '../inbox/useInboxStore';
import { loadCopyHistory, saveCopyHistory } from '../copy/history';
import { pickVariant, pushRecent } from '../copy/picker';
import { COPY_POOL, variantBodyKey, variantTitleKey } from '../copy/pool';
import { interpolate } from '../copy/interpolate';
import { mergeRemotePool } from '../copy/remoteSchema';
import { loadCachedRemotePool, refreshRemotePool } from '../copy/remotePool';
import { getPermissionStatus, requestPermission } from '../permissions';
import { NOTIFICATION_CATEGORIES, getActiveCategories } from '../registry';
import { applyBudget } from '../retention/budget';
import { dedupeByEntity } from '../retention/dedupe';
import { resolveFireTime, snapToPreferredHour } from '../scheduling/fireTime';
import { throttlePlans } from '../scheduling/throttle';
import {
  buildWatchedEpisodeKeys,
  buildWatchedMovieIds,
  mapCalendarToUpcoming,
  mapCalendarToUpcomingMovies,
} from '../scheduling/mapCalendar';
import { planEpisodeToday, planSeasonPremiere } from '../scheduling/planners/episodePlanners';
import { planMovieRelease } from '../scheduling/planners/movieReleasePlanner';
import { planContinueWatching } from '../scheduling/planners/continueWatchingPlanner';
import { pickResumeCandidate } from '../scheduling/mapProgress';
import { planMonthlyStats } from '../scheduling/planners/monthlyStatsPlanner';
import { evaluateMonthlyStats } from '../stats/snapshot';
import { loadStatsSnapshot, saveStatsSnapshot } from '../stats/snapshotStore';
import { applyPlans, cancelAllOwnedNotifications } from '../scheduling/scheduler';
import { ensurePushPrefsHydrated, usePushPrefsStore } from '../store/usePushPrefsStore';
import type { ScheduledPlan } from '../types';

/**
 * Bildirim sisteminin TEK orkestrasyon noktası
 * (docs/design/notifications.md § 2).
 *
 * Akış: izin kontrol → Android kanalları → takvimi eşle → planla → bütçele →
 * farkı uygula.
 *
 * 🔴 MİSAFİR KONTROLÜ YALNIZCA BURADA. Planlayıcılara, store'a ya da
 * zamanlayıcıya misafir kontrolü EKLEME — Madde 268'in kuralı bu
 * (aynı hata çağrı yerlerine dağıtıldığı için üç kez geri geldi).
 *
 * 🔴 401 TUZAĞINA DÜŞMEZ: bu hook Trakt'a HİÇ istek atmaz. Veriyi
 * `useLibraryStore`'un zaten bellekte tuttuğu senkron çıktısından okur.
 */

/** Kaç günlük ufuk planlanır. Takvim senkronu 33 gün çekiyor; altında kalıyoruz. */
const HORIZON_DAYS = 30;

/** Kaç gün uygulamaya girilmezse "kaldığın yerden devam" dürtmesi düşer. */
const NUDGE_AWAY_DAYS = 7;

/** İki dürtme arasındaki en kısa süre — kullanıcının açık "rahatsız etmesin" talebi. */
const NUDGE_COOLDOWN_DAYS = 30;

/** Aylık özet için iki anlık görüntü arasında geçmesi gereken en kısa süre. */
const STATS_PERIOD_DAYS = 28;

// Uygulama ÖN PLANDAYKEN gelen bildirimin ne olacağını belirler. Bu handler
// kurulmazsa iOS bildirimi ön planda HİÇ göstermez — "test ederken gelmiyor"
// şikayetinin klasik sebebi. Modül seviyesinde bir kez kurulur.
//
// 🔴 PLATFORM KAPISI ŞART: bu satır modül YÜKLENİRKEN çalışır ve bu hook
// `app/(protected)/_layout.tsx`'ten import ediliyor — yani TÜM korumalı
// ekranların yükleme yolunda. Web'de `expo-notifications` no-op olduğundan
// buradan gelecek bir hata, bildirimle hiç ilgisi olmayan web kullanıcısına
// beyaz ekran olarak yansırdı.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function useNotificationSetup(accessToken: string | null, isGuest: boolean): void {
  const { t, i18n } = useTranslation('notifications');
  const prefs = usePushPrefsStore((state) => state.prefs);
  const isHydrated = usePushPrefsStore((state) => state.isHydrated);
  const markPermissionPrompted = usePushPrefsStore((state) => state.markPermissionPrompted);
  const markNudgeFired = usePushPrefsStore((state) => state.markNudgeFired);
  const calendarShows = useLibraryStore((state) => state.calendarShows);
  const watchedShows = useLibraryStore((state) => state.watchedShows);
  const calendarMovies = useLibraryStore((state) => state.calendarMovies);
  const watchedMovies = useLibraryStore((state) => state.watchedMovies);
  const showProgressMap = useLibraryStore((state) => state.showProgressMap);
  const hiddenShowIds = useLibraryStore((state) => state.hiddenShowIds);
  const userStats = useLibraryStore((state) => state.userStats);

  // Aynı planı arka arkaya uygulamayı önler. Fark hesabı zaten ucuz ama
  // `getAllScheduledNotificationsAsync` bir köprü çağrısı; her render'da
  // tetiklenmesi gereksiz.
  const lastSignatureRef = useRef<string>('');

  const replan = useCallback(async () => {
    // Web'de `expo-notifications` no-op; boşuna iş yapma.
    if (Platform.OS === 'web') return;

    // 🔴 TEK MİSAFİR KONTROLÜ. Misafirin Trakt takvimi yoktur.
    if (!accessToken || isGuest) return;

    await ensurePushPrefsHydrated();

    try {
      // ── Defter süpürme: hangi bildirimler DÜŞTÜ? ──────────────────────
      // Tercihlerden ve izinden BAĞIMSIZ olarak her turda çalışır: kullanıcı
      // bildirimleri sonradan kapatmış olsa bile, daha önce düşmüş olanlar
      // uygulama içi listede görünmeye devam etmelidir.
      const ledger = await loadLedger();
      const { fired, pending } = sweepLedger(ledger, Date.now());
      if (fired.length > 0) {
        await ensureInboxHydrated();
        useInboxStore.getState().ingest(fired);

        // Dürtme düştüyse soğuma penceresini başlat — iki dürtme arasında en
        // az `NUDGE_COOLDOWN_DAYS` gün olsun (bkz. continueWatchingPlanner).
        const nudge = fired.find((entry) => entry.categoryId === 'continueWatching');
        if (nudge) markNudgeFired(nudge.fireAt);
      }

      if (!prefs.masterEnabled) {
        // Ana anahtar kapalı: kurulu her şey iptal edilir ama TERCİHLER
        // korunur (bkz. usePushPrefsStore). Defter de boşaltılır — artık
        // bekleyen bildirim yok.
        await cancelAllOwnedNotifications();
        await saveLedger([]);
        lastSignatureRef.current = 'master-off';
        return;
      }

      // ── İzin: ilk açılışta BİR KEZ sor ────────────────────────────────
      // Kullanıcı kararı 2026-08-31: izin, Ayarlar'da bir anahtar açılırken
      // değil uygulamaya girildiğinde istensin; ama "sürekli sormasın".
      //
      // Burası doğru an: bu hook `app/(protected)/_layout.tsx`'te yaşıyor,
      // yani kullanıcı giriş yapmış ve ana ekrana inmiş demektir. Uygulamanın
      // ilk saniyesinde, daha hiçbir şey görmeden diyalog göstermiyoruz.
      //
      // 🔴 SONUÇ NE OLURSA OLSUN İŞARETLENİR — bir daha otomatik sorulmaz.
      // (Ayarlar'dan elle anahtar açmak bundan bağımsız; o açık bir niyet
      // beyanıdır ve izni yeniden ister.)
      let permission = await getPermissionStatus();
      if (permission === 'undetermined' && prefs.permissionPromptedAt === null) {
        permission = await requestPermission();
        markPermissionPrompted();
      }

      // İzin yoksa plan kurmaya çalışmak sessiz bir başarısızlık olurdu.
      // Kullanıcı durumu Ayarlar ekranında görüyor (§ 6).
      if (permission !== 'granted') {
        // Düşenler ayıklandı, kalanlar defterde kalsın.
        await saveLedger(pending);
        lastSignatureRef.current = `no-permission:${permission}`;
        return;
      }

      await ensureNotificationChannels(t);

      const active = getActiveCategories(prefs);
      const now = Date.now();
      const plans: ScheduledPlan[] = [];

      // Metin havuzunun "son gösterilenler" geçmişi (§ 4). Planlama turunun
      // BAŞINDA bir kez okunur, SONUNDA bir kez yazılır.
      const history = await loadCopyHistory();
      const resolve = (iso: string) => resolveFireTime(iso, prefs.preferredHour, now);

      // Uzak havuz ÖNBELLEKTEN okunur — ağ beklenmez. Tazeleme aşağıda,
      // bildirimler kurulduktan SONRA yapılır (§ 15).
      const remotePool = await loadCachedRemotePool();
      const copyPool = mergeRemotePool(COPY_POOL, remotePool, i18n.language);

      /**
       * Bir kategori için metin üreticisi. Kategori başına ayrı bir "son
       * gösterilenler" listesi tutar ve tur boyunca günceller — aynı
       * planlamada kurulan 20 bildirimin hepsine aynı metnin düşmemesi
       * buna bağlı.
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

            // Uzak varyantın metni kendisiyle gelir ve i18n'den GEÇMEZ;
            // bu yüzden yer tutucuları `interpolate` dolduruyor — beyaz
            // listeli, kırpılmış ve temizlenmiş biçimde (§ 15 güvenlik).
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

      const episodeMeta = active.find((category) => category.id === 'episodeToday');
      const premiereMeta = active.find((category) => category.id === 'seasonPremiere');
      const movieMeta = active.find((category) => category.id === 'movieRelease');

      if (episodeMeta || premiereMeta) {
        const watchedKeys = buildWatchedEpisodeKeys(watchedShows ?? []);
        const upcoming = mapCalendarToUpcoming(calendarShows ?? [], watchedKeys);

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

      const resumeMeta = active.find((category) => category.id === 'continueWatching');
      if (resumeMeta) {
        const candidate = pickResumeCandidate(
          watchedShows ?? [],
          showProgressMap ?? {},
          hiddenShowIds ?? [],
        );
        const copy = makeCopyRenderer(resumeMeta);

        plans.push(
          ...planContinueWatching(candidate, {
            now,
            awayDays: NUDGE_AWAY_DAYS,
            cooldownDays: NUDGE_COOLDOWN_DAYS,
            lastNudgeFiredAt: prefs.lastNudgeFiredAt,
            snapToPreferredHour: (target) => snapToPreferredHour(target, prefs.preferredHour),
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

      // ── Aylık izleme özeti ────────────────────────────────────────────
      // Anlık görüntü, kategori KAPALI olsa bile alınmalı: kullanıcı özeti
      // sonradan açtığında elde bir taban bulunsun, ilk ayı boşa geçmesin.
      const statsMeta = active.find((category) => category.id === 'monthlyStats');
      const previousSnapshot = await loadStatsSnapshot();
      const statsResult = evaluateMonthlyStats(
        previousSnapshot,
        userStats
          ? {
              episodeMinutes: userStats.episodes?.minutes ?? 0,
              movieMinutes: userStats.movies?.minutes ?? 0,
              episodesWatched: userStats.episodes?.watched ?? 0,
              moviesWatched: userStats.movies?.watched ?? 0,
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
            snapToPreferredHour: (target) => snapToPreferredHour(target, prefs.preferredHour),
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

      if (statsResult.nextSnapshot) {
        await saveStatsSnapshot(statsResult.nextSnapshot);
      }

      if (movieMeta) {
        const watchedMovieIds = buildWatchedMovieIds(watchedMovies ?? []);
        const upcomingMovies = mapCalendarToUpcomingMovies(calendarMovies ?? [], watchedMovieIds);
        const copy = makeCopyRenderer(movieMeta);

        plans.push(
          ...planMovieRelease(upcomingMovies, {
            now,
            horizonDays: HORIZON_DAYS,
            resolveFireTime: resolve,
            // `showTitle` de geçiliyor: ortak yedek metin (`copy.fallback`)
            // onu kullanıyor ve filme özel bir yedek yazmaya değmez.
            renderCopy: (vars) => copy.render({ title: vars.title, showTitle: vars.title }),
          }),
        );
        copy.commit();
      }

      await saveCopyHistory(history);

      // 🔑 SIRA ÖNEMLİ: önce tekilleştir, sonra bütçele. Ters sırada, aynı
      // bölüm için üretilmiş iki planın İKİSİ birden kota yer ve elenen
      // kopya yüzünden gerçekte daha az bildirim kurulurdu.
      const deduped = dedupeByEntity(plans, NOTIFICATION_CATEGORIES);

      // Bildirim yorgunluğu koruması: aynı gün + aynı kategoride 3+ bildirim
      // tek özete iner, sonra günlük tavan uygulanır (§ 7).
      const throttled = throttlePlans(deduped, NOTIFICATION_CATEGORIES, {
        renderSummary: ({ categoryId, count }) => ({
          title: t(`summary.${categoryId}.title`, { count }),
          body: t(`summary.${categoryId}.body`, { count }),
          // Özet tek bir içeriğe değil, o türün listesine götürür.
          deepLink:
            categoryId === 'movieRelease'
              ? '/(protected)/(tabs)/movies'
              : '/(protected)/(tabs)/shows',
        }),
      });

      const budgeted = applyBudget(throttled, NOTIFICATION_CATEGORIES);

      // İmza: aynı plan kümesi ikinci kez uygulanmasın.
      const signature = budgeted.map((plan) => `${plan.identifier}@${plan.fireAt}`).join('|');
      if (signature === lastSignatureRef.current) return;

      await applyPlans(budgeted);

      // 🔴 SIRA BİLİNÇLİ: uzak havuz tazelemesi bildirimler kurulduktan SONRA.
      // Ağı beklemek, kötü bağlantıda planlamayı geciktirir; yeni metinler bir
      // sonraki turda devreye girer ve hiçbir şey kaybolmaz.
      void refreshRemotePool(NOTIFICATION_CATEGORIES.map((category) => category.id), now);
      // Defter = ARTIK KURULU OLAN plan kümesi. Bir sonraki açılışta bu
      // kayıtlardan vakti geçmiş olanlar "düştü" sayılacak (bkz. inbox/sweep.ts).
      await saveLedger(buildLedger(budgeted));
      lastSignatureRef.current = signature;
    } catch (error) {
      // Bildirim planlaması uygulamanın geri kalanını ASLA çökertmemeli.
      logError('useNotificationSetup.replan', error);
    }
  }, [accessToken, isGuest, prefs, calendarShows, watchedShows, calendarMovies, watchedMovies, showProgressMap, hiddenShowIds, userStats, markPermissionPrompted, markNudgeFired, t, i18n.language]);

  // Tercihler diskten okunmadan planlamak, kullanıcının kapattığı bir
  // kategoriyi bir kez de olsa kurmak demek olurdu.
  useEffect(() => {
    if (!isHydrated) return;
    void replan();
  }, [isHydrated, replan]);

  // Uygulama öne geldiğinde yeniden planla: yuvarlanan ufkun kayması,
  // izlenen bölümlerin düşmesi ve ertelenen yayınların düzelmesi buna bağlı.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void replan();
    });
    return () => subscription.remove();
  }, [replan]);
}

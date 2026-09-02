import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { logError } from '../../../utils/errorLog';
import { ensureNotificationChannels } from '../channels';
import { saveCopyHistory } from '../copy/history';
import { refreshRemotePool } from '../copy/remotePool';
import { NOTIFICATION_CATEGORIES } from '../registry';
import { buildNotificationPlans } from '../scheduling/buildPlans';
import { saveStatsSnapshot } from '../stats/snapshotStore';
import { loadLedger, saveLedger } from '../inbox/ledger';
import { buildLedger, sweepLedger } from '../inbox/sweep';
import { ensureInboxHydrated, useInboxStore } from '../inbox/useInboxStore';
import { getPermissionStatus, requestPermission } from '../permissions';
import { applyBudget } from '../retention/budget';
import { dedupeByEntity } from '../retention/dedupe';
import { throttlePlans } from '../scheduling/throttle';
import { applyPlans, cancelAllOwnedNotifications } from '../scheduling/scheduler';
import { ensurePushPrefsHydrated, usePushPrefsStore } from '../store/usePushPrefsStore';

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
  const hiddenMovieIds = useLibraryStore((state) => state.hiddenMovieIds);
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

      const now = Date.now();

      // ── Planları üret ─────────────────────────────────────────────────
      // Karar mantığı `scheduling/buildPlans.ts`'te: bu dosya 400 satır
      // sınırını aşmıştı ve ayrım aynı zamanda doğru sorumluluk sınırı —
      // orası NE kurulacağına karar verir, burası yan etkiyi yönetir.
      const built = await buildNotificationPlans({
        prefs,
        now,
        translate: t,
        language: i18n.language,
        calendarShows: calendarShows ?? [],
        watchedShows: watchedShows ?? [],
        calendarMovies: calendarMovies ?? [],
        watchedMovies: watchedMovies ?? [],
        showProgressMap: showProgressMap ?? {},
        hiddenShowIds: hiddenShowIds ?? [],
        hiddenMovieIds: hiddenMovieIds ?? [],
        userStats: userStats ?? null,
      });
      const plans = built.plans;

      // Anlık görüntü plan imzasından BAĞIMSIZ — hemen yazılır.
      if (built.nextStatsSnapshot) {
        await saveStatsSnapshot(built.nextStatsSnapshot);
      }

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

      // 🔴 METİN GEÇMİŞİ İMZA KONTROLÜNDEN SONRA YAZILIR — 2026-08-31'de
      // düzeltilen gerçek bir hata:
      //
      // Bu fonksiyon her uygulama açılışında ve her öne gelişte çalışır ama
      // ÇOĞU turda yeni bir şey kurmaz (imza aynı → yukarıda `return`).
      // `saveCopyHistory` eskiden imza kontrolünün ÜSTÜNDEYDİ; yani her turda
      // yeni varyantlar seçilip "son gösterilenler" halkasına yazılıyor, sonra
      // planlar uygulanmadığı için o metinler kullanıcıya HİÇ GÖSTERİLMİYORDU.
      //
      // Sonuç, tam da önlemek istediğimiz şeydi: halka görülmemiş varyantlarla
      // dolduğu için `picker` onları dışlıyor, dışlama listesi tükenince de
      // "hepsini yok say" dalına düşüyordu — yani ÇEŞİTLİLİK ARTMIYOR,
      // AZALIYORDU. Geçmiş artık yalnızca gerçekten kurulan bildirimler için
      // ilerliyor.
      await saveCopyHistory(built.copyHistory);

      const applied = await applyPlans(budgeted);

      // 🔴 SIRA BİLİNÇLİ: uzak havuz tazelemesi bildirimler kurulduktan SONRA.
      // Ağı beklemek, kötü bağlantıda planlamayı geciktirir; yeni metinler bir
      // sonraki turda devreye girer ve hiçbir şey kaybolmaz.
      void refreshRemotePool(NOTIFICATION_CATEGORIES.map((category) => category.id), now);
      // Defter = ARTIK KURULU OLAN plan kümesi. Bir sonraki açılışta bu
      // kayıtlardan vakti geçmiş olanlar "düştü" sayılacak (bkz. inbox/sweep.ts).
      // 🔴 Defter, İSTENEN plandan değil GERÇEKTEN KURULANDAN üretilir.
      // Kurulamayan bir plan defterde kalsaydı, süpürme onu vakti gelince
      // "düştü" sayar ve kullanıcı hiç düşmemiş bir bildirimi uygulama içi
      // listede görürdü.
      await saveLedger(buildLedger(applied.applied));
      lastSignatureRef.current = signature;
    } catch (error) {
      // Bildirim planlaması uygulamanın geri kalanını ASLA çökertmemeli.
      logError('useNotificationSetup.replan', error);
    }
  }, [accessToken, isGuest, prefs, calendarShows, watchedShows, calendarMovies, watchedMovies, showProgressMap, hiddenShowIds, hiddenMovieIds, userStats, markPermissionPrompted, markNudgeFired, t, i18n.language]);

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

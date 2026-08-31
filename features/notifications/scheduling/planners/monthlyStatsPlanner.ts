import type { ScheduledPlan } from '../../types';
import type { MonthlyReport } from '../../stats/snapshot';

/**
 * "Aylık İzleme Özeti" planlayıcısı (docs/design/notifications.md § 14).
 *
 * Girdi rakamları `stats/snapshot.ts`'te GERÇEK verilerden hesaplanır
 * (tüm zamanların toplam dakikasının iki anlık görüntü arasındaki farkı) —
 * tahmin ya da yaklaşık değer YOK.
 *
 * 🔴 SAF: yalnızca `import type`.
 */

export interface MonthlyStatsCopyVars {
  /** Tam saate yuvarlanmış izleme süresi — metinde "45 saat" diye geçer. */
  hours: number;
  minutes: number;
  episodes: number;
  movies: number;
  periodDays: number;
}

export interface MonthlyStatsOptions {
  now: number;
  /** `scheduling/fireTime.ts` → `snapToPreferredHour`, saati bağlanmış halde. */
  snapToPreferredHour: (targetMs: number) => number;
  renderCopy: (vars: MonthlyStatsCopyVars) => { title: string; body: string };
}

export function planMonthlyStats(
  report: MonthlyReport | null,
  options: MonthlyStatsOptions,
): ScheduledPlan[] {
  if (!report || report.minutes <= 0) return [];

  const fireAt = options.snapToPreferredHour(options.now);
  if (!Number.isFinite(fireAt)) return [];

  const { title, body } = options.renderCopy({
    // Yuvarlama BİLİNÇLİ: "45 saat" okunur, "2.718 dakika" okunmaz.
    hours: Math.round(report.minutes / 60),
    minutes: report.minutes,
    episodes: report.episodes,
    movies: report.movies,
    periodDays: report.periodDays,
  });

  // Gün bazlı DETERMİNİSTİK kimlik: aynı gün için ikinci bir özet kurulamaz.
  const day = new Date(fireAt);
  const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

  return [
    {
      identifier: `monthlyStats:${dayKey}`,
      categoryId: 'monthlyStats',
      fireAt,
      title,
      body,
      data: {
        categoryId: 'monthlyStats',
        entityId: dayKey,
        // Kullanıcı sayıyı görünce ayrıntısını merak eder — istatistik ekranı.
        deepLink: '/(protected)/profile/statistics',
        plannedFireAt: fireAt,
      },
    },
  ];
}

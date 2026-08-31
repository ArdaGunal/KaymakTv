import type { NotificationCategoryId, NotificationCategoryMeta, ScheduledPlan } from '../types';

/**
 * Bildirim yorgunluğu koruması (docs/design/notifications.md § 7).
 *
 * 🔴 ÇÖZÜLEN SOMUT SORUN: takip listesi yoğun bir kullanıcının bugün 6 bölümü
 * varsa, saat 20:00'de arka arkaya 6 bildirim düşüyordu. Bildirimi kapattıran
 * davranışların başında bu gelir.
 *
 * İKİ KURAL, bu sırayla:
 *   1. TOPLULAŞTIRMA — aynı gün + aynı kategoride N+ bildirim → TEK özet
 *   2. GÜNLÜK TAVAN — toplulaştırmadan sonra hâlâ fazlaysa, düşük öncelikli düşer
 *
 * Sıra önemli: önce tavanı uygulasaydık, toplulaştırılabilecek bildirimler
 * kotayı doldurup prömiyer gibi yüksek öncelikli haberleri dışarı iterdi.
 *
 * 🔴 SAF: yalnızca `import type` (gerekçe: `fireTime.ts` başlığı).
 */

/** Aynı gün + aynı kategoride kaç bildirimden sonra özete dönülür. */
export const AGGREGATE_THRESHOLD = 3;

/** Bir günde en fazla kaç bildirim gönderilir. */
export const DAILY_CAP = 3;

/**
 * Planın düştüğü YEREL günün anahtarı.
 * UTC kullanmak, Türkiye'de gece 01:00'de düşen bir bildirimi "dün" saymak
 * demek olurdu — gün grupları kullanıcının takvimine göre olmalı.
 */
export function localDayKey(fireAt: number): string {
  const d = new Date(fireAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface SummaryInput {
  categoryId: NotificationCategoryId;
  count: number;
  fireAt: number;
}

export interface ThrottleOptions {
  aggregateThreshold?: number;
  dailyCap?: number;
  /**
   * Özet bildiriminin metnini ve hedefini üretir (i18n + rota bilgisi
   * gerektirdiği için enjekte ediliyor). `null` dönerse toplulaştırma
   * YAPILMAZ ve tekil bildirimler korunur — metin üretilemediği için
   * kullanıcıyı bildirimsiz bırakmak en kötü sonuç olurdu.
   */
  renderSummary: (input: SummaryInput) => { title: string; body: string; deepLink: string } | null;
}

export function throttlePlans(
  plans: readonly ScheduledPlan[],
  categoryMetas: readonly NotificationCategoryMeta[],
  options: ThrottleOptions,
): ScheduledPlan[] {
  const threshold = options.aggregateThreshold ?? AGGREGATE_THRESHOLD;
  const cap = options.dailyCap ?? DAILY_CAP;
  const priorityOf = new Map(categoryMetas.map((meta) => [meta.id, meta.priority]));

  // ── 1) Gün + kategori bazında topluluştur ────────────────────────────
  const groups = new Map<string, ScheduledPlan[]>();
  for (const plan of plans) {
    const key = `${localDayKey(plan.fireAt)}|${plan.categoryId}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(plan);
    else groups.set(key, [plan]);
  }

  const afterAggregate: ScheduledPlan[] = [];

  for (const [key, bucket] of groups) {
    if (bucket.length < threshold) {
      afterAggregate.push(...bucket);
      continue;
    }

    // Özet, grubun EN ERKEN anında gider: kullanıcı günün ilk bölümü
    // yayınlandığında haberdar olsun, en geç olanı beklemesin.
    const fireAt = Math.min(...bucket.map((plan) => plan.fireAt));
    const categoryId = bucket[0].categoryId;
    const summary = options.renderSummary({ categoryId, count: bucket.length, fireAt });

    if (!summary) {
      afterAggregate.push(...bucket);
      continue;
    }

    const dayKey = key.split('|')[0];
    afterAggregate.push({
      // Deterministik: aynı gün için ikinci bir özet kurulamaz.
      identifier: `${categoryId}:summary:${dayKey}`,
      categoryId,
      fireAt,
      title: summary.title,
      body: summary.body,
      data: {
        categoryId,
        entityId: `summary:${dayKey}`,
        deepLink: summary.deepLink,
        plannedFireAt: fireAt,
      },
    });
  }

  // ── 2) Günlük tavan ──────────────────────────────────────────────────
  const byDay = new Map<string, ScheduledPlan[]>();
  for (const plan of afterAggregate) {
    const day = localDayKey(plan.fireAt);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(plan);
    else byDay.set(day, [plan]);
  }

  const result: ScheduledPlan[] = [];
  for (const bucket of byDay.values()) {
    if (bucket.length <= cap) {
      result.push(...bucket);
      continue;
    }
    // Yüksek öncelikli kalır (prömiyer > film > günlük bölüm); eşitlikte
    // en erken tarihli — sonuç girdi sırasından bağımsız ve deterministik
    // olsun diye (aksi halde `scheduler` gereksiz iptal/yeniden kurma yapardı).
    const sorted = bucket.slice().sort((a, b) => {
      const pa = priorityOf.get(a.categoryId) ?? 0;
      const pb = priorityOf.get(b.categoryId) ?? 0;
      if (pa !== pb) return pb - pa;
      if (a.fireAt !== b.fireAt) return a.fireAt - b.fireAt;
      return a.identifier.localeCompare(b.identifier);
    });
    result.push(...sorted.slice(0, cap));
  }

  return result;
}

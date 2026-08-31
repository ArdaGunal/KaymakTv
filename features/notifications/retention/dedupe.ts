import type { NotificationCategoryMeta, ScheduledPlan } from '../types';

/**
 * Aynı içerik için İKİ bildirim kurulmasını engeller.
 *
 * 🔴 SOMUT HATA: bir sezon prömiyeri hem `seasonPremiere` hem `episodeToday`
 * planlayıcısının kapsamına girer. İkisi de açıkken kullanıcı AYNI bölüm için
 * arka arkaya iki bildirim alırdı — bildirimi kapattıran davranışların
 * başında gelir ve her yeni kategoride bu risk tekrar doğar.
 *
 * Çözüm kategori bazında değil, VARLIK bazında: her varlığa en fazla bir plan.
 *
 * 🔴 SAF: yalnızca `import type`.
 */

/**
 * Varlık kimliği olarak `deepLink` kullanılıyor, `entityId` DEĞİL.
 * Sebep: Trakt kimlikleri tür içinde benzersizdir, türler arasında değil —
 * 123 numaralı bölüm ile 123 numaralı film farklı şeylerdir ama `entityId`
 * ikisinde de "123". `deepLink` (`/episode/123` vs `/movie/123`) türü de
 * taşıdığı için çakışma yapısal olarak imkânsız.
 */
const entityKey = (plan: ScheduledPlan): string => plan.data.deepLink;

/**
 * @param plans         Tüm planlayıcıların birleşik çıktısı
 * @param categoryMetas Öncelik kaynağı (kayıt defteri)
 */
export function dedupeByEntity(
  plans: readonly ScheduledPlan[],
  categoryMetas: readonly NotificationCategoryMeta[],
): ScheduledPlan[] {
  const priorityOf = new Map(categoryMetas.map((meta) => [meta.id, meta.priority]));

  const winners = new Map<string, ScheduledPlan>();

  for (const plan of plans) {
    const key = entityKey(plan);
    const current = winners.get(key);
    if (!current) {
      winners.set(key, plan);
      continue;
    }

    // Kayıt defterinde olmayan kategori 0 öncelik alır — böylece defterde
    // tanımlı bir kategori her zaman kazanır.
    const candidatePriority = priorityOf.get(plan.categoryId) ?? 0;
    const currentPriority = priorityOf.get(current.categoryId) ?? 0;

    if (candidatePriority > currentPriority) {
      winners.set(key, plan);
      continue;
    }

    // Eşit öncelikte EN ERKEN tarihli kazanır: sonuç girdi sırasından
    // bağımsız ve deterministik olsun (aksi halde aynı veriyle iki farklı
    // plan üretilebilir ve `scheduler` gereksiz yere iptal/yeniden kurma
    // yapardı).
    if (candidatePriority === currentPriority && plan.fireAt < current.fireAt) {
      winners.set(key, plan);
    }
  }

  return [...winners.values()];
}

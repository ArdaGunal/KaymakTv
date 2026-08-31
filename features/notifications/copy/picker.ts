import type { CopyVariant } from './pool';
import type { NotificationCategoryId, NotificationTone } from '../types';

/**
 * Metin varyantı seçici (docs/design/notifications.md § 4).
 *
 * 🔴 SAF: yalnızca `import type`. Rastgelelik bile `random` parametresiyle
 * dışarıdan geliyor — aksi halde davranış test edilemezdi.
 *
 * Sıra:
 *   1. kategori + ton + tarih penceresi süzgeci
 *   2. SON GÖSTERİLENLERİ DIŞLA  ← çeşitlilik hissini veren asıl adım
 *   3. ağırlıklı rastgele seçim
 *   4. hepsi elendiyse dışlamayı yok say — ASLA boş dönme
 */

/** 'AA-GG' dizgesini yılın kaçıncı günü olduğuna bakmadan karşılaştırılabilir bir sayıya çevirir. */
const toMonthDay = (value: string): number | null => {
  const match = /^(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return month * 100 + day;
};

/**
 * Varyant bugün geçerli mi?
 *
 * Yıl sınırını AŞAN pencereler (12-20 → 01-05) bilinçli olarak destekleniyor:
 * yılbaşı gibi en değerli mevsimsel pencere tam olarak yıl sınırına oturuyor.
 * Bu durumda "from <= bugün VEYA bugün <= until" mantığı geçerli.
 */
export function isVariantActive(variant: CopyVariant, now: Date): boolean {
  if (!variant.activeFrom && !variant.activeUntil) return true;

  const from = variant.activeFrom ? toMonthDay(variant.activeFrom) : null;
  const until = variant.activeUntil ? toMonthDay(variant.activeUntil) : null;
  // Bozuk pencere tanımı varyantı sessizce kaybetmesin: her zaman aktif say.
  if (from === null || until === null) return true;

  const today = (now.getMonth() + 1) * 100 + now.getDate();

  return from <= until
    ? today >= from && today <= until
    : today >= from || today <= until;
}

/**
 * Ton bir TAVANDIR, birebir eşleşme değil.
 *
 * - Kategori `playful` ise hem şakacı hem nötr varyantlar kullanılabilir —
 *   böylece havuz tek düze olmaz ve esprili varyantlar yıpranmaz.
 * - Kategori `neutral` ise YALNIZCA nötr varyantlar. Bu yön kritik:
 *   "Kaldığın yerden devam" gibi bir dürtmeye şakacı bir metin düşerse
 *   kullanıcıya sitem ediyormuş gibi okunur.
 *
 * Birebir eşleştirseydik havuzdaki nötr varyantlar hiçbir zaman seçilmez,
 * yani ölü veri olurdu.
 */
const allowedTones = (tone: NotificationTone): readonly NotificationTone[] =>
  tone === 'playful' ? ['playful', 'neutral'] : ['neutral'];

export interface PickOptions {
  categoryId: NotificationCategoryId;
  /** Kategorinin ton TAVANI (bkz. `allowedTones`). */
  tone: NotificationTone;
  now: Date;
  /** Son gösterilen varyant id'leri (en yenisi başta). */
  recentIds: readonly string[];
  /** `Math.random` yerine enjekte edilir — testin sonucu sabitleyebilmesi için. */
  random: () => number;
}

export function pickVariant(
  variants: readonly CopyVariant[],
  options: PickOptions,
): CopyVariant | null {
  const tones = allowedTones(options.tone);
  const eligible = variants.filter(
    (variant) =>
      variant.category === options.categoryId &&
      tones.includes(variant.tone) &&
      variant.weight > 0 &&
      isVariantActive(variant, options.now),
  );

  if (eligible.length === 0) return null;

  // 🔑 SAF RASTGELE SEÇİM ŞAŞIRTICI SIKLIKTA TEKRAR EDER. 5 varyantla arka
  // arkaya aynı metni görme olasılığı %20; kullanıcı bunu "hep aynı şeyi
  // yazıyor" diye algılar. Son gösterilenleri dışlamak, çeşitlilik hissini
  // ağırlık ayarından çok daha fazla artırır.
  const recent = new Set(options.recentIds);
  const fresh = eligible.filter((variant) => !recent.has(variant.id));

  // Hepsi yakın zamanda gösterildiyse dışlamayı yok say. Boş dönmek,
  // bildirimin metinsiz kalması demek olurdu.
  const pool = fresh.length > 0 ? fresh : eligible;

  const totalWeight = pool.reduce((sum, variant) => sum + variant.weight, 0);
  // `random()` [0,1) aralığında; hile yapan bir uygulama 1 döndürse bile
  // son elemana düşsün diye aşağıda son eleman yedeği var.
  let ticket = options.random() * totalWeight;

  for (const variant of pool) {
    ticket -= variant.weight;
    if (ticket < 0) return variant;
  }

  return pool[pool.length - 1];
}

/** Kategori başına saklanan "son gösterilenler" halkasının uzunluğu. */
export const RECENT_MEMORY = 3;

/**
 * Yeni seçilen varyantı geçmişin başına ekler, halkayı taşırmadan kırpar.
 *
 * SAF ve YERİNDE DEĞİŞTİRMEZ: `history.ts` bunu diske yazmadan önce çağırır,
 * `useNotificationSetup` ise TEK BİR planlama turu içinde art arda çağırır —
 * böylece aynı turda kurulan 20 bildirim aynı metni almaz.
 */
export function pushRecent(
  recentIds: readonly string[],
  variantId: string,
): string[] {
  return [variantId, ...recentIds.filter((id) => id !== variantId)].slice(0, RECENT_MEMORY);
}

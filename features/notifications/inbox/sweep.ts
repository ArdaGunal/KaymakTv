import type { NotificationCategoryId, ScheduledPlan } from '../types';

/**
 * Düşmüş bildirimleri tespit eden saf katman
 * (docs/design/notifications.md § 11).
 *
 * 🔴 ÇÖZÜLEN SORUN: bildirim Android tepsisinde görünüyordu ama uygulama
 * içindeki zil listesinde izi kalmıyordu. Kullanıcı tepsideki bildirimi
 * kaydırıp attıysa haber tamamen kayboluyordu.
 *
 * 🔑 NEDEN "DEFTER" (ledger) YAKLAŞIMI:
 * `getAllScheduledNotificationsAsync()` yalnızca HENÜZ DÜŞMEMİŞ bildirimleri
 * döndürür — bir bildirim düştüğü anda o listeden çıkar, yani "ne düştü?"
 * sorusu oradan cevaplanamaz. `getPresentedNotificationsAsync()` ise yalnızca
 * tepside HÂLÂ DURANLARI verir; kullanıcı kaydırıp attıysa kayıptır.
 *
 * Bu yüzden her planlama turunda kurulan planların küçük bir kopyası diske
 * yazılıyor. Uygulama bir sonraki açılışında, vakti GEÇMİŞ defter kayıtları
 * "düşmüş" sayılıyor. Uygulama kapalıyken düşen bildirimler de böylece
 * yakalanıyor — bu yaklaşımın tek sebebi budur.
 *
 * 🔴 SAF: yalnızca `import type`, çalışma zamanı import'u yok
 * (gerekçe: `scheduling/fireTime.ts` başlığı).
 */

/** Defterde tutulan kompakt kayıt — bildirimin diske yazılan kopyası. */
export interface LedgerEntry {
  identifier: string;
  categoryId: NotificationCategoryId;
  fireAt: number;
  title: string;
  body: string;
  deepLink: string;
}

/** Uygulanan plan kümesinden defter üretir. */
export function buildLedger(plans: readonly ScheduledPlan[]): LedgerEntry[] {
  return plans.map((plan) => ({
    identifier: plan.identifier,
    categoryId: plan.categoryId,
    fireAt: plan.fireAt,
    title: plan.title,
    body: plan.body,
    deepLink: plan.data.deepLink,
  }));
}

export interface SweepResult {
  /** Vakti geçmiş — yani cihazda düşmüş kabul edilenler. */
  fired: LedgerEntry[];
  /** Hâlâ gelecekte olanlar; defterde kalmaya devam eder. */
  pending: LedgerEntry[];
}

/**
 * Defteri tarar: vakti geçenler "düştü", kalanlar bekliyor.
 *
 * ⚠️ İPTAL EDİLMİŞ PLANLAR SORUN DEĞİL: kullanıcı bölümü izlediği için
 * iptal edilen bir planın `fireAt`'i hâlâ GELECEKTEDİR, dolayısıyla "düştü"
 * sayılmaz — sonraki turda defter yeniden yazılınca sessizce düşer.
 * Uygulama kapalıyken iptal edilemeyip gerçekten düşmüş bir bildirim ise
 * doğru biçimde "düştü" sayılır; çünkü gerçekten düşmüştür.
 */
export function sweepLedger(
  entries: readonly LedgerEntry[],
  now: number,
): SweepResult {
  const fired: LedgerEntry[] = [];
  const pending: LedgerEntry[] = [];

  for (const entry of entries) {
    // Bozuk kayıt (elle kurcalanmış depolama) listeyi çökertmesin.
    if (!entry || typeof entry.fireAt !== 'number' || Number.isNaN(entry.fireAt)) continue;
    if (entry.fireAt <= now) fired.push(entry);
    else pending.push(entry);
  }

  // En yeni düşen başta: uygulama içi liste ters kronolojik gösteriliyor.
  fired.sort((a, b) => b.fireAt - a.fireAt);
  return { fired, pending };
}

/**
 * Aynı bildirimin listeye iki kez girmesini engeller.
 *
 * NEDEN GEREKLİ: kullanıcı uygulamayı arka arkaya açıp kapatırsa ya da bir
 * yeniden planlama turu araya girerse aynı defter kaydı iki kez süpürülebilir.
 * `identifier` deterministik olduğu için tekilleştirme güvenli.
 */
export function mergeIntoInbox<T extends { identifier: string }>(
  existing: readonly T[],
  incoming: readonly T[],
  maxItems: number,
): T[] {
  const seen = new Set(existing.map((item) => item.identifier));
  const fresh = incoming.filter((item) => !seen.has(item.identifier));
  return [...fresh, ...existing].slice(0, maxItems);
}

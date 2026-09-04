import type { NotificationCategoryId } from '../types';

/**
 * Tepsi temizliğinin SAF karar katmanı
 * (docs/design/notifications.md § 8-(2)).
 *
 * 🔴 SAF: yalnızca `import type`, çalışma zamanı import'u yok
 * (gerekçe: `inbox/sweep.ts` ve `scheduling/fireTime.ts` başlıkları).
 *
 * ==========================================================================
 * 🔴 NEDEN `cleanup.ts`'TEN AYRI BİR DOSYA
 * ==========================================================================
 * Tasarım dokümanı tek bir `retention/cleanup.ts` öngörüyordu. Kod yazılırken
 * ÖLÇÜLDÜ ki bu, kararı TEST EDİLEMEZ yapıyor: `tests/bildirimler/*.mjs`
 * dosyaları `.ts` modüllerini DOĞRUDAN import ediyor ve Node'un tür soyma
 * özelliği **uzantısız çalışma-zamanı import'larını çözemiyor**
 * (`ERR_MODULE_NOT_FOUND` — `planlama.test.mjs` başlığında yazılı).
 *
 * `cleanup.ts` zorunlu olarak `expo-notifications`, `react-native` ve
 * `../registry` import ediyor — yani testten hiç yüklenemezdi. Karar burada,
 * yan etki orada: `budget.ts`(SAF)/`scheduler.ts`(adaptör) ve
 * `sweep.ts`(SAF)/`useInboxStore.ts`(adaptör) ikilileriyle AYNI desen.
 */

/** Tepsideki bir bildirimden temizlik kararı için gereken asgari bilgi. */
export interface PresentedInfo {
  identifier: string;
  categoryId?: string | null;
}

/**
 * Tepsidekilerden HANGİLERİ temizlenmeli?
 *
 * 🔴 `ownedCategoryIds` PARAMETRE — modül seviyesinde `registry`'den
 * okunmuyor. İki sebep: (1) bu dosya saf kalsın, (2) kaynak tek olsun —
 * çağıran, `scheduler.ts`'in kullandığı AYNI listeyi geçirir. İki yerde iki
 * liste tutmak, bir kategori eklendiğinde birinin sessizce geride kalması
 * demekti.
 *
 * @param presented Tepside HÂLÂ duran bildirimler
 * @param ownedCategoryIds Bizim yönettiğimiz kategori kimlikleri
 * @param sadeceKategori Verilirse yalnızca o kategori temizlenir; verilmezse
 *   bizim TÜM kategorilerimiz.
 */
export function temizlenecekler(
  presented: readonly PresentedInfo[],
  ownedCategoryIds: ReadonlySet<string>,
  sadeceKategori?: NotificationCategoryId,
): string[] {
  const cikti: string[] = [];
  const gorulen = new Set<string>();

  for (const item of presented) {
    if (!item || typeof item.identifier !== 'string' || !item.identifier) continue;

    // 🔴 KATEGORİSİ OLMAYAN BİLDİRİM BİZİM DEĞİL — DOKUNULMAZ.
    // `dismissAllNotificationsAsync()` diye tek satırlık bir kestirme var ve
    // bilerek kullanılmıyor: cihazdaki TÜM bildirimleri siler — başka bir
    // kütüphanenin, F3'te gelecek uzak push'ların, ileride eklenecek başka
    // bir özelliğin. `scheduler.ts` aynı gerekçeyle süzüyor.
    const kategori = item.categoryId;
    if (typeof kategori !== 'string' || !ownedCategoryIds.has(kategori)) continue;

    if (sadeceKategori && kategori !== sadeceKategori) continue;

    // Aynı identifier iki kez gelirse iki kez `dismiss` çağırmanın anlamı yok.
    if (gorulen.has(item.identifier)) continue;
    gorulen.add(item.identifier);

    cikti.push(item.identifier);
  }

  return cikti;
}

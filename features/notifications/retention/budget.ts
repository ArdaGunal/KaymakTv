import type { NotificationCategoryMeta, ScheduledPlan } from '../types';

/**
 * Bekleyen bildirim bütçesi — şişmeyi YAPISAL olarak engeller
 * (docs/design/notifications.md § 8.1).
 *
 * 🔴 SORUNUN KENDİSİ: iOS aynı anda en fazla 64 bekleyen bildirim tutar ve
 * fazlasını **SESSİZCE DÜŞÜRÜR** — hata yok, uyarı yok. Yoğun bir takip
 * listesi 30 günlük ufukta bu tavanı rahatça aşar; bütçe olmadan sistem
 * "bazı bildirimler bazen gelmiyor" diye tarif edilen, teşhisi çok zor bir
 * hataya dönüşür.
 *
 * 🔴 IMPORT KURALI: yalnızca `import type`. Kayıt defterini içeri almak yerine
 * kategori tanımlarını PARAMETRE olarak alıyor — hem saf/test edilebilir
 * kalıyor (bkz. fireTime.ts başlığı) hem de bütçe mantığı kayıt defterinden
 * bağımsız test edilebiliyor.
 */

/**
 * Tüm kategoriler toplamında izin verilen en fazla bekleyen bildirim.
 * iOS'un 64 tavanının ALTINDA bilinçli emniyet payı: uygulama dışı kaynaklar
 * (F3'te gelecek uzak push'lar) da aynı kuyruğu paylaşır.
 */
export const GLOBAL_PLAN_CAP = 50;

/**
 * Bütçeyi uygular: önce kategori kotaları, sonra genel tavan.
 *
 * Her iki adımda da **en yakın tarihli plan kazanır**. Sebep: kullanıcının
 * yarın yayınlanacak bölümü, 27 gün sonrakinden kesinlikle daha değerlidir;
 * ayrıca uzak tarihli planlar kullanıcı uygulamayı bir daha açtığında
 * yeniden hesaplanacağı için kaybolmuş sayılmazlar.
 *
 * @param plans        Planlayıcıların ürettiği ham planlar
 * @param categoryMetas Kayıt defteri kayıtları (kota kaynağı)
 * @param globalCap    Genel tavan — test edilebilirlik için parametre
 */
export function applyBudget(
  plans: readonly ScheduledPlan[],
  categoryMetas: readonly NotificationCategoryMeta[],
  globalCap: number = GLOBAL_PLAN_CAP,
): ScheduledPlan[] {
  const budgetByCategory = new Map(categoryMetas.map((meta) => [meta.id, meta.budget]));

  const countByCategory = new Map<string, number>();
  const withinCategoryBudget: ScheduledPlan[] = [];

  // `slice()` şart: `sort` diziyi YERİNDE değiştirir ve çağıranın elindeki
  // planlayıcı çıktısını sessizce yeniden sıralamak, saf fonksiyon sözünü
  // bozardı.
  const sorted = plans.slice().sort((a, b) => a.fireAt - b.fireAt);

  for (const plan of sorted) {
    // Kayıt defterinde olmayan bir kategori: planlayıcı ile kayıt defteri
    // ıraksamış demektir. Sessizce geçirmek yerine düşürülüyor — kotasız bir
    // kategori genel tavanı tek başına tüketebilirdi.
    const budget = budgetByCategory.get(plan.categoryId);
    if (budget === undefined) continue;

    const used = countByCategory.get(plan.categoryId) ?? 0;
    if (used >= budget) continue;

    countByCategory.set(plan.categoryId, used + 1);
    withinCategoryBudget.push(plan);
  }

  // Kategori kotalarının TOPLAMI genel tavanı aşabilir (30+10+10+5... > 50),
  // bu yüzden ikinci bir kırpma gerekli. Zaten tarihe göre sıralı.
  return withinCategoryBudget.slice(0, globalCap);
}

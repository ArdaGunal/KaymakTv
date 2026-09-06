/**
 * Bildirim listelerinin YAŞA GÖRE budanması — SAF katman
 * (docs/design/notifications.md § 8-(3)).
 *
 * ==========================================================================
 * 🔴 SORUN "ŞİŞME" DEĞİLDİ — ÖLÇÜLDÜ (2026-09-06)
 * ==========================================================================
 * Kullanıcı haklı olarak "boşuna şişmesin" dedi. Ölçüm şunu gösterdi: adet
 * tavanları ZATEN vardı (iki liste de 50), en kötü durumda toplam **~48 KB**.
 * Yani disk bir sorun değil.
 *
 * 🔑 ASIL SORUN **BAYATLIK**: tavan ADET'e bakıyor, YAŞA bakmıyordu. Ayda
 * birkaç bildirim alan bir kullanıcı 50'ye hiç ulaşmaz — yani 2019'dan kalma
 * bir kayıt listede **sonsuza kadar** durur. Üstelik o kayıtların deep
 * link'leri çoktan silinmiş aktivitelere gidiyor olabilir.
 *
 * Bu yüzden buda: adet tavanı KALIYOR (yazma maliyeti için), üstüne yaş
 * tavanı EKLENİYOR.
 *
 * 🔴 SAF: yalnızca tip yok, çalışma zamanı import'u da yok
 * (gerekçe: `inbox/sweep.ts` başlığı).
 */

const GUN_MS = 24 * 60 * 60 * 1000;

/**
 * Bir bildirim kaydının listede kalabileceği en uzun süre.
 *
 * 🔴 60 GÜN NEDEN:
 * - Ekrandaki en geniş grup "Daha eski" ve 7 günden sonrasını topluyor;
 *   iki aylık bir pencere o grubu anlamlı tutuyor.
 * - En seyrek kategori **aylık özet** (`monthlyStats`). 60 gün, en az bir
 *   önceki ayın özetinin durmasını garanti eder. 30 gün seçilseydi yeni özet
 *   düşer düşmez bir öncekini silme riski doğardı.
 * - Daha uzun bir süre (ör. 1 yıl) hiçbir şey kazandırmaz: kimse 8 ay önceki
 *   "bugün yayında" bildirimini aramıyor ve o kaydın deep link'i muhtemelen
 *   ölü.
 */
export const INBOX_MAX_AGE_MS = 60 * GUN_MS;

/**
 * Onay bekleyen GÖNDERİLMİŞ takip isteği kaydının ömrü.
 *
 * 🔴 BU BİR GERÇEK SIZINTININ TAMİRİ. `pendingSentSlugs` yalnızca istek
 * ONAYLANINCA temizleniyordu. Gizli bir hesap isteği hiç onaylamazsa slug
 * **sonsuza kadar** listede kalıyordu — tek gerçekten SINIRSIZ büyüyen
 * alan buydu (diğer her şeyin adet tavanı vardı).
 *
 * 30 gün: bir takip isteği bir ay içinde onaylanmadıysa pratikte
 * onaylanmayacaktır. Süre dolunca yalnızca "bu isteği onayladı" bildirimini
 * kaçırırız — takibin kendisi Trakt'ta yaşamaya devam eder, veri kaybı yok.
 */
export const PENDING_SLUG_MAX_AGE_MS = 30 * GUN_MS;

/**
 * `pendingSentSlugs` için SON SAVUNMA HATTI.
 *
 * ⚠️ Yaş budaması yeterli olmalı; bu tavan onun tutmadığı durumlar için
 * (bozuk/elle kurcalanmış depolama, damgasız eski kayıtlar) sert bir sınır.
 * "İki koruma da gereksiz" denilebilirdi — ama bu alan zaten bir kez
 * sınırsız büyüdüğü için ikinci hat bilinçli.
 */
export const PENDING_SLUG_CAP = 200;

/**
 * Yaşı geçmiş kayıtları eler.
 *
 * ⚠️ GELECEK TARİHLİ KAYIT ELENMEZ: cihaz saati ileri alınmışsa ya da bir
 * plan ileri tarihliyse `now - at` negatif olur; negatifi "çok eski" saymak
 * yeni kaydı silerdi. Yalnızca `at` GEÇMİŞTE ve eşiği aşmışsa eleniyor.
 *
 * ⚠️ ZAMANI OKUNAMAYAN KAYIT KORUNUR, atılmaz: elde tutulan veriyi bir
 * ayrıştırma hatası yüzünden silmek, saklamaktan daha kötü.
 *
 * @param at Kaydın zaman damgasını veren erişimci — iki store farklı alan
 *   adı kullanıyor (`fireAt` / `createdAt`), bu yüzden parametre.
 */
export function pruneByAge<T>(
  items: readonly T[],
  now: number,
  at: (item: T) => unknown,
  maxAgeMs: number,
): T[] {
  const esik = now - maxAgeMs;
  const cikti: T[] = [];

  for (const item of items) {
    if (!item) continue;
    const zaman = at(item);
    if (typeof zaman !== 'number' || !Number.isFinite(zaman)) {
      cikti.push(item);
      continue;
    }
    if (zaman < esik) continue;
    cikti.push(item);
  }

  return cikti;
}

/**
 * Budama gerçekten bir şey değiştirdi mi?
 *
 * 🔴 GEREKLİ: her açılışta koşulsuz `setItem` çağırmak, hiçbir şey
 * değişmese bile listenin tamamını yeniden serialize edip diske yazardı.
 * Store'lar tek bir JSON dizesi tuttuğu için bu ucuz bir iş değil.
 */
export function budandiMi<T>(oncesi: readonly T[], sonrasi: readonly T[]): boolean {
  return oncesi.length !== sonrasi.length;
}

/**
 * GÖRÜNÜRLÜK YENİDEN DOĞRULAMASI — saf çekirdek (Moderasyon Faz 6 · plan §7, denetim MD06).
 *
 * Moderatör bir kartı gizleyince (ya da 3 şikâyetle karantinaya düşünce) sunucu o satırı artık
 * döndürmez (`in_feed` / `is_visible` + RLS). Ama türetilmiş kolonlar Realtime'da YAYINLANMIYOR:
 * açık ekrandaki kart canlı olayla düşmez. Bu yüzden istemci belirli anlarda elindeki kimlikleri
 * sunucuya sorar; dönmeyenleri listeden düşürür.
 *
 * Burada ağ yok: hangi kimliklerin sorulacağı ve sonuçtan hangilerinin düşeceği.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tek sorguya giren kimlik sayısı. `in.(…)` adresi ~100 kimlikte ~3,8 KB; PostgREST/CF sınırının çok altı. */
export const DOGRULAMA_PARCA = 100;

/** Öne gelişte sorulmadan önce arka planda geçmesi gereken süre (bildirim perdesi, izin diyaloğu sayılmaz). */
export const DOGRULAMA_ESIGI_MS = 15_000;

/**
 * Sunucuya sorulacak kimlikler: yalnız gerçek satır kimlikleri (UUID). İyimser kartlar
 * (`temp-…`) ve yerel kimlikler sunucuda henüz yoktur; sorulsalar «dönmedi» diye düşerlerdi.
 */
export function dogrulanacakKimlikler(kimlikler: readonly string[]): string[] {
  return [...new Set(kimlikler.filter((k) => UUID_RE.test(k)))];
}

/** Kimlikleri sorgu başına en çok `boyut` kadar parçalar. */
export function parcala<T>(dizi: readonly T[], boyut: number = DOGRULAMA_PARCA): T[][] {
  if (boyut < 1) throw new Error('parcala: boyut en az 1 olmalı');
  const parcalar: T[][] = [];
  for (let i = 0; i < dizi.length; i += boyut) parcalar.push(dizi.slice(i, i + boyut));
  return parcalar;
}

/** Sorulup sunucudan DÖNMEYEN kimlikler — listeden düşecekler. Sorulmayan hiçbir şey düşmez. */
export function dusenKimlikler(sorulan: readonly string[], donen: ReadonlySet<string>): string[] {
  return sorulan.filter((k) => !donen.has(k));
}

/**
 * Profildeki takipçi sayısı, düğmeyle aynı anda değişsin (C34). Sayı profil okunduğu anın ölçümüdür,
 * o andaki ilişkiyle birlikte gelir; aradaki fark senin takip/bırak işlemindir. Bekleyen istek sayılmaz.
 */
export function gosterilenTakipci(
  olculen: number,
  olcumdekiIliski: string | null | undefined,
  simdikiDurum: string,
  yukleniyor: boolean
): number {
  if (yukleniyor) return olculen;
  const once = olcumdekiIliski === 'takip' ? 1 : 0;
  const simdi = simdikiDurum === 'following' ? 1 : 0;
  return Math.max(0, olculen + simdi - once);
}

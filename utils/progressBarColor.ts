/**
 * Uygulama genelindeki TÜM ilerleme çubuklarının (afiş altı, dizi sayfası,
 * bölüm sayfası, keşfet listesi) renk kuralı — tek yerde, tek kaynak:
 *   - Manuel "Bırakıldı" işaretlenmiş → turuncu
 *   - Tüm yayınlanan bölümler tamamlanmış → yeşil
 *   - Aksi halde (aktif izleniyor VEYA ara verilmiş — ikisi de "devam ediyor"
 *     sayılır, ayrı bir renge ihtiyaç yok çünkü kategori grubu zaten ayırıyor) → mavi
 */
export const PROGRESS_BAR_COLOR = {
  active: '#3b82f6',
  dropped: '#fb923c',
  finished: '#10b981',
} as const;

export function getProgressBarColor(isDropped: boolean, isFinished: boolean): string {
  if (isDropped) return PROGRESS_BAR_COLOR.dropped;
  if (isFinished) return PROGRESS_BAR_COLOR.finished;
  return PROGRESS_BAR_COLOR.active;
}

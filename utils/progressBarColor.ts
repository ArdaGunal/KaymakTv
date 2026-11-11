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

// Native ekran aktif çizgiyi kendi paletiyle çizebilir; tamamlandı/ bırakıldı
// durumlarının semantik renkleri aynı kalır.
export function getProgressBarColor(
  isDropped: boolean,
  isFinished: boolean,
  activeColor: string = PROGRESS_BAR_COLOR.active
): string {
  if (isDropped) return PROGRESS_BAR_COLOR.dropped;
  if (isFinished) return PROGRESS_BAR_COLOR.finished;
  return activeColor;
}

/**
 * Takip kartının ilerleme yüzdesi (0–100) ya da bilinmiyorsa `null`. Eskiden
 * üç kartta (EpisodeCardMobile, EpisodeCard.web, ShowTrackCardWeb) kopyaydı.
 */
export function ilerlemeYuzdesi(kart: { completedCount?: number | null; totalCount?: number | null } | null | undefined): number | null {
  const tamam = kart?.completedCount;
  const toplam = kart?.totalCount;
  if (tamam === null || tamam === undefined || !toplam || toplam <= 0) return null;
  return Math.min(100, (tamam / toplam) * 100);
}

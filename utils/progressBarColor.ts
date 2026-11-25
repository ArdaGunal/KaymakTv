import { PROGRESS_BAR_COLOR } from '../constants/progressBarColors';
import type { ShowCategories } from '../store/tracking/trackingLogic';

export type ShowProgressStatus = keyof ShowCategories | 'upToDate' | 'finished';

/** Afiş altı şeritlerde kategori biliniyorsa iki mavi tonu duruma göre seçilir. */
export function getProgressBarColor(
  isDropped: boolean,
  isFinished: boolean,
  fallbackColor: string = PROGRESS_BAR_COLOR.active,
  status?: ShowProgressStatus,
): string {
  if (isDropped) return PROGRESS_BAR_COLOR.dropped;
  if (isFinished) return PROGRESS_BAR_COLOR.finished;
  if (status === 'upNext') return PROGRESS_BAR_COLOR.active;
  if (status === 'paused') return PROGRESS_BAR_COLOR.paused;
  return fallbackColor;
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

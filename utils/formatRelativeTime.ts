// `components/comments/CommentItem.tsx`'teki yerel `formatRelativeDate`ten
// taşındı (davranış AYNI) — bildirim satırları da aynı "X önce" formatına
// ihtiyaç duyduğu için tek kaynağa çıkarıldı.
export function formatRelativeTime(dateStr: string | undefined, t: (key: string) => string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs === 0) {
      const diffMin = Math.floor(diffMs / (1000 * 60));
      return diffMin <= 1 ? t('justNow') : `${diffMin} ${t('minutesAgo')}`;
    }
    return `${diffHrs} ${t('hoursAgo')}`;
  }
  if (diffDays < 7) return `${diffDays} ${t('daysAgo')}`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${t('weeksAgo')}`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ${t('monthsAgo')}`;
  return `${Math.floor(diffDays / 365)} ${t('yearsAgo')}`;
}

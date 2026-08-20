// `components/comments/CommentItem.tsx`'teki yerel `formatRelativeDate`ten
// taşındı (davranış AYNI) — bildirim satırları da aynı "X önce" formatına
// ihtiyaç duyduğu için tek kaynağa çıkarıldı.
//
// Anahtarlar `common:` öneki ile çağrılıyor ki HANGİ ekranın `t`'si verilirse
// verilsin çalışsın — i18next'te bir anahtarı `namespace:key` ile adreslemek
// çağıranın aktif `useTranslation` namespace'inden bağımsızdır (aynı desen
// `app/(protected)/list/[id].tsx`'te de var). F17 öncesi bu fonksiyon yalnızca
// 'common' namespace'i yüklü ekranlardan çağrılabiliyordu; akış kartları bu
// yüzden kendi (hardcoded Türkçe, i18n'siz) kopyasını yazmıştı — HISTORY Madde 193.
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
      return diffMin <= 1 ? t('common:justNow') : `${diffMin} ${t('common:minutesAgo')}`;
    }
    return `${diffHrs} ${t('common:hoursAgo')}`;
  }
  if (diffDays < 7) return `${diffDays} ${t('common:daysAgo')}`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${t('common:weeksAgo')}`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ${t('common:monthsAgo')}`;
  return `${Math.floor(diffDays / 365)} ${t('common:yearsAgo')}`;
}

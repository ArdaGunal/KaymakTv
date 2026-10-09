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
// A-3 · Tekil/çoğul: «1 days ago» hatası. i18next çoğul eki (`_one`) yerine
// açık tekil anahtar — Intl.PluralRules'a bağımlı değil (Hermes), Türkçede iki
// anahtar aynı metni taşır.
const birimli = (n: number, tekil: string, cogul: string, t: (key: string) => string) =>
  `${n} ${t(n === 1 ? `common:${tekil}` : `common:${cogul}`)}`;

export function formatRelativeTime(dateStr: string | undefined, t: (key: string) => string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  // M476: sunucu damgası cihaz saatinin birkaç saniye İLERİSİNDE olabilir
  // (saat kayması) → negatif fark «-1 days ago» yazıyordu. Gelecek = «şimdi».
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs === 0) {
      const diffMin = Math.floor(diffMs / (1000 * 60));
      return diffMin <= 1 ? t('common:justNow') : birimli(diffMin, 'minuteAgo', 'minutesAgo', t);
    }
    return birimli(diffHrs, 'hourAgo', 'hoursAgo', t);
  }
  if (diffDays < 7) return birimli(diffDays, 'dayAgo', 'daysAgo', t);
  if (diffDays < 30) return birimli(Math.floor(diffDays / 7), 'weekAgo', 'weeksAgo', t);
  if (diffDays < 365) return birimli(Math.floor(diffDays / 30), 'monthAgo', 'monthsAgo', t);
  return birimli(Math.floor(diffDays / 365), 'yearAgo', 'yearsAgo', t);
}

/** Geliştirici Paneli'ndeki hem performans hem hata satırlarının ORTAK saat
 * biçimlendiricisi — iki ayrı kopya (biri eski error-log.tsx'te) yerine tek yer. */
export function formatTimestamp(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

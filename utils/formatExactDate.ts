import { yerelEtiket } from '../locales/diller';

/**
 * C2 · Detay sayfasının tam tarihi: «10 Eki · 21:14» (bu yıl) /
 * «3 Ara 2025 · 09:05» (geçmiş yıl). Akış kartlarındaki göreli zamanın
 * («2 saat önce») detaydaki karşılığı — Twitter'ın gönderi sayfasındaki gibi.
 * `language` i18n dili → dil kaydının BCP 47 etiketi (`locales/diller.ts`; bilinmeyen dil → varsayılan).
 */
export function formatExactDate(iso: string | undefined, language: string | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const locale = yerelEtiket(language);
  const tarih = d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
  });
  const iki = (n: number) => String(n).padStart(2, '0');
  return `${tarih} · ${iki(d.getHours())}:${iki(d.getMinutes())}`;
}

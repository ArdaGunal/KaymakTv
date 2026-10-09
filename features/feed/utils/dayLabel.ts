/**
 * C5 · Akışın zaman ayracı etiketi (kullanıcı kararı: «ince bir ayırıcı çizgi ve
 * küçük bir tarih etiketi — çok daha sade»).
 *
 * Bugün / Dün / son 7 gün içinde gün adı («Çarşamba») / daha eskisi «3 Eki»
 * (geçmiş yılsa «3 Ara 2025»). Gün sınırı CİHAZIN yerel saatine göre.
 * Saf fonksiyon: `now` ve dil dışarıdan → testte sabitlenebilir.
 */
export type GunEtiketiT = (key: 'dayToday' | 'dayYesterday') => string;

const gunBasi = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dayKey(iso: string): number {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 0 : gunBasi(d);
}

export function dayLabel(iso: string, language: string | undefined, t: GunEtiketiT, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const fark = Math.round((gunBasi(now) - gunBasi(d)) / 86_400_000);
  if (fark <= 0) return t('dayToday');
  if (fark === 1) return t('dayYesterday');
  const locale = language === 'en' ? 'en-US' : 'tr-TR';
  if (fark < 7) return d.toLocaleDateString(locale, { weekday: 'long' });
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
  });
}

/**
 * Listedeki her öğe için ayraç etiketi: gün DEĞİŞTİĞİNDE (ve ilk öğede) dolu,
 * aynı günün devamında null. Akış zaten yeniden eskiye sıralı.
 */
export function dayLabelsFor<T extends { activityAt: string }>(
  items: T[],
  language: string | undefined,
  t: GunEtiketiT,
  now: Date = new Date()
): (string | null)[] {
  let onceki: number | null = null;
  return items.map((it) => {
    const k = dayKey(it.activityAt);
    if (k === onceki) return null;
    onceki = k;
    return dayLabel(it.activityAt, language, t, now);
  });
}

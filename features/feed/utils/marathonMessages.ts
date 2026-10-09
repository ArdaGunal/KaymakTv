/**
 * Marathon Mesaj Konfigürasyonu
 *
 * Maraton seviyelerine göre başlık, rozet ve renk döndürür.
 * Gelecekte yeni seviye veya mesaj eklemek için yalnızca bu dosyaya dokunmak yeterli.
 *
 * `count` HER ZAMAN farklı (tekilleştirilmiş) bölüm sayısıdır — ham satır
 * sayısı DEĞİL (bkz. groupMarathonActivities.ts). Alt sınır zaten
 * MARATHON_MIN_COUNT=3 ile garanti edildiği için bu fonksiyon 3'ün altında
 * bir `count` ile hiç çağrılmaz.
 *
 * Seviye kuralları (isSeasonCompleted kaldırıldı — sadece bölüm sayısına göre):
 *  Level 1 : count 3–4   ("Hız Turu")
 *  Level 2 : count 5–7   ("Maratoncu")
 *  Level 3 : count >= 8  ("Sezon Fatihi")
 */

export interface MarathonMessage {
  level: 1 | 2 | 3;
  headline: string;
  badge: string;
  /** Ana vurgu rengi — badge bg, avatar border ve sayı rengi için kullanılır */
  color: string;
}

// A-3: metinler çeviride (feed:marathonL{1,2,3}{Headline,Badge}) — eskiden gömülü Türkçe.
export function getMarathonMessage(
  username: string,
  count: number,
  t: (key: string, options?: Record<string, unknown>) => string
): MarathonMessage {
  const level: MarathonMessage['level'] = count >= 8 ? 3 : count >= 5 ? 2 : 1;
  const color = level === 3 ? '#fbbf24' /* amber */ : level === 2 ? '#34d399' /* emerald */ : '#60a5fa'; /* sky */
  return {
    level,
    headline: String(t(`feed:marathonL${level}Headline`, { name: username })),
    badge: String(t(`feed:marathonL${level}Badge`)),
    color,
  };
}

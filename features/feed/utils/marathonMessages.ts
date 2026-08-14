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

export function getMarathonMessage(username: string, count: number): MarathonMessage {
  if (count >= 8) {
    return {
      level: 3,
      headline: `${username} sezonu tek oturuşta devirdi! 🏆🦉`,
      badge: 'Sezon Fatihi',
      color: '#fbbf24', // amber
    };
  }
  if (count >= 5) {
    return {
      level: 2,
      headline: `${username} maraton yapıyor! 🏃‍♂️🎬`,
      badge: 'Maratoncu',
      color: '#34d399', // emerald
    };
  }
  // count 3–4
  return {
    level: 1,
    headline: `${username} hızını alamadı! 🍿`,
    badge: 'Hız Turu',
    color: '#60a5fa', // sky blue
  };
}

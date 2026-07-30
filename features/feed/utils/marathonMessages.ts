/**
 * Marathon Mesaj Konfigürasyonu
 *
 * Maraton seviyelerine göre başlık, rozet ve renk döndürür.
 * Gelecekte yeni seviye veya mesaj eklemek için yalnızca bu dosyaya dokunmak yeterli.
 *
 * Seviye kuralları (isSeasonCompleted kaldırıldı — sadece bölüm sayısına göre):
 *  Level 1 : count 2–3   ("Hız Turu")
 *  Level 2 : count 4–6   ("Maratoncu")
 *  Level 3 : count >= 7  ("Sezon Fatihi")
 */

export interface MarathonMessage {
  level: 1 | 2 | 3;
  headline: string;
  badge: string;
  /** Ana vurgu rengi — badge bg, avatar border ve sayı rengi için kullanılır */
  color: string;
}

export function getMarathonMessage(username: string, count: number): MarathonMessage {
  if (count >= 7) {
    return {
      level: 3,
      headline: `${username} sezonu tek oturuşta devirdi! 🏆🦉`,
      badge: 'Sezon Fatihi',
      color: '#fbbf24', // amber
    };
  }
  if (count >= 4) {
    return {
      level: 2,
      headline: `${username} maraton yapıyor! 🏃‍♂️🎬`,
      badge: 'Maratoncu',
      color: '#34d399', // emerald
    };
  }
  // count 2–3
  return {
    level: 1,
    headline: `${username} hızını alamadı! 🍿`,
    badge: 'Hız Turu',
    color: '#60a5fa', // sky blue
  };
}

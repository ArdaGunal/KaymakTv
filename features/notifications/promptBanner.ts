import type { NotificationPermissionStatus } from './types';

/**
 * "Bildirimleri aç" hatırlatma bandının GÖRÜNÜRLÜK KARARI
 * (docs/design/notifications.md § 12).
 *
 * 🔴 SAF: yalnızca `import type`. Karar mantığı burada olduğu için
 * "hangi durumda çıkar, hangi durumda çıkmaz" testle kilitlenebiliyor —
 * bir hatırlatma bandının en kötü kusuru yanlış zamanda ısrar etmesidir.
 *
 * TASARIM: bu bir bildirim DEĞİL, uygulama içi sessiz bir şerit. Sistem
 * diyaloğunu kullanıcıya zorla göstermez; dokununca gösterir.
 */

/** Kapatıldıktan sonra tekrar görünmesi için geçmesi gereken süre. */
export const BANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export interface BannerVisibilityInput {
  permission: NotificationPermissionStatus | null;
  /** Kullanıcı bildirimleri tamamen kapattıysa ısrar etmeyiz. */
  masterEnabled: boolean;
  /** Bandın "x" ile kapatıldığı an (epoch ms) ya da hiç kapatılmadıysa `null`. */
  dismissedAt: number | null;
  now: number;
}

export function shouldShowPromptBanner(input: BannerVisibilityInput): boolean {
  const { permission, masterEnabled, dismissedAt, now } = input;

  // İzin durumu henüz okunmadı — bir an görünüp kaybolan şerit, ekranın
  // gözün önünde zıplaması demek olurdu.
  if (permission === null) return false;

  // Zaten izinli: hatırlatacak bir şey yok.
  if (permission === 'granted') return false;

  // Web: `expo-notifications` no-op, açılabilecek bir şey yok. Kullanıcıya
  // hiçbir şey yapamayacağı bir çağrı göstermek boş ısrardır.
  if (permission === 'unsupported') return false;

  // 🔑 Kullanıcı ana anahtarı KENDİ kapattıysa ısrar YOK. Bu bilinçli bir
  // tercih; üstüne şerit çıkarmak "hayır" cevabına saygısızlık olur.
  if (!masterEnabled) return false;

  // "x" ile kapatıldıysa erteleme süresi dolana kadar görünmez.
  if (dismissedAt !== null) {
    // Bozuk/gelecek tarihli değer bandı SONSUZA KADAR gizleyebilirdi;
    // anlamsız bir damga "hiç kapatılmamış" sayılır.
    const isSane = Number.isFinite(dismissedAt) && dismissedAt <= now;
    if (isSane && now - dismissedAt < BANNER_SNOOZE_MS) return false;
  }

  return true;
}

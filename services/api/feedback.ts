import axios from 'axios';

// Cloudflare Worker ara katmanı (Faz 7.1 "Görünmez Köprü") — Discord webhook
// sırrı ve Supabase anahtarı yalnızca Worker'ın kendi Secrets kasasında durur,
// istemciye hiçbir zaman gömülmez.
const FEEDBACK_WORKER_URL = process.env.EXPO_PUBLIC_FEEDBACK_WORKER_URL || '';

/** Geri bildirim kategorisi.
 * - `'bug'`:     Hata / Problem bildirimi. Loglar ve cihaz bilgisi gönderilir.
 * - `'feature'`: İstek / Öneri bildirimi. Loglar gönderilmez, yalnızca mesaj.
 */
export type FeedbackCategory = 'bug' | 'feature';

export interface FeedbackPayload {
  userMessage: string;
  errorLogs: unknown;
  /** Son 24 saatlik telemetri özeti (`utils/metrics.ts` → `exportMetricsReport`).
   * `errorLogs` ile AYNI "Hata loglarımı da gönder" onayına bağlıdır — ayrı
   * bir izin istenmiyor (bkz. docs/HISTORY.md). Kullanıcı kapatırsa `null`. */
  performanceReport: unknown;
  deviceInfo: string;
  userId: string;
  /** Geri bildirimin türü. Worker bu değere göre Supabase sütununu ve
   *  Discord mesajının rengini/başlığını belirler. */
  category: FeedbackCategory;
}

export const sendFeedback = async (payload: FeedbackPayload): Promise<void> => {
  if (!FEEDBACK_WORKER_URL) {
    throw new Error('EXPO_PUBLIC_FEEDBACK_WORKER_URL tanımlı değil.');
  }
  await axios.post(FEEDBACK_WORKER_URL, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });
};

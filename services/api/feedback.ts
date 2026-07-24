import axios from 'axios';

// Cloudflare Worker ara katmanı (Faz 7.1 "Görünmez Köprü") — Discord webhook
// sırrı ve Supabase anahtarı yalnızca Worker'ın kendi Secrets kasasında durur,
// istemciye hiçbir zaman gömülmez.
const FEEDBACK_WORKER_URL = process.env.EXPO_PUBLIC_FEEDBACK_WORKER_URL || '';

export interface FeedbackPayload {
  userMessage: string;
  errorLogs: unknown;
  deviceInfo: string;
  userId: string;
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

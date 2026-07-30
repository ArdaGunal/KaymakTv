import axios from 'axios';
import { recordApiLatency, recordMutationResult } from '../../../utils/metrics';

// Aynı Cloudflare Worker'ın (kaymaktv-feedback-worker) /feed/sync uç noktası —
// Worker, Trakt token'ını GET /users/settings ile doğrulayıp service_role key
// ile Supabase'e (yalnızca `users` aynası + `feed_activities`) yazıyor.
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

// Bu istek `traktClient.ts`'in axios interceptor'ından geçmiyor (ayrı bir
// `axios.post`, Trakt'a değil Worker'a gidiyor) — bu yüzden performans
// raporunda hiç görünmüyordu. App açılışında sessizce tetiklendiği için
// yavaşlığı fark etmek zordu; artık `api.latency.worker.feed.sync` altında
// diğer her şeyle aynı raporda görünür.
export const syncFeedActivity = async (traktAccessToken: string): Promise<void> => {
  if (!KAYMAK_WORKER_URL) return;
  const start = Date.now();
  try {
    await axios.post(
      `${KAYMAK_WORKER_URL}/feed/sync`,
      { traktAccessToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    recordMutationResult('feedSync', true);
  } catch (error) {
    recordMutationResult('feedSync', false);
    throw error;
  } finally {
    recordApiLatency('worker.feed.sync', Date.now() - start);
  }
};

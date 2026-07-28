import axios from 'axios';

// Aynı Cloudflare Worker'ın (kaymaktv-feedback-worker) /feed/sync uç noktası —
// Worker, Trakt token'ını GET /users/settings ile doğrulayıp service_role key
// ile Supabase'e (yalnızca `users` aynası + `feed_activities`) yazıyor.
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export const syncFeedActivity = async (traktAccessToken: string): Promise<void> => {
  if (!KAYMAK_WORKER_URL) return;
  await axios.post(
    `${KAYMAK_WORKER_URL}/feed/sync`,
    { traktAccessToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  );
};

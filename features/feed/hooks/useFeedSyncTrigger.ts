import { useEffect, useRef } from 'react';
import { syncFeedActivity } from '../services/feedSync';

// App açılışında (bkz. docs/feed.md "Option B") Feed aktivitelerini Trakt'tan
// Supabase'e senkronize eder. Sessizce başarısız olur — Feed senkronizasyonu
// çökse bile uygulamanın geri kalanı hiç etkilenmemeli.
export function useFeedSyncTrigger(accessToken: string | null, isGuest: boolean) {
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!accessToken || isGuest || hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    syncFeedActivity(accessToken).catch((error) => {
      console.warn('[Feed] Senkronizasyon başarısız:', error?.message);
    });
  }, [accessToken, isGuest]);
}

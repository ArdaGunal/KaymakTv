import { useEffect, useRef } from 'react';
import { syncFeedActivity } from '../services/feedSync';
import { feedSyncAtlanirMi, feedSyncSonTurOku, feedSyncSonTurYaz } from '../services/feedSyncAraligi';

// App açılışında (bkz. docs/design/feed.md "Option B") Feed aktivitelerini Trakt'tan
// Supabase'e senkronize eder. Sessizce başarısız olur — Feed senkronizasyonu
// çökse bile uygulamanın geri kalanı hiç etkilenmemeli.
// ISTEK-SEL (M607): son başarılı (ya da 429 alan) turdan bu yana 2 dk geçmediyse atlanır
// (art arda F5 Worker sınırına çarpıyordu) — bkz. `feedSyncAraligi.ts`.
export function useFeedSyncTrigger(accessToken: string | null, isGuest: boolean, hazir: boolean) {
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!hazir || !accessToken || isGuest || hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    void (async () => {
      if (feedSyncAtlanirMi(await feedSyncSonTurOku(), Date.now())) return;
      try {
        await syncFeedActivity(accessToken);
        feedSyncSonTurYaz();
      } catch (error: any) {
        if (error?.response?.status === 429) feedSyncSonTurYaz();
        console.warn('[Feed] Senkronizasyon başarısız:', error?.message);
      }
    })();
  }, [accessToken, isGuest, hazir]);
}

import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../context/AuthContext';
import { startWatchedOutbox, stopWatchedOutbox, resumeWatchedOutbox } from '../services/library/outbox/runtime';
import { useWatchedOutboxStore } from '../store/watchedOutboxStore';
import { logError } from '../utils/errorLog';

export function useWatchedOutbox() {
  const { accessToken, isGuest } = useAuth();
  useEffect(() => {
    if (!accessToken || isGuest) { stopWatchedOutbox(); return; }
    let stopped = false;
    const start = () => startWatchedOutbox(accessToken).catch((error) => {
      if (stopped) return;
      useWatchedOutboxStore.setState({ hasError: true });
      logError('watchedOutbox.start', error);
    });
    void start();
    const retry = () => {
      if (stopped) return;
      if (useWatchedOutboxStore.getState().ready) resumeWatchedOutbox();
      else void start();
    };
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') retry(); });
    const net = NetInfo.addEventListener((state) => { if (state.isConnected && state.isInternetReachable !== false) retry(); });
    // Çevrimiçi/geçici 5xx için de bekleme; sonsuz sıkı retry döngüsü yok.
    const timer = setInterval(retry, 30000);
    return () => { stopped = true; app.remove(); net(); clearInterval(timer); stopWatchedOutbox(); };
  }, [accessToken, isGuest]);
}

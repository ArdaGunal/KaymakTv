import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../context/AuthContext';
import { startHiddenOutbox, stopHiddenOutbox, resumeHiddenOutbox } from '../services/library/hiddenOutbox/runtime';
import { useHiddenOutboxStore } from '../store/hiddenOutboxStore';
import { logError } from '../utils/errorLog';

export function useHiddenOutbox() {
  const { accessToken, isGuest } = useAuth();
  useEffect(() => {
    if (!accessToken || isGuest) { stopHiddenOutbox(); return; }
    let stopped = false;
    const start = () => startHiddenOutbox(accessToken).catch(() => {
      if (stopped) return;
      useHiddenOutboxStore.setState({ hasError: true });
      logError('hiddenOutbox.start', new Error('Gizleme günlüğü açılamadı; veri korunuyor.'));
    });
    void start();
    const retry = () => {
      if (stopped) return;
      if (useHiddenOutboxStore.getState().ready) resumeHiddenOutbox();
      else void start();
    };
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') retry(); });
    const net = NetInfo.addEventListener((state) => { if (state.isConnected && state.isInternetReachable !== false) retry(); });
    const timer = setInterval(retry, 30000);
    return () => { stopped = true; app.remove(); net(); clearInterval(timer); stopHiddenOutbox(); };
  }, [accessToken, isGuest]);
}

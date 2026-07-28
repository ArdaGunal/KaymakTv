import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useVersionGate } from '../hooks/useVersionGate';
import ForceUpdateScreen from './ForceUpdateScreen';

/**
 * En dış katman güvenlik kapısı — bkz. useVersionGate.ts. `app/_layout.tsx`
 * bunu `AuthProvider`'ın DIŞINDA sarmalar: `useAuth()`'a hiç ihtiyaç duymaz,
 * Trakt/Auth akışları tamamen boşta dururken kendi kontrolünü bağımsız yapar.
 */
export default function VersionGate({ children }: { children: React.ReactNode }) {
  const { status, updateUrl } = useVersionGate();

  if (status === 'checking') {
    // `app/_layout.tsx`'teki mevcut auth-loading View'iyle BİREBİR aynı koyu
    // boş ekran — web'de bu dal anında atlanır (status hep 'ok' başlar),
    // native'de kontrol tipik olarak bir kaç yüz ms sürer; kullanıcı görünür
    // bir "flaş" yaşamaz.
    return <View style={styles.loading} />;
  }

  if (status === 'blocked' && updateUrl) {
    return <ForceUpdateScreen updateUrl={updateUrl} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0B1120' },
});

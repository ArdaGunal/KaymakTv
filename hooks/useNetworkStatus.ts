import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Uygulama genelinde tek bir çevrimdışı göstergesi için (bkz.
 * components/OfflineBanner.tsx). `isInternetReachable` NetInfo'nun aktif
 * olarak İNTERNETE çıkabildiğini doğruladığı sinyal — `isConnected` yalnızca
 * bir ağa (ör. Wi-Fi) bağlı olduğunu söyler, o ağın internete çıkışı
 * kesilmiş olabilir (ör. şifre girilmemiş halka açık Wi-Fi). İkisi de
 * `null` olabilir (henüz ölçülmedi) — o durumda YANLIŞ POZİTİF ("çevrimdışı"
 * göstermek) yerine bilinçli olarak "bağlı" varsayılır, açılışta bir anlık
 * yanlış banner flaşı yaşanmasın diye.
 */
export function useNetworkStatus(): boolean {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const reachable = state.isInternetReachable;
      setIsConnected(reachable === null ? (state.isConnected ?? true) : reachable);
    });
    return () => unsubscribe();
  }, []);

  return isConnected;
}

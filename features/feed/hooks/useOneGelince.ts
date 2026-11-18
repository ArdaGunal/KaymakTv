import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { DOGRULAMA_ESIGI_MS } from '../utils/gorunurlukDogrulama';

/**
 * Uygulama arka plandan öne geldiğinde (en az `esikMs` arka planda kaldıysa) ve bağlantı koptuktan
 * sonra geri geldiğinde `geriCagir`'ı çalıştırır (Moderasyon Faz 6 · MD06).
 *
 * Kısa geçişler (bildirim perdesi, izin diyaloğu) sayılmaz. Bağlantı olayı yalnız «yoktu → var»
 * geçişinde tetikler; NetInfo'nun açılıştaki ilk bildirimi tetiklemez.
 * `geriCagir` her render'da değişebilir; en günceli çağrılır, abonelik yeniden kurulmaz.
 */
export function useOneGelince(geriCagir: () => void, etkin = true, esikMs: number = DOGRULAMA_ESIGI_MS): void {
  const sonGeriCagir = useRef(geriCagir);
  sonGeriCagir.current = geriCagir;

  useEffect(() => {
    if (!etkin) return;
    let arkaPlanaGecis: number | null = null;
    const app = AppState.addEventListener('change', (durum) => {
      if (durum !== 'active') {
        if (arkaPlanaGecis === null) arkaPlanaGecis = Date.now();
        return;
      }
      const sure = arkaPlanaGecis === null ? 0 : Date.now() - arkaPlanaGecis;
      arkaPlanaGecis = null;
      if (sure >= esikMs) sonGeriCagir.current();
    });

    let bagliydi: boolean | null = null;
    const ag = NetInfo.addEventListener((durum) => {
      const bagli = !!durum.isConnected && durum.isInternetReachable !== false;
      if (bagliydi === false && bagli) sonGeriCagir.current();
      bagliydi = bagli;
    });

    return () => {
      app.remove();
      ag();
    };
  }, [etkin, esikMs]);
}

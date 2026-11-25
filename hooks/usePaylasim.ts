import { useCallback } from 'react';
import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { paylasimUrl, type PaylasimHedefi } from '../utils/paylasimUrl';

type PaylasimSonucu = 'paylasildi' | 'kopyalandi' | 'iptal' | 'basarisiz';

export function usePaylasim() {
  return useCallback(async (
    hedef: PaylasimHedefi,
    metin: string,
    hataKaydi?: (hata: unknown) => void,
  ): Promise<PaylasimSonucu> => {
    const url = paylasimUrl(hedef);
    if (!url) return 'basarisiz';

    try {
      if (Platform.OS !== 'web') {
        const sonuc = await Share.share({ message: `${metin}\n${url}` });
        return sonuc.action === Share.dismissedAction ? 'iptal' : 'paylasildi';
      }

      const tarayici = globalThis.navigator;
      const veri = { url, text: metin };
      if (tarayici?.share && (!tarayici.canShare || tarayici.canShare(veri))) {
        await tarayici.share(veri);
        return 'paylasildi';
      }

      return (await Clipboard.setStringAsync(url)) ? 'kopyalandi' : 'basarisiz';
    } catch (hata) {
      if (typeof hata === 'object' && hata !== null && 'name' in hata && hata.name === 'AbortError') {
        return 'iptal';
      }
      if (hataKaydi) hataKaydi(hata);
      else console.warn('[Paylasim] Paylaşım tamamlanamadı.', hata);
      return 'basarisiz';
    }
  }, []);
}

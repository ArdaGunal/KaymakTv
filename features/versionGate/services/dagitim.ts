import { PLAY_STORE_URL, STORE_URL } from '../../../utils/constants';

/**
 * YAYIN_ONCESI_PLAN Adım 1 · Paketin hangi kanaldan dağıtıldığı. Derleme anında gömülür:
 *  - `play` → Google Play paketi (`eas.json` production, `scripts/apk-derle.sh --aab`).
 *    Güncelleme düğmesi Play sayfasını açar; Play politikası mağaza dışı APK'ya
 *    yönlendirmeyi yasaklar.
 *  - `apk` (varsayılan) → GitHub «beta» üzerinden yan yüklenen APK; indirme sayfasını açar.
 * 🔴 Metro bu değeri önbelleğe alabilir; derleme betiği değişkeni her derlemede açıkça ayarlar.
 */
export type Dagitim = 'play' | 'apk';

export const DAGITIM: Dagitim = process.env.EXPO_PUBLIC_DAGITIM === 'play' ? 'play' : 'apk';

export interface GuncellemeAdresleri {
  updateUrl: string | null;
  storeUpdateUrl: string | null;
}

/** Saf — sınanır. Sunucu adresi boşsa kanalın sabit adresine düşer. */
export function guncellemeAdresi(ayar: GuncellemeAdresleri | null, dagitim: Dagitim = DAGITIM): string {
  if (dagitim === 'play') return ayar?.storeUpdateUrl || PLAY_STORE_URL;
  return ayar?.updateUrl || STORE_URL;
}

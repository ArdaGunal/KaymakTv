import { Platform } from 'react-native';

/**
 * Native Trakt girişi cihaz koduyla mı (`docs/design/TRAKT_CIHAZ_KODU_PLANI.md`). Varsayılan AÇIK.
 * Web her zaman tam sayfa yönlendirmede kalır (orada uygulamadan çıkma sorunu yok).
 * Geri dönüş: `EXPO_PUBLIC_TRAKT_CIHAZ_GIRISI=0` ile derlenen APK eski Custom Tab yolunu kullanır.
 * Eski yol 1.0.2'de kaldırılacak (BACKLOG).
 */
export const TRAKT_CIHAZ_GIRISI = Platform.OS !== 'web' && process.env.EXPO_PUBLIC_TRAKT_CIHAZ_GIRISI !== '0';

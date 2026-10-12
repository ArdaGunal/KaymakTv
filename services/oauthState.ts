import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * S7 (M499) · Trakt OAuth `state` doğrulaması — kütüphanenin KENDİSİNİN
 * doğrulamadığı dönüş yolları için (mobil derin bağlantı `kaymak://settings?code=`,
 * web `kaymaktv.com/settings?code=`). Eskiden bu iki dal `state`'e hiç bakmadan
 * kodu değişiyordu → saldırganın hazırladığı bir bağlantı kurbanı SALDIRGANIN
 * Trakt hesabına sokabiliyordu (giriş CSRF'i / oturum sabitleme).
 *
 * Akış: girişten hemen önce `request.state` (expo-auth-session'ın rastgele
 * ürettiği) saklanır; dönüşte gelen `state` onunla karşılaştırılır ve TEK
 * KULLANIMLIK tüketilir. AsyncStorage: uygulama/sekme dönüşte yeniden açılsa
 * da (web tam sayfa yönlendirme, Android süreç ölümü) değer kalır.
 */
const ANAHTAR = '@kaymak_trakt_oauth_state_v1';

/** SAF — beklenen ve gelen `state` eşit ve boş değil mi. */
export function oauthStateEsit(beklenen: string | null | undefined, gelen: string | null | undefined): boolean {
  return typeof beklenen === 'string' && beklenen.length >= 8 && beklenen === gelen;
}

export async function oauthStateKaydet(state: string | null | undefined): Promise<void> {
  if (!state) return;
  try {
    await AsyncStorage.setItem(ANAHTAR, state);
  } catch {
    // Yazılamazsa dönüşte doğrulama düşer → kullanıcı yeniden dener (güvenli taraf).
  }
}

/** Saklanan değeri okur ve SİLER; eşleşiyorsa true. */
export async function oauthStateTuket(gelen: string | null | undefined): Promise<boolean> {
  let beklenen: string | null = null;
  try {
    beklenen = await AsyncStorage.getItem(ANAHTAR);
    await AsyncStorage.removeItem(ANAHTAR);
  } catch {
    return false;
  }
  return oauthStateEsit(beklenen, gelen);
}

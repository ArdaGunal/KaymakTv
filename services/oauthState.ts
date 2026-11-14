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
 *
 * M620 (K5 · docs/design/TRAKT_CIHAZ_KODU_PLANI.md): tek değer yerine SON 3 değer, her biri 10 dk.
 * Eskiden yeni bir deneme eskisinin üstüne yazıyordu → kişi ilk denemenin dönüşüyle gelince reddediliyordu;
 * uyuşmayan bir dönüş saklananı da siliyordu → arkasından gelen DOĞRU dönüş de reddediliyordu. Şimdi
 * yalnız eşleşen değer tüketilir; uyuşmayan dönüş listeye dokunmaz. Güvenlik değişmez: her değer rastgele,
 * tek kullanımlık ve bu cihazda üretilmiş.
 */
const ANAHTAR = '@kaymak_trakt_oauth_state_v1';
export const STATE_OMRU_MS = 10 * 60 * 1000;
export const STATE_TAVANI = 3;

type Kayit = { s: string; t: number };

/** SAF — beklenen ve gelen `state` eşit ve boş değil mi. */
export function oauthStateEsit(beklenen: string | null | undefined, gelen: string | null | undefined): boolean {
  return typeof beklenen === 'string' && beklenen.length >= 8 && beklenen === gelen;
}

/** SAF — diskteki ham değer → süresi geçmemiş kayıtlar (eski biçim: düz metin tek değer). */
export function stateListesiniCoz(ham: string | null, simdi: number): Kayit[] {
  if (!ham) return [];
  let liste: unknown;
  try {
    liste = JSON.parse(ham);
  } catch {
    liste = null;
  }
  if (!Array.isArray(liste)) return [{ s: ham, t: simdi }]; // M620 öncesi kayıt
  return liste.filter((k: any): k is Kayit =>
    !!k && typeof k.s === 'string' && typeof k.t === 'number' && simdi - k.t >= 0 && simdi - k.t <= STATE_OMRU_MS);
}

export async function oauthStateKaydet(state: string | null | undefined, simdi = Date.now()): Promise<void> {
  if (!state) return;
  try {
    const liste = stateListesiniCoz(await AsyncStorage.getItem(ANAHTAR), simdi).filter((k) => k.s !== state);
    liste.push({ s: state, t: simdi });
    await AsyncStorage.setItem(ANAHTAR, JSON.stringify(liste.slice(-STATE_TAVANI)));
  } catch {
    // Yazılamazsa dönüşte doğrulama düşer → kullanıcı yeniden dener (güvenli taraf).
  }
}

/** Gelen değer listede varsa YALNIZ onu siler ve true döner; yoksa listeye dokunmaz. */
export async function oauthStateTuket(gelen: string | null | undefined, simdi = Date.now()): Promise<boolean> {
  try {
    const liste = stateListesiniCoz(await AsyncStorage.getItem(ANAHTAR), simdi);
    const eslesen = liste.find((k) => oauthStateEsit(k.s, gelen));
    if (!eslesen) return false;
    const kalan = liste.filter((k) => k !== eslesen);
    if (kalan.length) await AsyncStorage.setItem(ANAHTAR, JSON.stringify(kalan));
    else await AsyncStorage.removeItem(ANAHTAR);
    return true;
  } catch {
    return false;
  }
}

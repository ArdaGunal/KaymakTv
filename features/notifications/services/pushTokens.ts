import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
// ⚠️ `expo-secure-store` DEĞİL, projenin platform-farkında sarmalayıcısı:
// web'de yerel keychain yok, sarmalayıcı `localStorage`'a düşüyor. Doğrudan
// `expo-secure-store` kullanmak web'de patlardı (`utils/secureStorage.ts`).
import * as SecureStore from '../../../utils/secureStorage';
import axios from 'axios';

import { logError } from '../../../utils/errorLog';

/**
 * F3 — push token kayıt/silme (docs/design/notifications.md F3).
 *
 * ==========================================================================
 * 🔴 BU KLASÖR F3'E KADAR BİLEREK AÇILMADI — ve bu dosya BAĞLI DOĞUYOR
 * ==========================================================================
 * `features/notifications/services/` bir kez açılmıştı: beş dosya
 * (`types.ts`, `hooks/useNotifications.ts`, `services/{expoPush,webPush,
 * notificationApi}.ts`) `return null` / `console.log` döndüren, hiçbir
 * yerden import edilmeyen TODO stub'ları olarak yazıldı ve **silindi**
 * (HISTORY Madde 165). `AI_RULES` §2.5: *"ileride lazım olur diye
 * bağlanmamış state/fonksiyon ekleme."*
 *
 * Bu dosya aynı turda `useNotificationSetup` ve `AuthContext`'e bağlanıyor.
 *
 * ==========================================================================
 * 🔴 TOKEN DOĞRUDAN SUPABASE'E YAZILMAZ
 * ==========================================================================
 * `push_tokens` tablosunda RLS açık ve HİÇBİR politika yok
 * (`supabase/schema/035_push_tokens.sql`) — anon anahtarla erişilemez.
 * Sebebi ciddi: Expo'nun gönderim ucu geçerli bir token için kimlik
 * doğrulaması İSTEMEZ, yani token sızarsa onu ele geçiren herkes o cihaza
 * bildirim gönderebilir. Kimlik Worker'da doğrulanır, yazımı `service_role`
 * yapar. (Aynı desen: `feedApi.ts` → Worker → Supabase.)
 */

const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

/** `push_tokens.platform` CHECK kısıtıyla AYNI küme. */
type PushPlatform = 'ios' | 'android' | 'web';

function currentPlatform(): PushPlatform | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  // Web push F4'ün işi — bugün kayıt yapmıyoruz. `null` dönmek, çağıranın
  // sessizce vazgeçmesini sağlıyor.
  return null;
}

/**
 * Cihazın Expo push token'ını alır.
 *
 * 🔴 `Device.isDevice` KONTROLÜ ZORUNLU: emülatörde `getExpoPushTokenAsync`
 * hata fırlatır. Kontrol olmasaydı her emülatör açılışında bir hata
 * loglanırdı ve gerçek sorunlar o gürültüde kaybolurdu.
 *
 * @returns token ya da `null` (asla throw etmez)
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    const izin = await Notifications.getPermissionsAsync();
    // İzin yoksa token istemek anlamsız — ve bazı sürümlerde hata verir.
    // İzin akışı `useNotificationSetup`'ın işi; burada yalnızca kontrol.
    if (izin.status !== 'granted') return null;

    // ⚠️ `projectId` OLMADAN çağırmak EAS build'lerinde çalışır ama bazı
    // ortamlarda "No projectId found" ile patlar. `app.json`'daki
    // `extra.eas.projectId` zaten var (notifications.md F0 satırı).
    const sonuc = await Notifications.getExpoPushTokenAsync();
    const token = sonuc?.data;
    return typeof token === 'string' && token ? token : null;
  } catch (error) {
    logError('pushTokens.getExpoPushToken', error);
    return null;
  }
}

/** Worker çağrısı için kimlik. Yoksa `null` → çağrı hiç yapılmaz. */
async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('traktAccessToken');
  } catch (error) {
    logError('pushTokens.auth', error);
    return null;
  }
}

/**
 * Cihazı kullanıcıya bağlar. Uygulama her açılışta çağırır.
 *
 * 🔴 HER AÇILIŞTA ÇAĞRILMASI BİLİNÇLİ: Worker `last_seen_at`'i tazeliyor ve
 * 90 günlük ölü token süpürmesi buna bakıyor (035_push_tokens.sql). Yalnızca
 * "ilk kurulumda bir kez" çağırsaydık, uygulamayı düzenli kullanan ama 3
 * aydır kimseden bildirim almamış bir kullanıcının token'ı silinirdi.
 *
 * 🔴 ASLA THROW ETMEZ. Açılış akışından çağrılıyor; buradan sızacak bir hata
 * bildirim kurulumunun tamamını düşürürdü.
 */
export async function registerPushToken(): Promise<boolean> {
  try {
    if (!KAYMAK_WORKER_URL) return false;

    const platform = currentPlatform();
    if (!platform) return false;

    const token = await getExpoPushToken();
    if (!token) return false;

    const auth = await getAuthToken();
    if (!auth) return false;

    const res = await axios.post(
      `${KAYMAK_WORKER_URL}/notifications/register`,
      { traktAccessToken: auth, platform, token },
      { headers: { 'Content-Type': 'application/json' }, timeout: 12000 },
    );
    return res.data?.success === true;
  } catch (error) {
    logError('pushTokens.register', error);
    return false;
  }
}

/**
 * Çıkışta cihaz kaydını siler.
 *
 * ⚠️ Bu bir NEZAKET, güvence DEĞİL: çıkış sırasında ağ yoksa çağrı kaybolur.
 * Asıl koruma sunucudaki `(platform, token_key)` tekilliği — bir sonraki
 * kullanıcı giriş yapınca satır zaten ona geçer (035_push_tokens.sql).
 *
 * 🔴 KİMLİK ÇIKIŞTAN ÖNCE OKUNMALI. `AuthContext.removeKeys()` token'ları
 * siliyor; bu fonksiyon oradan SİLME İŞLEMİNDEN ÖNCE çağrılmalı, yoksa
 * Worker'a gönderecek kimlik kalmaz ve istek 401 döner.
 */
export async function unregisterPushToken(): Promise<boolean> {
  try {
    if (!KAYMAK_WORKER_URL) return false;

    const platform = currentPlatform();
    if (!platform) return false;

    const token = await getExpoPushToken();
    if (!token) return false;

    const auth = await getAuthToken();
    if (!auth) return false;

    const res = await axios.post(
      `${KAYMAK_WORKER_URL}/notifications/unregister`,
      { traktAccessToken: auth, platform, token },
      { headers: { 'Content-Type': 'application/json' }, timeout: 8000 },
    );
    return res.data?.success === true;
  } catch (error) {
    logError('pushTokens.unregister', error);
    return false;
  }
}

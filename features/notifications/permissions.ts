import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { logError } from '../../utils/errorLog';
import type { NotificationPermissionStatus } from './types';

/**
 * Bildirim izninin TEK gerçek kaynağı (docs/design/notifications.md § 5).
 *
 * ⛔ Başka hiçbir dosya `Notifications.getPermissionsAsync` /
 * `requestPermissionsAsync` ÇAĞIRMAZ. Bu kural, aynı hatanın üç kez geri
 * geldiği misafir-kontrolü dağınıklığının (bkz. Madde 268) bildirim
 * karşılığıdır: izin mantığı çağrı yerlerine dağılırsa hangi ekranın izni ne
 * zaman istediği takip edilemez hale gelir.
 *
 * Durum makinesi:
 *   undetermined → (kullanıcı tetikler) → granted | denied
 *   denied → uygulama içinden GERİ DÖNÜLEMEZ → cihaz ayarlarına yönlendir
 */

/** Web'de `expo-notifications` no-op'tur; tüm giriş noktaları bunu kontrol eder. */
const isSupportedPlatform = (): boolean => Platform.OS !== 'web';

/**
 * Expo'nun izin yanıtını bizim durum makinemize çevirir.
 *
 * iOS'ta `provisional` (sessiz teslim) izni `granted` sayılıyor: bildirim
 * gerçekten teslim ediliyor, yalnızca sessiz geliyor. `denied` saymak,
 * çalışan bir kanalı kapalı göstermek olurdu.
 */
const mapStatus = (
  permission: Notifications.NotificationPermissionsStatus,
): NotificationPermissionStatus => {
  if (permission.granted) return 'granted';
  if (permission.status === 'undetermined') return 'undetermined';
  return 'denied';
};

/**
 * Mevcut izin durumunu okur. İzin İSTEMEZ — yalnızca sorar.
 * Ayarlar ekranının durum satırı bunu kullanır.
 */
export async function getPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (!isSupportedPlatform()) return 'unsupported';

  try {
    const permission = await Notifications.getPermissionsAsync();
    return mapStatus(permission);
  } catch (error) {
    // Sessiz başarısızlık YASAK (AI_RULES): durumu okuyamadıysak "izinli"
    // varsaymak, hiç gelmeyecek bildirimler için kullanıcıya "açık" göstermek
    // olurdu. `denied` dönmek kullanıcıyı en azından cihaz ayarlarına
    // yönlendiren satırı görünür kılar.
    logError('notifications.getPermissionStatus', error);
    return 'denied';
  }
}

/**
 * İzin ister.
 *
 * 🔴 BUNU UYGULAMA AÇILIŞINDA ÇAĞIRMA. iOS'ta bir kez reddedilen izin
 * uygulama içinden BİR DAHA istenemez; tek çıkış yolu kullanıcının cihaz
 * ayarlarına gitmesidir. Doğru an: kullanıcı Ayarlar'da bir bildirim
 * anahtarını İLK KEZ açtığında — anahtarın kendisi zaten niyeti anlatır,
 * ayrı bir açıklama ekranına gerek yoktur.
 */
export async function requestPermission(): Promise<NotificationPermissionStatus> {
  if (!isSupportedPlatform()) return 'unsupported';

  try {
    const current = await Notifications.getPermissionsAsync();

    // Zaten karara bağlanmışsa tekrar sorma. `canAskAgain === false` iken
    // `requestPermissionsAsync` çağırmak sistem diyaloğunu GÖSTERMEZ, sessizce
    // aynı reddi döndürür — kullanıcı butona basıp hiçbir şey olmadığını görür.
    if (current.granted) return 'granted';
    if (!current.canAskAgain) return 'denied';

    const requested = await Notifications.requestPermissionsAsync();
    return mapStatus(requested);
  } catch (error) {
    logError('notifications.requestPermission', error);
    return 'denied';
  }
}

/**
 * Cihazın uygulama ayarları ekranını açar — `denied` durumundaki TEK çıkış yolu.
 * Ayarlar'daki "Cihaz ayarlarını aç" butonu buraya bağlanır.
 */
export async function openSystemNotificationSettings(): Promise<void> {
  if (!isSupportedPlatform()) return;

  try {
    await Linking.openSettings();
  } catch (error) {
    logError('notifications.openSystemNotificationSettings', error);
  }
}

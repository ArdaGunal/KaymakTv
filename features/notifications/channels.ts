import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { logError } from '../../utils/errorLog';
import { NOTIFICATION_CATEGORIES } from './registry';
import type { NotificationChannelId } from './types';

/**
 * Android bildirim kanalları (docs/design/notifications.md § 5).
 *
 * 🔴 EN SIK ATLANAN ADIM: Android SDK 26+ üzerinde kanal AÇILMADAN gönderilen
 * bildirim hiç görünmez ve HİÇBİR HATA VERMEZ — sessizce yutulur. "Bildirim
 * kurdum ama gelmiyor" hatasının bir numaralı sebebi budur, o yüzden
 * `useNotificationSetup` her açılışta bunu çağırır (idempotent'tir).
 *
 * KATEGORİ BAŞINA AYRI KANAL olmasının sebebi ürün kararı: kullanıcı Android
 * sistem ayarlarından "prömiyerler kalsın, günlük bölümler sussun" diyebilsin.
 * Tek kanal kullanırsak bu ayrıntı seviyesi kaybolur ve kullanıcının elinde
 * tek bir "hepsini kapat" kalır — kaldırılma sebebi olan davranış tam da budur.
 *
 * iOS'ta kanal kavramı yoktur; bu dosyanın tamamı orada no-op'tur.
 */

interface ChannelDefinition {
  id: NotificationChannelId;
  /** `locales/{tr,en}/notifications.json` → `channels.<key>.name` / `.description` */
  i18nKey: string;
  importance: number;
}

/**
 * ⚠️ Bu liste `registry.ts`'teki `channelId` değerlerini KARŞILAMAK ZORUNDA.
 * Eksik bırakılırsa o kategorinin bildirimleri sessizce yutulur — bu yüzden
 * `ensureNotificationChannels` aşağıda açık bir tutarlılık kontrolü yapıyor.
 */
const CHANNEL_DEFINITIONS: readonly ChannelDefinition[] = [
  {
    id: 'episodes',
    i18nKey: 'episodes',
    // DEFAULT bilinçli: ses çıkarır ama ekranın üstünde "heads-up" balonu
    // olarak belirmez. HIGH, akşam 20:00'de izlediği filmi bölen bir balon
    // demek olurdu — "rahatsız edici olmasın" ilkesiyle çelişir.
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  {
    id: 'premieres',
    i18nKey: 'premieres',
    // Prömiyer, kullanıcının aylardır beklediği haberdir ve seyrektir —
    // heads-up balonunu hak eden tek kategori bu. Günlük bölüm bildirimine
    // HIGH vermek rahatsız edici olurdu, prömiyere vermemek ise haberi
    // diğerlerinin arasında kaybederdi.
    importance: Notifications.AndroidImportance.HIGH,
  },
  {
    id: 'movies',
    i18nKey: 'movies',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  {
    id: 'digest',
    i18nKey: 'digest',
    // Ayda bir gelen bir rapor; ses çıkarması makul ama heads-up balonu değil.
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  {
    // 🆕 F3 — sosyal (yorum/beğeni). Worker gönderirken `channelId: 'social'`
    // yazıyor; bu kanal AÇILMAZSA Android bildirimi varsayılan kanalda
    // gösterir — kaybolmaz ama kullanıcı sistem ayarlarından ayrı
    // ayarlayamaz (dosya başlığındaki "kanal başına ayrı" gerekçesi).
    id: 'social',
    i18nKey: 'social',
    // DEFAULT: birinin yoruma/beğeniye verdiği tepki, kullanıcının BEKLEDİĞİ
    // bir geri bildirim — sessiz olmamalı. Ama heads-up balonu da değil.
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  {
    id: 'reminders',
    i18nKey: 'reminders',
    // LOW = sessiz: ses çıkarmaz, yalnızca tepside belirir. Bir dürtme
    // kullanıcının dikkatini ÇALMAMALI; hatırlatma olmalı, çağrı değil.
    importance: Notifications.AndroidImportance.LOW,
  },
];

/**
 * Tüm kanalları oluşturur/günceller. Idempotent: aynı id ile tekrar çağırmak
 * mevcut kanalı günceller, ikinci bir kanal yaratmaz.
 *
 * ⚠️ Android, kullanıcı bir kanalın ayarını elle değiştirdikten sonra o
 * kanalın `importance` değerini UYGULAMANIN değiştirmesine izin vermez —
 * kullanıcının tercihi kazanır. Bu istenen davranıştır, hata değildir.
 *
 * @param translate `useTranslation('notifications')`'tan gelen `t`. Kanal adı
 *   Android sistem ayarlarında görünür, yani KULLANICIYA GÖRÜNEN bir metindir
 *   ve çevrilmek zorundadır — bu yüzden dışarıdan geçiliyor.
 */
export async function ensureNotificationChannels(
  translate: (key: string) => string,
): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Tutarlılık kontrolü: kayıt defterindeki her kanalın burada bir tanımı var mı?
  // Sessizce yutulan bildirim yerine geliştirme sırasında görünür bir uyarı.
  const definedIds = new Set(CHANNEL_DEFINITIONS.map((channel) => channel.id));
  for (const category of NOTIFICATION_CATEGORIES) {
    if (!definedIds.has(category.channelId)) {
      logError(
        'notifications.ensureNotificationChannels',
        new Error(
          `'${category.id}' kategorisi '${category.channelId}' kanalını istiyor ama CHANNEL_DEFINITIONS'ta böyle bir kanal yok — bu kategorinin bildirimleri Android'de sessizce yutulur.`,
        ),
      );
    }
  }

  for (const channel of CHANNEL_DEFINITIONS) {
    try {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: translate(`channels.${channel.i18nKey}.name`),
        description: translate(`channels.${channel.i18nKey}.description`),
        importance: channel.importance,
      });
    } catch (error) {
      // Tek bir kanalın kurulamaması diğerlerini engellemesin — döngü devam
      // eder. Sessiz başarısızlık YASAK olduğu için hata yine de kaydedilir.
      logError(`notifications.ensureNotificationChannels:${channel.id}`, error);
    }
  }
}

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { logError } from '../../../utils/errorLog';
import { getPermissionStatus, requestPermission } from '../permissions';
import { NOTIFICATION_CATEGORIES } from '../registry';
import { COPY_POOL, variantBodyKey, variantTitleKey } from '../copy/pool';
import { pickVariant } from '../copy/picker';
import { interpolate } from '../copy/interpolate';
import { mergeRemotePool } from '../copy/remoteSchema';
import { loadCachedRemotePool } from '../copy/remotePool';
import type { NotificationPermissionStatus } from '../types';

/**
 * Geliştirici Paneli'nin bildirim teşhis kartı.
 *
 * 🔴 VAR OLUŞ SEBEBİ: bu kart olmadan bildirim sistemini test etmenin TEK yolu
 * gerçek bir bölümün yayın gününde tercih edilen saati BEKLEMEK. Yani bir
 * hatanın fark edilmesi günler — bazı kategorilerde HAFTALAR — alabilirdi.
 * Buradaki düğmeler tüm zinciri (izin → kanal → zamanlayıcı → teslim →
 * tıklama → metin) saniyeler içinde doğrulanabilir hale getiriyor:
 *
 *   • İzin iste            — izin akışını tetikler
 *   • 10 sn sonra test     — teslim + tıklama/deep link zinciri
 *   • Bekleyenleri listele — zamanlayıcı ne yazdı? kategori dökümüyle
 *   • Örnek gönder         — HER kategoriden gerçek havuz metniyle bir örnek
 *   • Havuz durumu         — kaç varyant var, uzak havuz ulaştı mı?
 *
 * Test protokolü: `docs/runbook/BILDIRIM_TEST_PROTOKOLU.md`
 *
 * ⚠️ Test bildirimi `plannedFireAt` alanını BİLİNÇLİ OLARAK taşımıyor.
 * `scheduler.ts`'teki `readOwnPayload` o alan yoksa bildirimi "bizim değil"
 * sayıp dokunmuyor — böylece test bildirimi, arka planda çalışan bir yeniden
 * planlama turu tarafından patlamadan İPTAL EDİLMİYOR.
 */

const TEST_DELAY_SECONDS = 10;

/** Örnek bildirimler arasındaki boşluk — hepsi üst üste düşüp okunmaz olmasın. */
const SAMPLE_GAP_SECONDS = 8;

/**
 * Örnek metinlerde kullanılan sahte değerler. Gerçek veri BEKLEMEDEN metnin
 * nasıl görüneceğini (enterpolasyon, i18n, uzak havuz) doğrulamak için.
 */
const SAMPLE_VARS = {
  showTitle: 'Breaking Bad',
  title: 'Dune: Part Two',
  seasonNumber: 3,
  episodeNumber: 7,
  count: 4,
  hours: 45,
  episodes: 62,
  movies: 3,
  periodDays: 30,
};

interface PendingSummary {
  total: number;
  lines: string[];
}

export function NotificationDebugCard() {
  const { t, i18n } = useTranslation('notifications');
  const [status, setStatus] = useState<string>('');
  const [pending, setPending] = useState<PendingSummary | null>(null);
  const [permission, setPermission] = useState<NotificationPermissionStatus | null>(null);

  const refreshPermission = useCallback(async () => {
    setPermission(await getPermissionStatus());
  }, []);

  React.useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  const handleRequestPermission = useCallback(async () => {
    const result = await requestPermission();
    setPermission(result);
    setStatus(t('debug.permissionResult', { status: result }));
  }, [t]);

  const handleSendTest = useCallback(async () => {
    if (Platform.OS === 'web') {
      setStatus(t('permission.unsupported'));
      return;
    }

    try {
      const current = await getPermissionStatus();
      if (current !== 'granted') {
        setStatus(t('debug.permissionResult', { status: current }));
        return;
      }

      // Kurulu GERÇEK bir planın hedefini ödünç al: böylece test bildirimine
      // tıklamak, deep link + geri navigasyon zincirini de sınar. Plan yoksa
      // bildirim yönlendirmesiz gider (tıklayınca uygulama açılır).
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      const borrowedLink = existing
        .map((request) => (request.content?.data as { deepLink?: string } | undefined)?.deepLink)
        .find((link): link is string => typeof link === 'string' && link.startsWith('/'));

      await Notifications.scheduleNotificationAsync({
        identifier: 'debug:test-notification',
        content: {
          title: t('debug.testTitle'),
          body: t('debug.testBody', { seconds: TEST_DELAY_SECONDS }),
          // `plannedFireAt` YOK — yukarıdaki başlık notuna bak.
          data: borrowedLink ? { categoryId: 'debug', deepLink: borrowedLink } : { categoryId: 'debug' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: TEST_DELAY_SECONDS,
          repeats: false,
          channelId: 'episodes',
        },
      });

      setStatus(
        t('debug.testScheduled', {
          seconds: TEST_DELAY_SECONDS,
          target: borrowedLink ?? t('debug.noTarget'),
        }),
      );
    } catch (error) {
      logError('NotificationDebugCard.sendTest', error);
      setStatus(String(error));
    }
  }, [t]);

  const handleListPending = useCallback(async () => {
    if (Platform.OS === 'web') {
      setStatus(t('permission.unsupported'));
      return;
    }

    try {
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      // Kategori dökümü: hangi kategoriden kaç plan kurulu? "Prömiyer hiç
      // planlanmamış" gibi bir eksiği tek bakışta gösterir.
      const sayac = new Map<string, number>();
      for (const request of existing) {
        const kategori = (request.content?.data as { categoryId?: string } | undefined)?.categoryId;
        if (typeof kategori === 'string') sayac.set(kategori, (sayac.get(kategori) ?? 0) + 1);
      }
      const dokum = [...sayac.entries()].map(([k, adet]) => `${k}: ${adet}`);

      const lines = dokum.concat(existing.slice(0, 6).map((request) => {
        const data = request.content?.data as { plannedFireAt?: number } | undefined;
        const when =
          typeof data?.plannedFireAt === 'number'
            ? new Date(data.plannedFireAt).toLocaleString()
            : '?';
        return `${request.identifier} → ${when}`;
      }));
      setPending({ total: existing.length, lines });
      setStatus('');
    } catch (error) {
      logError('NotificationDebugCard.listPending', error);
      setStatus(String(error));
    }
  }, [t]);

  /**
   * 🔑 ASIL TEŞHİS ARACI: her kategori için, HAVUZDAN GERÇEK METİNLE bir örnek
   * bildirim kurar.
   *
   * Neden var: kategorilerin çoğu gerçek hayatta HAFTALAR sonra tetiklenir
   * (sezon prömiyeri, aylık özet, 7 günlük dürtme). Metnin doğru göründüğünü,
   * değişkenlerin dolduğunu ve doğru kanala düştüğünü görmek için o kadar
   * beklemek gerekmemeli.
   *
   * ⚠️ Bunlar SAHTE veriyle üretilir ve `plannedFireAt` TAŞIMAZ — böylece
   * `scheduler` onları "bizim" saymaz, arka planda iptal etmez ve uygulama
   * içi bildirim kutusuna da GİRMEZLER (gerçek bir bildirim düşmüş gibi
   * görünmesinler).
   */
  const handleSendSamples = useCallback(async () => {
    if (Platform.OS === 'web') {
      setStatus(t('permission.unsupported'));
      return;
    }

    try {
      const current = await getPermissionStatus();
      if (current !== 'granted') {
        setStatus(t('debug.permissionResult', { status: current }));
        return;
      }

      // Uzak havuz da dahil edilir: Supabase'e eklenen bir metnin cihaza
      // gerçekten ulaşıp ulaşmadığı ancak böyle görülebilir.
      const pool = mergeRemotePool(COPY_POOL, await loadCachedRemotePool(), i18n.language);

      let gonderilen = 0;
      for (const category of NOTIFICATION_CATEGORIES) {
        const variant = pickVariant(pool, {
          categoryId: category.id,
          tone: category.tone,
          now: new Date(),
          recentIds: [],
          random: Math.random,
        });
        if (!variant) continue;

        const baslik = variant.text
          ? interpolate(variant.text.title, SAMPLE_VARS)
          : t(variantTitleKey(variant), SAMPLE_VARS);
        const govde = variant.text
          ? interpolate(variant.text.body, SAMPLE_VARS)
          : t(variantBodyKey(variant), SAMPLE_VARS);

        await Notifications.scheduleNotificationAsync({
          identifier: `debug:sample:${category.id}`,
          content: {
            title: baslik,
            body: govde,
            // `plannedFireAt` YOK — yukarıdaki nota bak.
            data: { categoryId: 'debug', sampleOf: category.id, variantId: variant.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: TEST_DELAY_SECONDS + gonderilen * SAMPLE_GAP_SECONDS,
            repeats: false,
            channelId: category.channelId,
          },
        });
        gonderilen += 1;
      }

      setStatus(t('debug.samplesScheduled', { count: gonderilen, seconds: TEST_DELAY_SECONDS }));
    } catch (error) {
      logError('NotificationDebugCard.sendSamples', error);
      setStatus(String(error));
    }
  }, [t, i18n.language]);

  /** Havuzun gerçekte kaç varyant taşıdığı — uzak havuz ulaştı mı? */
  const handlePoolStatus = useCallback(async () => {
    try {
      const remote = await loadCachedRemotePool();
      const merged = mergeRemotePool(COPY_POOL, remote, i18n.language);
      setPending({
        total: merged.length,
        lines: NOTIFICATION_CATEGORIES.map((category) => {
          const adet = merged.filter((v) => v.category === category.id).length;
          return `${category.id}: ${adet} varyant`;
        }).concat(`uzak havuz: ${remote.length} satir`),
      });
      setStatus('');
    } catch (error) {
      logError('NotificationDebugCard.poolStatus', error);
      setStatus(String(error));
    }
  }, [i18n.language]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('debug.title')}</Text>
      <Text style={styles.meta}>
        {t('debug.permissionLabel')}: {permission ?? '…'}
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={() => void handleRequestPermission()} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{t('debug.requestPermission')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => void handleSendTest()} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{t('debug.sendTest', { seconds: TEST_DELAY_SECONDS })}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => void handleListPending()} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{t('debug.listPending')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => void handleSendSamples()} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{t('debug.sendSamples')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => void handlePoolStatus()} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{t('debug.poolStatus')}</Text>
        </TouchableOpacity>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      {pending ? (
        <View style={styles.pendingBlock}>
          <Text style={styles.pendingTitle}>{t('debug.pendingCount', { count: pending.total })}</Text>
          {pending.lines.length === 0 ? (
            <Text style={styles.pendingLine}>{t('debug.pendingEmpty')}</Text>
          ) : (
            pending.lines.map((line) => (
              <Text key={line} style={styles.pendingLine} numberOfLines={1}>
                {line}
              </Text>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 10,
  },
  title: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  meta: { color: '#94a3b8', fontSize: 12 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.16)',
  },
  buttonText: { color: '#60a5fa', fontSize: 12, fontWeight: '700' },
  status: { color: '#fbbf24', fontSize: 12 },
  pendingBlock: { gap: 4, marginTop: 4 },
  pendingTitle: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  pendingLine: { color: '#94a3b8', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});

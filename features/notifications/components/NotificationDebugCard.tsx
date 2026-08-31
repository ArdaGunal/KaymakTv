import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { logError } from '../../../utils/errorLog';
import { getPermissionStatus, requestPermission } from '../permissions';
import type { NotificationPermissionStatus } from '../types';

/**
 * Geliştirici Paneli'nin bildirim teşhis kartı.
 *
 * 🔴 VAR OLUŞ SEBEBİ: bu kart olmadan bildirim sistemini test etmenin TEK yolu
 * gerçek bir bölümün yayın gününde tercih edilen saati BEKLEMEK. Yani bir
 * hatanın fark edilmesi günler alabilirdi. Buradaki iki düğme, tüm zinciri
 * (izin → kanal → zamanlayıcı → teslim → tıklama) saniyeler içinde
 * doğrulanabilir hale getiriyor.
 *
 * ⚠️ Test bildirimi `plannedFireAt` alanını BİLİNÇLİ OLARAK taşımıyor.
 * `scheduler.ts`'teki `readOwnPayload` o alan yoksa bildirimi "bizim değil"
 * sayıp dokunmuyor — böylece test bildirimi, arka planda çalışan bir yeniden
 * planlama turu tarafından patlamadan İPTAL EDİLMİYOR.
 */

const TEST_DELAY_SECONDS = 10;

interface PendingSummary {
  total: number;
  lines: string[];
}

export function NotificationDebugCard() {
  const { t } = useTranslation('notifications');
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
      const lines = existing.slice(0, 8).map((request) => {
        const data = request.content?.data as { plannedFireAt?: number } | undefined;
        const when =
          typeof data?.plannedFireAt === 'number'
            ? new Date(data.plannedFireAt).toLocaleString()
            : '?';
        return `${request.identifier} → ${when}`;
      });
      setPending({ total: existing.length, lines });
      setStatus('');
    } catch (error) {
      logError('NotificationDebugCard.listPending', error);
      setStatus(String(error));
    }
  }, [t]);

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

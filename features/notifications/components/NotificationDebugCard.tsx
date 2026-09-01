import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
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

const TEST_DELAY_SECONDS = 10;
const SAMPLE_GAP_SECONDS = 8;

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
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

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

      const existing = await Notifications.getAllScheduledNotificationsAsync();
      const borrowedLink = existing
        .map((request) => (request.content?.data as { deepLink?: string } | undefined)?.deepLink)
        .find((link): link is string => typeof link === 'string' && link.startsWith('/'));

      await Notifications.scheduleNotificationAsync({
        identifier: 'debug:test-notification',
        content: {
          title: t('debug.testTitle'),
          body: t('debug.testBody', { seconds: TEST_DELAY_SECONDS }),
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

  const buttons = (
    <>
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
    </>
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('debug.title')}</Text>
        <View style={styles.permissionBadge}>
          <Text style={styles.meta}>
            {t('debug.permissionLabel')}: <Text style={styles.permissionValue}>{permission ?? '…'}</Text>
          </Text>
        </View>
      </View>

      {isDesktop ? (
        <View style={styles.buttonWrapWeb}>{buttons}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.buttonScrollMobile}
        >
          {buttons}
        </ScrollView>
      )}

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
    backgroundColor: 'rgba(27, 32, 42, 0.75)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  permissionBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  meta: {
    color: '#8c90a0',
    fontSize: 11,
  },
  permissionValue: {
    color: '#93c5fd',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonWrapWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  buttonScrollMobile: {
    flexDirection: 'row',
    gap: 6,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  buttonText: {
    color: '#cbd5e1',
    fontSize: 11.5,
    fontWeight: '600',
  },
  status: {
    color: '#f59e0b',
    fontSize: 11.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pendingBlock: {
    gap: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 8,
    borderRadius: 8,
  },
  pendingTitle: {
    color: '#cbd5e1',
    fontSize: 11.5,
    fontWeight: '700',
  },
  pendingLine: {
    color: '#8c90a0',
    fontSize: 10.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

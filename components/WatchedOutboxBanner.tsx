import { Text, View, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWatchedOutboxStore } from '../store/watchedOutboxStore';
import { resumeWatchedOutbox } from '../services/library/outbox/runtime';
import { useHiddenOutboxStore } from '../store/hiddenOutboxStore';
import { resumeHiddenOutbox } from '../services/library/hiddenOutbox/runtime';

/** Başarı = cihazda kalıcı. Sunucuya henüz gitmediyse bu bilgi saklanmaz. */
export default function WatchedOutboxBanner() {
  const { pendingCount, hasError, ready, saveError } = useWatchedOutboxStore();
  const hidden = useHiddenOutboxStore();
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const watchedVisible = !!(pendingCount || hasError || saveError);
  if (!watchedVisible && !hidden.pendingCount && !hidden.hasError && !hidden.saveError) return null;
  const hiddenText = hidden.saveError ? 'hiddenSaveError' : hidden.ready ? 'hiddenQueued' : 'hiddenQueueUnavailable';
  return <View style={[styles.banner, { bottom: insets.bottom + 76 }]}>
    <Text style={styles.text}>{[
      watchedVisible ? t(saveError ? 'watchedSaveError' : ready ? 'watchedQueued' : 'watchedQueueUnavailable', { count: pendingCount }) : null,
      hidden.pendingCount || hidden.hasError || hidden.saveError ? t(hiddenText, { count: hidden.pendingCount }) : null,
    ].filter(Boolean).join('\n')}</Text>
    {((ready && hasError && !saveError) || (hidden.ready && hidden.hasError && !hidden.saveError)) && <Pressable
      onPress={() => { resumeWatchedOutbox(); resumeHiddenOutbox(); }} accessibilityRole="button">
      <Text style={styles.retry}>{t('retry')}</Text>
    </Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  banner: { position: 'absolute', left: 12, right: 12, zIndex: 9998,
    backgroundColor: '#1e293b', borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { color: '#cbd5e1', flex: 1, fontSize: 12 },
  retry: { color: '#60a5fa', padding: 4 },
});

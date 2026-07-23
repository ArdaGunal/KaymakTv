import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { Copy, Trash2, Inbox, ChevronDown, ChevronUp } from 'lucide-react-native';

import { SettingsHeader } from '../../components/settings/SettingsHeader';
import Snackbar from '../../components/Snackbar';
import LoadingIndicator from '../../components/LoadingIndicator';
import { useErrorLog } from '../../hooks/useErrorLog';
import { LoggedError } from '../../utils/errorLog';
import { confirmAsync } from '../../utils/confirmDialog';

const DESKTOP_BREAKPOINT = 768;

function formatTimestamp(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface LogEntryRowProps {
  entry: LoggedError;
  locale: string;
}

// Dokununca genişleyip stack/tags gösterir — 50 kaydın hepsini açık basmak
// (özellikle uzun stack trace'lerle) listeyi kullanılamaz kılar.
function LogEntryRow({ entry, locale }: LogEntryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!entry.stack || !!entry.tags;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={hasDetails ? 0.7 : 1}
      onPress={() => hasDetails && setExpanded((prev) => !prev)}
      disabled={!hasDetails}
    >
      <View style={styles.rowHeader}>
        <View style={styles.rowHeaderText}>
          <Text style={styles.timestamp}>{formatTimestamp(entry.timestamp, locale)}</Text>
          <Text style={styles.context} numberOfLines={1}>{entry.context}</Text>
          <Text style={styles.message} numberOfLines={expanded ? undefined : 2}>
            {entry.message}
          </Text>
        </View>
        {hasDetails ? (
          expanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />
        ) : null}
      </View>

      {expanded && (
        <View style={styles.details}>
          {entry.tags ? <Text style={styles.tags}>{JSON.stringify(entry.tags)}</Text> : null}
          {entry.stack ? <Text style={styles.stack}>{entry.stack}</Text> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ErrorLogScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation(['settings', 'common']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { entries, isLoading, isRefreshing, refresh, clear } = useErrorLog();
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(protected)/(tabs)/explore');
  };

  const showToast = useCallback((message: string) => {
    setToast({ visible: true, message });
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(JSON.stringify(entries, null, 2));
      showToast(t('settings:errorLogCopySuccess'));
    } catch {
      showToast(t('common:error'));
    }
  }, [entries, t, showToast]);

  const handleClear = useCallback(async () => {
    const confirmed = await confirmAsync(
      t('settings:errorLogClearConfirmTitle'),
      t('settings:errorLogClearConfirmText'),
      t('common:delete'),
      t('common:cancel')
    );
    if (!confirmed) return;
    await clear();
    showToast(t('settings:errorLogClearSuccess'));
  }, [clear, t, showToast]);

  const renderItem = useCallback(({ item }: { item: LoggedError }) => (
    <LogEntryRow entry={item} locale={i18n.language} />
  ), [i18n.language]);

  const keyExtractor = useCallback((item: LoggedError, index: number) => `${item.timestamp}-${index}`, []);

  const hasEntries = entries.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <SettingsHeader title={t('settings:errorLogTitle')} isDesktop={isDesktop} onBack={navigateBack} />

      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        {hasEntries && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCopy} activeOpacity={0.7}>
              <Copy size={16} color="#38bdf8" />
              <Text style={[styles.actionText, { color: '#38bdf8' }]}>{t('settings:errorLogCopyAction')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleClear} activeOpacity={0.7}>
              <Trash2 size={16} color="#f87171" />
              <Text style={[styles.actionText, { color: '#f87171' }]}>{t('settings:errorLogClearAction')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <View style={styles.centered}>
            <LoadingIndicator size="large" />
          </View>
        ) : !hasEntries ? (
          <View style={styles.centered}>
            <View style={styles.emptyIconWrap}>
              <Inbox size={36} color="#334155" />
            </View>
            <Text style={styles.emptyTitle}>{t('settings:errorLogEmptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('settings:errorLogEmptyText')}</Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#94a3b8" />
            }
          />
        )}
      </View>

      <Snackbar
        visible={toast.visible}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
        duration={2500}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 40,
    gap: 10,
  },
  row: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowHeaderText: {
    flex: 1,
    gap: 3,
  },
  timestamp: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  context: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
  },
  message: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 18,
  },
  details: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  tags: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  stack: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

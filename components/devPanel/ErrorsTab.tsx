import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { Copy, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import ErrorEntryRow from './ErrorEntryRow';
import EmptyState from './EmptyState';
import ListSkeleton from './ListSkeleton';
import SearchBar from './SearchBar';
import { listActionStyles as styles } from './listActionStyles';
import { normalizeForSearch } from '../../hooks/libraryFilterCore';
import type { LoggedError } from '../../utils/errorLog';

interface ErrorsTabProps {
  entries: LoggedError[];
  onCopy: () => Promise<void>;
  onClear: () => void;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  locale: string;
}

/** Geliştirici Paneli'nin Hata Günlüğü sekmesi — eskiden bağımsız bir ekran
 * olan error-log.tsx'in davranışının BİREBİR AYNISI, yalnızca panelin bir
 * sekmesine taşındı (bkz. docs/HISTORY.md). */
export default function ErrorsTab({ entries, onCopy, onClear, isLoading, isRefreshing, onRefresh, locale }: ErrorsTabProps) {
  const { t } = useTranslation(['settings', 'common']);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = useMemo(() => {
    const normalizedQuery = normalizeForSearch(searchQuery);
    if (!normalizedQuery) return entries;
    return entries.filter(
      (e) =>
        normalizeForSearch(e.context).includes(normalizedQuery) ||
        normalizeForSearch(e.message).includes(normalizedQuery)
    );
  }, [entries, searchQuery]);

  const renderItem = useCallback(
    ({ item }: { item: LoggedError }) => <ErrorEntryRow entry={item} locale={locale} />,
    [locale]
  );
  const keyExtractor = useCallback((item: LoggedError, index: number) => `${item.timestamp}-${index}`, []);

  const hasEntries = entries.length > 0;
  const noFilteredResults = hasEntries && filteredEntries.length === 0;

  return (
    <>
      {hasEntries && (
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('settings:devPanelSearchErrorsPlaceholder', 'Bağlam veya mesaja göre ara...')}
        />
      )}

      {hasEntries && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={onCopy} activeOpacity={0.7}>
            <Copy size={16} color="#38bdf8" />
            <Text style={[styles.actionText, { color: '#38bdf8' }]}>{t('settings:errorLogCopyAction')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onClear} activeOpacity={0.7}>
            <Trash2 size={16} color="#f87171" />
            <Text style={[styles.actionText, { color: '#f87171' }]}>{t('settings:errorLogClearAction')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : !hasEntries ? (
        <EmptyState title={t('settings:errorLogEmptyTitle')} text={t('settings:errorLogEmptyText')} />
      ) : noFilteredResults ? (
        <EmptyState
          title={t('settings:errorLogEmptyTitle')}
          text={t('settings:devPanelNoResultsForSearch', 'Aramanla eşleşen ölçüm yok.')}
        />
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#94a3b8" />}
        />
      )}
    </>
  );
}

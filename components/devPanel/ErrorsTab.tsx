import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Copy, Trash2 } from '../icons';
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

export default function ErrorsTab({
  entries,
  onCopy,
  onClear,
  isLoading,
  locale,
}: ErrorsTabProps) {
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

  const hasEntries = entries.length > 0;
  const noFilteredResults = hasEntries && filteredEntries.length === 0;

  return (
    <View style={styles.container}>
      {hasEntries && (
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('settings:devPanelSearchErrorsPlaceholder', 'Bağlam veya mesaja göre ara...')}
        />
      )}

      {hasEntries && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButtonSecondary} onPress={onCopy} activeOpacity={0.7}>
            <Copy size={15} color="#60a5fa" />
            <Text style={styles.actionTextSecondary}>{t('settings:errorLogCopyAction')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onClear} activeOpacity={0.7}>
            <Trash2 size={15} color="#f87171" />
            <Text style={styles.actionText}>{t('settings:errorLogClearAction')}</Text>
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
        <View style={styles.entriesList}>
          {filteredEntries.map((item, index) => (
            <ErrorEntryRow
              key={`${item.timestamp}-${item.context}-${index}`}
              entry={item}
              locale={locale}
            />
          ))}
        </View>
      )}
    </View>
  );
}

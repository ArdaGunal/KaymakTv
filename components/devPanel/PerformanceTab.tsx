import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { Trash2 } from '../icons';
import { useTranslation } from 'react-i18next';

import CategoryChip from './CategoryChip';
import PerfEntryRow from './PerfEntryRow';
import EmptyState from './EmptyState';
import ListSkeleton from './ListSkeleton';
import SearchBar from './SearchBar';
import { listActionStyles as styles } from './listActionStyles';
import { normalizeForSearch } from '../../hooks/libraryFilterCore';
import type { PerfMark, PerfCategory } from '../../utils/perfLog';
import type { CategorySummary } from '../../hooks/useDeveloperPanel';

interface PerformanceTabProps {
  entries: PerfMark[];
  categorySummaries: CategorySummary[];
  selectedCategory: PerfCategory | null;
  onSelectCategory: (category: PerfCategory | null) => void;
  onClear: () => void;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  locale: string;
}

/** Geliştirici Paneli'nin Performans sekmesi — kategori çipleri, "Temizle"
 * eylemi ve ham ölçüm listesi. Süzme (selectedCategory) ekranda (dev-panel.tsx)
 * tutulur, bu bileşen SAF sunumdur. */
export default function PerformanceTab({
  entries,
  categorySummaries,
  selectedCategory,
  onSelectCategory,
  onClear,
  isLoading,
  isRefreshing,
  onRefresh,
  locale,
}: PerformanceTabProps) {
  const { t } = useTranslation(['settings', 'common']);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = useMemo(() => {
    let result = selectedCategory ? entries.filter((e) => e.category === selectedCategory) : entries;
    const normalizedQuery = normalizeForSearch(searchQuery);
    if (normalizedQuery) {
      result = result.filter((e) => normalizeForSearch(e.name).includes(normalizedQuery));
    }
    return result;
  }, [entries, selectedCategory, searchQuery]);

  const renderItem = useCallback(
    ({ item }: { item: PerfMark }) => <PerfEntryRow entry={item} locale={locale} />,
    [locale]
  );
  const keyExtractor = useCallback((item: PerfMark, index: number) => `${item.timestamp}-${index}`, []);

  const hasEntries = entries.length > 0;
  const noFilteredResults = hasEntries && filteredEntries.length === 0;

  return (
    <>
      {hasEntries && (
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('settings:devPanelSearchPerfPlaceholder', 'İstek adına göre ara...')}
        />
      )}

      {categorySummaries.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <CategoryChip
            label={t('settings:devPanelCategoryAll', 'Tümü')}
            active={selectedCategory === null}
            onPress={() => onSelectCategory(null)}
          />
          {categorySummaries.map((summary) => (
            <CategoryChip
              key={summary.category}
              label={`${summary.category} ø${summary.avgMs}ms`}
              active={selectedCategory === summary.category}
              onPress={() => onSelectCategory(selectedCategory === summary.category ? null : summary.category)}
            />
          ))}
        </View>
      )}

      {hasEntries && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={onClear} activeOpacity={0.7}>
            <Trash2 size={16} color="#f87171" />
            <Text style={[styles.actionText, { color: '#f87171' }]}>{t('settings:errorLogClearAction')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : !hasEntries ? (
        <EmptyState
          title={t('settings:devPanelEmptyPerfTitle', 'Henüz ölçüm yok')}
          text={t(
            'settings:devPanelEmptyPerfText',
            'Uygulamayı kullandıkça ağ ve başlangıç süreleri burada listelenecek.'
          )}
        />
      ) : noFilteredResults ? (
        <EmptyState
          title={t('settings:devPanelEmptyPerfTitle', 'Henüz ölçüm yok')}
          text={
            searchQuery
              ? t('settings:devPanelNoResultsForSearch', 'Aramanla eşleşen ölçüm yok.')
              : t('settings:devPanelNoResultsForFilter', 'Bu kategoride ölçüm yok.')
          }
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

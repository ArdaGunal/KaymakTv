import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Rss, Trash2 } from 'lucide-react-native';
import FeedCard from '../../features/feed/components/FeedCard';
import MarathonFeedCard from '../../features/feed/components/MarathonFeedCard';
import FeedSkeleton from '../../features/feed/components/FeedSkeleton';
import { useUserActivity } from '../../features/feed/hooks/useUserActivity';
import { isMarathonActivity } from '../../features/feed/types';
import { confirmAsync } from '../../features/feed/utils/confirmDialog';
import { SECTION_PADDING_H } from './profileMetrics';

interface ProfileActivityTabProps {
  traktSlug: string | null;
}

// TODO: Activity delete UI hidden pending DB architecture decision (Tombstone
// vs Soft Delete vs Delta Sync — bkz. docs/HISTORY.md). Kod SİLİNMEDİ, yalnızca
// bu bayrak `false` olduğu sürece render edilmiyor: "Düzenle" butonu, seçim
// modu (checkbox), toplu silme alt çubuğu ve — FeedCard/MarathonFeedCard'a
// `onDelete` verilmediği için — mobildeki sola kaydırma ile web'deki hover
// çöp kutusu ikonu (bkz. features/feed/components/ActivityDeleteRow.tsx)
// HİÇ render edilmiyor. Mimari karar netleşince `true` yapılıp geri açılacak.
const ACTIVITY_DELETE_ENABLED = false;

export default function ProfileActivityTab({ traktSlug }: ProfileActivityTabProps) {
  const { t } = useTranslation(['media', 'common']);
  const { data, isLoading, deleteItem, deleteItems } = useUserActivity(traktSlug);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectionMode = () => {
    setIsSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const selectedItems = data.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) return;

    const confirmed = await confirmAsync(
      t('activityBulkDeleteTitle', 'Aktiviteleri Sil'),
      t('activityBulkDeleteText', '{{count}} aktiviteyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.', {
        count: selectedItems.length,
      }),
      t('common:delete'),
      t('common:cancel')
    );
    if (!confirmed) return;

    await deleteItems(selectedItems);
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <FeedSkeleton />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Rss size={36} color="#334155" />
        <Text style={styles.emptyTitle}>{t('profileActivityEmptyTitle', 'Henüz aktivite yok')}</Text>
        <Text style={styles.emptyText}>
          {t('profileActivityEmptyText', 'Dizi/film izledikçe veya puanladıkça burada görünecek.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t('profileActivityTab')}</Text>
        {/* TODO: Activity delete UI hidden pending DB architecture decision — bkz. yukarıdaki ACTIVITY_DELETE_ENABLED notu. */}
        {ACTIVITY_DELETE_ENABLED && (
          <TouchableOpacity style={styles.editButton} onPress={toggleSelectionMode} activeOpacity={0.7}>
            {isSelectionMode ? <Check size={13} color="#38bdf8" /> : <Pencil size={13} color="#94a3b8" />}
            <Text style={[styles.editButtonText, isSelectionMode && styles.editButtonTextActive]}>
              {isSelectionMode ? t('activityDoneAction', 'Bitti') : t('activityEditAction', 'Düzenle')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {data.map((item) => {
        // TODO: Activity delete UI hidden pending DB architecture decision —
        // ACTIVITY_DELETE_ENABLED false iken bu proplar hiç geçilmiyor,
        // FeedCard/MarathonFeedCard `onDelete` yoksa ActivityDeleteRow
        // sarmalayıcıyı (swipe/hover-sil/checkbox) zaten render etmiyor.
        const deleteProps = ACTIVITY_DELETE_ENABLED
          ? {
              isSelectionMode,
              isSelected: selectedIds.has(item.id),
              onToggleSelect: () => toggleSelect(item.id),
              onDelete: () => deleteItem(item),
            }
          : {};

        return isMarathonActivity(item) ? (
          <MarathonFeedCard key={item.id} activity={item} {...deleteProps} />
        ) : (
          <FeedCard key={item.id} activity={item} {...deleteProps} />
        );
      })}

      {/* TODO: Activity delete UI hidden pending DB architecture decision — bkz. yukarıdaki ACTIVITY_DELETE_ENABLED notu.
          Modal: gerçekten viewport'a sabit bir alt bar — ProfileActivityTab
          kendi dış ScrollView'unu kontrol etmediği için (bkz. ProfileMobile.tsx/
          profile.web.tsx), sabit konumlandırma ancak Modal ile mümkün. */}
      {ACTIVITY_DELETE_ENABLED && (
        <Modal visible={isSelectionMode && selectedIds.size > 0} transparent animationType="fade">
          <View style={styles.floatingBarWrap} pointerEvents="box-none">
            <TouchableOpacity style={styles.floatingBar} onPress={handleBulkDelete} activeOpacity={0.85}>
              <Trash2 size={16} color="#fff" />
              <Text style={styles.floatingBarText}>
                {t('activityDeleteSelectedButton', 'Seçilenleri Sil ({{count}})', { count: selectedIds.size })}
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SECTION_PADDING_H,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '700',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  editButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  editButtonTextActive: {
    color: '#38bdf8',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  floatingBarWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 32,
  },
  floatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingBarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

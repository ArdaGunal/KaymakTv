import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Rss, WifiOff } from '../icons';
import FeedCard from '../../features/feed/components/FeedCard';
import MarathonFeedCard from '../../features/feed/components/MarathonFeedCard';
import FeedSkeleton from '../../features/feed/components/FeedSkeleton';
import { useUserActivity } from '../../features/feed/hooks/useUserActivity';
import { isMarathonActivity } from '../../features/feed/types';
import { SECTION_PADDING_H } from './profileMetrics';

interface ProfileActivityTabProps {
  traktSlug: string | null;
}

export default function ProfileActivityTab({ traktSlug }: ProfileActivityTabProps) {
  const { t } = useTranslation(['media', 'common']);
  const { data, isLoading, hasError, refresh, deleteItem } = useUserActivity(traktSlug);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <FeedSkeleton />
      </View>
    );
  }

  // "Veri yok" ile "yüklenemedi" AYRI durumlar (bkz. useFeed'deki AYNI ayrım,
  // docs/AI_RULES.md § Sessiz başarısızlık YASAKTIR) — eskiden gerçek bir ağ/
  // veritabanı hatasında da kullanıcı "Henüz aktivite yok" yazısını görüyordu,
  // yani uygulama ona YANLIŞ bilgi veriyordu.
  if (hasError && data.length === 0) {
    return (
      <View style={styles.emptyState}>
        <WifiOff size={36} color="#334155" />
        <Text style={styles.emptyTitle}>{t('profileActivityErrorTitle', 'Aktiviteler Yüklenemedi')}</Text>
        <Text style={styles.emptyText}>
          {t('profileActivityErrorText', 'Bağlantını kontrol edip tekrar dene.')}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>{t('common:retry')}</Text>
        </TouchableOpacity>
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
      </View>

      {/* Silme artık her kartın kendi 3-nokta menüsünden (CardMenu.tsx) — ayrı
          bir "Düzenle" seçim modu / toplu silme çubuğu YOK, bkz. docs/HISTORY.md
          (eski ActivityDeleteRow tabanlı tasarım kaldırıldı). */}
      {data.map((item) =>
        isMarathonActivity(item) ? (
          <MarathonFeedCard key={item.id} activity={item} onDeleteActivity={() => deleteItem(item)} />
        ) : (
          <FeedCard key={item.id} activity={item} onDeleteActivity={() => deleteItem(item)} />
        )
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
  // Akış ekranındaki (feed.tsx) hata durumu retry butonuyla AYNI görsel dil.
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  retryButtonText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
});

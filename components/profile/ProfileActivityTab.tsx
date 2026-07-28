import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Rss } from 'lucide-react-native';
import FeedCard from '../../features/feed/components/FeedCard';
import FeedSkeleton from '../../features/feed/components/FeedSkeleton';
import { useUserActivity } from '../../features/feed/hooks/useUserActivity';
import { SECTION_PADDING_H } from './profileMetrics';

interface ProfileActivityTabProps {
  traktSlug: string | null;
}

export default function ProfileActivityTab({ traktSlug }: ProfileActivityTabProps) {
  const { t } = useTranslation('media');
  const { data, isLoading } = useUserActivity(traktSlug);

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
      {data.map((activity) => (
        <FeedCard key={activity.id} activity={activity} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SECTION_PADDING_H,
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
});

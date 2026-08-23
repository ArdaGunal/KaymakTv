import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart, EyeOff } from '../icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { FeedActivity } from '../../features/feed/types';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { useAuth } from '../../context/AuthContext';
import { useQuickBlock } from '../../features/feed/hooks/useQuickBlock';
import CardMenu from '../../features/feed/components/CardMenu';
import ReportContentModal from '../../features/feed/components/ReportContentModal';

/**
 * Dizi/film sayfasındaki TEK bir KaymakTV incelemesi.
 *
 * Görsel dil `features/feed/components/FeedCommentItem.tsx` ile bilinçli
 * olarak AYNI (avatar + başlık satırı + spoiler perdesi + beğeni + "⋯") —
 * ikisi de "birinin yazdığı metin" birimi, farklı görünmeleri için bir sebep
 * yok. Ayrı bileşen olmalarının sebebi veri tipi: burada `FeedActivity`,
 * orada `FeedComment`.
 */

interface ReviewItemProps {
  review: FeedActivity;
  isOwn: boolean;
  onToggleLike: () => void;
  /** Yalnızca kendi incelemende geçirilir. */
  onEdit?: () => void;
  /** Yalnızca kendi incelemende geçirilir. */
  onDelete?: () => void | Promise<void>;
}

export default function ReviewItem({ review, isOwn, onToggleLike, onEdit, onDelete }: ReviewItemProps) {
  const { t } = useTranslation(['media', 'feed']);
  const { accessToken, isGuest } = useAuth();
  const { blockUserQuick } = useQuickBlock();
  const router = useRouter();
  const [revealed, setRevealed] = useState(!review.noteSpoiler);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const initial = (review.user.username || '?').charAt(0).toUpperCase();

  return (
    <View style={[styles.row, isOwn && styles.ownRow]}>
      <TouchableOpacity
        style={styles.avatar}
        activeOpacity={0.7}
        onPress={() => router.push(`/user/${review.user.traktSlug}`)}
      >
        <Text style={styles.avatarText}>{initial}</Text>
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.username} numberOfLines={1}>
            {review.user.username}
          </Text>
          {isOwn && <Text style={styles.ownBadge}>{t('yourReviewBadge', 'sen')}</Text>}
          <Text style={styles.timestamp}>{formatRelativeTime(review.activityAt, t)}</Text>
        </View>

        {revealed ? (
          <Text style={styles.text} selectable>
            {review.note}
          </Text>
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setRevealed(true)}
            style={styles.spoilerWrap}
          >
            <EyeOff size={11} color="#64748b" />
            <Text style={styles.spoilerText}>
              {t('feed:spoilerReveal', 'Spoiler var — görmek için dokun')}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.likeBtn}
            onPress={onToggleLike}
            activeOpacity={0.7}
            hitSlop={6}
            // Misafir beğenemez — Worker zaten reddederdi, buton pasif olsun
            // ki kullanıcı tepkisiz bir butona basmasın.
            disabled={isGuest || !accessToken}
          >
            <Heart
              size={13}
              color={review.isLikedByMe ? '#f87171' : '#64748b'}
              fill={review.isLikedByMe ? '#f87171' : 'none'}
            />
            {review.likeCount > 0 && <Text style={styles.likeCount}>{review.likeCount}</Text>}
          </TouchableOpacity>

          <CardMenu
            onEdit={isOwn ? onEdit : undefined}
            onDelete={isOwn ? onDelete : undefined}
            onReport={!isOwn ? () => setReportModalVisible(true) : undefined}
            onBlock={
              !isOwn && accessToken && !isGuest
                ? () => blockUserQuick(review.user.traktSlug)
                : undefined
            }
          />
        </View>
      </View>

      {!isOwn && (
        <ReportContentModal
          visible={reportModalVisible}
          targetType="activity"
          targetId={review.id}
          onClose={() => setReportModalVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  // Kendi incelemen görsel olarak ayrışsın — listede aranmasın diye.
  ownRow: {
    backgroundColor: 'rgba(251,146,60,0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.18)',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 12,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  username: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 13,
    flexShrink: 1,
  },
  ownBadge: {
    color: '#fb923c',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timestamp: {
    color: '#475569',
    fontSize: 11,
  },
  text: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
  },
  spoilerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginTop: 2,
  },
  spoilerText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
});

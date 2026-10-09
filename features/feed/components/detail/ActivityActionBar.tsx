import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Heart, MessageCircle, Share2 } from '../../../../components/icons';
import { FeedActivity } from '../../types';

interface Props {
  activity: FeedActivity;
  onToggleLike: () => void;
  isLiking: boolean;
  onShare: () => void;
  /** Verilirse yorum düğmesi ve yorum sayısı görünür (yalnız kullanıcı yayını). */
  onPressComment?: () => void;
  /** Sayaç satırı (Twitter: «3 beğeni · 2 yorum»). Sistem penceresinde kapalı. */
  showCounts?: boolean;
}

/** C2 · Beğeni / yorum / paylaş satırı — detay sayfası ve sistem penceresi ortak. */
export default function ActivityActionBar({ activity, onToggleLike, isLiking, onShare, onPressComment, showCounts = true }: Props) {
  const { t } = useTranslation('feed');
  const liked = !!activity.isLikedByMe;
  return (
    <View>
      {showCounts && (
        <View style={styles.counts}>
          <Text style={styles.countText}>
            <Text style={styles.countNum}>{activity.likeCount}</Text>{' '}
            {activity.likeCount === 1 ? t('detailLikeOne', 'beğeni') : t('detailLikes', 'beğeni')}
          </Text>
          {onPressComment && (
            <Text style={styles.countText}>
              <Text style={styles.countNum}>{activity.commentCount}</Text>{' '}
              {activity.commentCount === 1 ? t('detailCommentOne', 'yorum') : t('detailComments', 'yorum')}
            </Text>
          )}
        </View>
      )}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.btn}
          onPress={onToggleLike}
          disabled={isLiking || activity.isPending}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('detailLike', 'Beğen')}
        >
          <Heart size={20} color={liked ? '#f87171' : '#94a3b8'} fill={liked ? '#f87171' : 'none'} />
          {!showCounts && activity.likeCount > 0 && <Text style={styles.inlineCount}>{activity.likeCount}</Text>}
        </TouchableOpacity>
        {onPressComment && (
          <TouchableOpacity style={styles.btn} onPress={onPressComment} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('detailComment', 'Yorum yaz')}>
            <MessageCircle size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.btn} onPress={onShare} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('detailShare', 'Paylaş')}>
          <Share2 size={19} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  counts: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#22304A',
  },
  countText: { color: '#64748b', fontSize: 13 },
  countNum: { color: '#f1f5f9', fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#22304A',
    borderBottomWidth: 1,
    borderBottomColor: '#22304A',
  },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  inlineCount: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
});

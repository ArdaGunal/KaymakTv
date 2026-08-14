import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart, EyeOff, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { FeedComment } from '../services/feedSocial';
import { formatRelativeTime } from '../utils/formatRelativeTime';

interface FeedCommentItemProps {
  comment: FeedComment;
  isOwn: boolean;
  isLiked: boolean;
  onToggleLike: () => void;
  onDelete: () => void;
}

export default function FeedCommentItem({ comment, isOwn, isLiked, onToggleLike, onDelete }: FeedCommentItemProps) {
  const { t } = useTranslation('feed');
  const [revealed, setRevealed] = useState(!comment.spoiler);
  const initial = comment.username.charAt(0).toUpperCase();

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.username}>{comment.username}</Text>
          <Text style={styles.timestamp}>{formatRelativeTime(comment.createdAt)}</Text>
        </View>

        {revealed ? (
          <Text style={styles.text}>{comment.body}</Text>
        ) : (
          <TouchableOpacity activeOpacity={0.7} onPress={() => setRevealed(true)} style={styles.spoilerWrap}>
            <EyeOff size={11} color="#64748b" />
            <Text style={styles.spoilerText}>{t('spoilerReveal', 'Spoiler var — görmek için dokun')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.likeBtn} onPress={onToggleLike} activeOpacity={0.7} hitSlop={6}>
            <Heart size={13} color={isLiked ? '#f87171' : '#64748b'} fill={isLiked ? '#f87171' : 'none'} />
            {comment.likeCount > 0 && <Text style={styles.likeCount}>{comment.likeCount}</Text>}
          </TouchableOpacity>

          {isOwn && (
            <TouchableOpacity onPress={onDelete} activeOpacity={0.7} hitSlop={6}>
              <Trash2 size={13} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
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
  },
  timestamp: {
    color: '#475569',
    fontSize: 11,
  },
  text: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
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

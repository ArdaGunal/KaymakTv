import React, { useState, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Heart, EyeOff, Eye, MessageCircle } from 'lucide-react-native';
import type { CommentData } from '../../hooks/useComments';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs === 0) {
      const diffMin = Math.floor(diffMs / (1000 * 60));
      return diffMin <= 1 ? 'şimdi' : `${diffMin} dakika önce`;
    }
    return `${diffHrs} saat önce`;
  }
  if (diffDays < 7) return `${diffDays} gün önce`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ay önce`;
  return `${Math.floor(diffDays / 365)} yıl önce`;
}

function getInitials(username?: string): string {
  if (!username) return '?';
  return username.slice(0, 2).toUpperCase();
}

// ─── Avatar ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#2563eb', '#7c3aed', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#db2777', '#65a30d',
];

function avatarColor(username?: string): string {
  if (!username) return AVATAR_COLORS[0];
  const code = username.charCodeAt(0) + (username.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// ─── Spoiler Overlay ───────────────────────────────────────────────────────

interface SpoilerOverlayProps {
  text: string;
}

const SpoilerOverlay = memo(({ text }: SpoilerOverlayProps) => {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return (
      <View>
        <Text style={styles.commentText}>{text}</Text>
        <TouchableOpacity
          onPress={() => setRevealed(false)}
          style={styles.hideSpoilerBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <EyeOff size={12} color="#64748b" />
          <Text style={styles.hideSpoilerText}>Gizle</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => setRevealed(true)}
      style={styles.spoilerOverlay}
      activeOpacity={0.8}
    >
      {/* Blurred text behind */}
      <Text style={styles.spoilerBlurredText} numberOfLines={3}>
        {text}
      </Text>

      {/* Frosted overlay */}
      <View style={styles.spoilerFrost}>
        <View style={styles.spoilerIconBadge}>
          <Eye size={18} color="#facc15" />
        </View>
        <Text style={styles.spoilerLabel}>Spoiler İçeriyor</Text>
        <Text style={styles.spoilerCta}>Görmek için dokun</Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── CommentItem ──────────────────────────────────────────────────────────

interface CommentItemProps {
  item: CommentData;
}

const CommentItem = memo(({ item }: CommentItemProps) => {
  const username = item.user?.username || item.user?.name || 'Anonim';
  const initials = getInitials(username);
  const color = avatarColor(username);
  const relDate = formatRelativeDate(item.created_at);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Username + date */}
        <View style={styles.userInfo}>
          <Text style={styles.username} numberOfLines={1}>
            {username}
          </Text>
          {relDate ? <Text style={styles.date}>{relDate}</Text> : null}
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          {item.spoiler && (
            <View style={styles.spoilerBadge}>
              <Text style={styles.spoilerBadgeText}>SPOILER</Text>
            </View>
          )}
          {item.likes > 0 && (
            <View style={styles.stat}>
              <Heart size={12} color="#e879f9" fill="#e879f9" />
              <Text style={styles.statText}>{item.likes}</Text>
            </View>
          )}
          {item.replies > 0 && (
            <View style={styles.stat}>
              <MessageCircle size={12} color="#60a5fa" />
              <Text style={styles.statText}>{item.replies}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        {item.spoiler ? (
          <SpoilerOverlay text={item.comment} />
        ) : (
          <Text style={styles.commentText}>{item.comment}</Text>
        )}
      </View>
    </View>
  );
});

export default CommentItem;

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    } as any),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  date: {
    color: '#475569',
    fontSize: 11,
    marginTop: 1,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  spoilerBadge: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  spoilerBadgeText: {
    color: '#f87171',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBody: {
    paddingLeft: 46, // align with avatar
  },
  commentText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22,
  },
  // Spoiler overlay
  spoilerOverlay: {
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 68,
  },
  spoilerBlurredText: {
    color: 'transparent',
    fontSize: 14,
    lineHeight: 22,
    ...(Platform.OS === 'web' && {
      filter: 'blur(6px)',
      color: '#94a3b8',
      userSelect: 'none',
    } as any),
    ...(Platform.OS !== 'web' && {
      opacity: 0.05,
      color: '#94a3b8',
    }),
  },
  spoilerFrost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.2)',
  },
  spoilerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(250,204,21,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  spoilerLabel: {
    color: '#facc15',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  spoilerCta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  // Reveal controls
  hideSpoilerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  hideSpoilerText: {
    color: '#475569',
    fontSize: 12,
  },
});

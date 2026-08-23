import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { CornerDownRight, MessageCircle, ChevronUp } from '../icons';
import { getCommentReplies } from '../../services/traktApi';

interface CommentRepliesProps {
  commentId: number;
  initialCount: number;
}

/**
 * Bir Trakt yorumunun altındaki cevaplar — **SALT OKUNUR**.
 *
 * ⚠️ v2 DEĞİŞİKLİĞİ: Burada eskiden bir cevap YAZMA kutusu vardı
 * (`addCommentReply` → Trakt'a POST). Trakt'a yazmayı tamamen bıraktığımız
 * için (bkz. docs/REVIEWS_PLAN.md v2) o kısım kaldırıldı; cevaplar yalnızca
 * GÖRÜNTÜLENİYOR.
 *
 * Kullanıcı kararı (Karar 9): "CommentReplies kalsın, Trakt yanıtları salt
 * okunur olarak görünebilsin" — bir Trakt yorumuna dokununca cevaplarını
 * görebilmek değer katıyor, yazma kutusu ise artık gidecek bir yer olmadığı
 * için yanıltıcı olurdu.
 *
 * KaymakTV incelemelerine yazılan yanıtlar BAŞKA bir yerde yaşıyor:
 * `comments` tablosu + `features/feed/hooks/useFeedComments.ts`.
 */
export default function CommentReplies({ commentId, initialCount }: CommentRepliesProps) {
  const { t } = useTranslation(['common', 'media']);
  const [expanded, setExpanded] = useState(false);
  const [replies, setReplies] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  // `initialCount` artık DEĞİŞMİYOR (cevap eklenmiyor) — bu yüzden yerel bir
  // sayaç state'i yok, prop doğrudan okunuyor.

  const toggleExpanded = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (replies === null && initialCount > 0) {
      setLoading(true);
      try {
        const data = await getCommentReplies(commentId);
        setReplies(data || []);
      } catch {
        setReplies([]);
      } finally {
        setLoading(false);
      }
    } else if (replies === null) {
      setReplies([]);
    }
  };


  return (
    <View style={styles.container}>
      {/* Aç/kapa satırı */}
      <TouchableOpacity
        onPress={toggleExpanded}
        style={styles.toggleRow}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        {expanded ? (
          <ChevronUp size={13} color="#64748b" />
        ) : (
          <MessageCircle size={13} color="#60a5fa" />
        )}
        <Text style={[styles.toggleText, expanded && styles.toggleTextMuted]}>
          {expanded
            ? t('media:hideReplies')
            : t('common:viewReplies', { count: initialCount })}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.repliesArea}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" />
            </View>
          ) : (
            (replies || []).length === 0 ? (
              <Text style={styles.guestNote}>{t('media:noRepliesYet', 'Henüz cevap yok.')}</Text>
            ) : (replies || []).map((r: any, idx: number) => (
              <View key={r.id ?? idx} style={styles.replyRow}>
                <CornerDownRight size={13} color="#334155" style={styles.replyIcon} />
                <View style={styles.replyBody}>
                  <Text style={styles.replyUser}>{r.user?.username || r.user?.name || 'Anonim'}</Text>
                  <Text style={styles.replyText} selectable>{r.comment}</Text>
                </View>
              </View>
            ))
          )}

        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  toggleText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleTextMuted: {
    color: '#64748b',
  },
  repliesArea: {
    marginTop: 10,
    gap: 10,
  },
  loadingRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  replyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  replyIcon: {
    marginTop: 3,
    flexShrink: 0,
  },
  replyBody: {
    flex: 1,
    backgroundColor: 'rgba(30,41,59,0.5)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  replyUser: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  replyText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(30,41,59,0.5)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 13,
    maxHeight: 90,
    paddingVertical: 4,
  },
  sendBtn: {
    padding: 6,
    marginLeft: 8,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  replyHint: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 5,
    marginLeft: 2,
  },
  guestNote: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
  },
});

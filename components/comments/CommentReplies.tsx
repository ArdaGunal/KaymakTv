import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CornerDownRight, Send, MessageCircle, ChevronUp } from 'lucide-react-native';
import { getCommentReplies, addCommentReply } from '../../services/traktApi';
import { useAuth } from '../../context/AuthContext';

interface CommentRepliesProps {
  commentId: number;
  initialCount: number;
}

/**
 * Bir yorumun altındaki cevaplar bölümü: tıklayınca cevapları yükler,
 * altındaki inline kutudan yeni cevap yazılabilir. Cevap sayısı 0 olsa da
 * "Cevapla" ile açılabilir. Trakt kuralı gereği cevaplar da en az 5 kelime.
 */
export default function CommentReplies({ commentId, initialCount }: CommentRepliesProps) {
  const { t } = useTranslation('common');
  const { isGuest } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [replies, setReplies] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [localCount, setLocalCount] = useState(initialCount);

  const toggleExpanded = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (replies === null && localCount > 0) {
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

  const handleSendReply = async () => {
    if (isGuest) {
      Alert.alert('Giriş Gerekli', 'Cevap yazmak için giriş yapmalısınız.');
      return;
    }
    const wordCount = replyText.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 5) {
      Alert.alert('Çok Kısa', 'Cevabınız en az 5 kelime olmalı (Trakt kuralı).');
      return;
    }
    if (sending) return;

    setSending(true);
    try {
      const newReply = await addCommentReply(commentId, replyText.trim());
      setReplies(prev => [...(prev || []), newReply]);
      setLocalCount(c => c + 1);
      setReplyText('');
    } catch (e: any) {
      const msg = e?.response?.status === 422
        ? 'Cevap Trakt kurallarına uymuyor (en az 5 kelime).'
        : t('replyError');
      Alert.alert('Hata', msg);
    } finally {
      setSending(false);
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
            ? 'Cevapları gizle'
            : localCount > 0
              ? t('viewReplies', { count: localCount, defaultValue: `${localCount} cevabı gör · Cevapla` })
              : 'Cevapla'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.repliesArea}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" />
            </View>
          ) : (
            (replies || []).map((r: any, idx: number) => (
              <View key={r.id ?? idx} style={styles.replyRow}>
                <CornerDownRight size={13} color="#334155" style={styles.replyIcon} />
                <View style={styles.replyBody}>
                  <Text style={styles.replyUser}>{r.user?.username || r.user?.name || 'Anonim'}</Text>
                  <Text style={styles.replyText}>{r.comment}</Text>
                </View>
              </View>
            ))
          )}

          {/* Cevap yazma kutusu */}
          {!isGuest ? (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Bir cevap yaz (en az 5 kelime)..."
                placeholderTextColor="#475569"
                value={replyText}
                onChangeText={setReplyText}
                multiline
              />
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={handleSendReply}
                disabled={sending}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {sending ? <ActivityIndicator size="small" /> : <Send size={16} color="#3b82f6" />}
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.guestNote}>{t('loginToReply')}</Text>
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
  guestNote: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
  },
});

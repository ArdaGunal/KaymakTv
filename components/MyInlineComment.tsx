import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Edit2, Trash2, PenLine, LogIn } from 'lucide-react-native';
import { getUserComments, deleteComment } from '../services/traktApi';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LoadingIndicator from './LoadingIndicator';

interface MyInlineCommentProps {
  mediaId: number;
  mediaType: 'show' | 'movie' | 'episode';
  episodeTraktId?: number;
  onPressWrite: () => void;
  refreshTrigger: number;
  onDeleteSuccess?: () => void;
}

export default function MyInlineComment({
  mediaId,
  mediaType,
  episodeTraktId,
  onPressWrite,
  refreshTrigger,
  onDeleteSuccess,
}: MyInlineCommentProps) {
  const [myComment, setMyComment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation(['media', 'common']);
  const { isGuest } = useAuth();

  useEffect(() => {
    if (mediaId) {
      loadMyComment();
    }
  }, [mediaId, refreshTrigger]);

  const loadMyComment = async () => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const userRes = await getUserComments();
      const comment = userRes.find((c: any) => {
        if (mediaType === 'show' && c.show?.ids?.trakt === mediaId) return true;
        if (mediaType === 'episode' && c.episode?.ids?.trakt === (episodeTraktId || mediaId)) return true;
        if (mediaType === 'movie' && c.movie?.ids?.trakt === mediaId) return true;
        return false;
      });
      setMyComment(comment ? comment.comment : null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('deleteConfirmTitle'),
      t('deleteConfirmText'),
      [
        { text: t('common:cancel'), style: 'cancel' },
        {
          text: t('common:delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteComment(myComment.id);
              setMyComment(null);
              if (onDeleteSuccess) onDeleteSuccess();
            } catch (e: any) {
              console.error(e);
              Alert.alert(t('common:error'), e?.message || t('common:error'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrapper}>
        <LoadingIndicator size="small" />
      </View>
    );
  }

  if (isGuest) {
    return (
      <View style={styles.guestBox}>
        <LogIn size={16} color="#475569" />
        <Text style={styles.guestText}>{t('loginToComment')}</Text>
      </View>
    );
  }

  if (myComment) {
    return (
      <View style={styles.existingCard}>
        <Text style={styles.existingText}>{myComment.comment}</Text>
        <View style={styles.existingActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={onPressWrite}>
            <Edit2 size={16} color="#f97316" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <LoadingIndicator size="small" />
            ) : (
              <Trash2 size={16} color="#ef4444" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const placeholderText =
    mediaType === 'episode'
      ? t('whatDoYouThink')
      : mediaType === 'show'
      ? t('whatDoYouThinkShow')
      : t('whatDoYouThinkMovie');

  return (
    <TouchableOpacity style={styles.promptBox} onPress={onPressWrite} activeOpacity={0.8}>
      <PenLine size={16} color="#475569" style={styles.promptIcon} />
      <Text style={styles.promptText}>{placeholderText}</Text>
      <View style={styles.writeBtn}>
        <Text style={styles.writeBtnText}>{t('common:write')}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loadingWrapper: {
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  guestBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(23,32,51,0.5)',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  guestText: {
    color: '#475569',
    fontStyle: 'italic',
    fontSize: 14,
  },
  existingCard: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  existingText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22,
  },
  existingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionBtnDanger: {
    borderColor: 'rgba(239,68,68,0.2)',
  },
  promptBox: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  promptIcon: {
    flexShrink: 0,
  },
  promptText: {
    color: '#475569',
    flex: 1,
    fontStyle: 'italic',
    fontSize: 14,
  },
  writeBtn: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  writeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

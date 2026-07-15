import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Edit2, Trash2 } from 'lucide-react-native';
import { getUserComments, deleteComment } from '../services/traktApi';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

interface MyInlineCommentProps {
  mediaId: number;
  mediaType: 'show' | 'movie' | 'episode';
  episodeTraktId?: number;
  onPressWrite: () => void;
  refreshTrigger: number;
  onDeleteSuccess?: () => void;
}

export default function MyInlineComment({ mediaId, mediaType, episodeTraktId, onPressWrite, refreshTrigger, onDeleteSuccess }: MyInlineCommentProps) {
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
        { text: t('common:cancel'), style: "cancel" },
        { 
          text: t('common:delete'), 
          style: "destructive",
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
          }
        }
      ]
    );
  };

  if (loading) {
    return <ActivityIndicator style={{ marginBottom: 16 }} color="#3b82f6" />;
  }

  if (myComment) {
    return (
      <View style={{ backgroundColor: '#172033', padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <Text style={{ color: '#e5e5e5', fontSize: 14, lineHeight: 20 }}>{myComment.comment}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
          <TouchableOpacity style={{ padding: 8, marginLeft: 16, backgroundColor: '#0B1120', borderRadius: 8 }} onPress={onPressWrite}>
            <Edit2 size={18} color="#F97316" />
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 8, marginLeft: 16, backgroundColor: '#0B1120', borderRadius: 8 }} onPress={handleDelete} disabled={deleting}>
            {deleting ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={18} color="#ef4444" />}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const placeholderText = mediaType === 'episode' ? t('whatDoYouThink') :
                          mediaType === 'show' ? t('whatDoYouThinkShow') : t('whatDoYouThinkMovie');

  if (isGuest) {
    return (
      <View style={{ backgroundColor: 'rgba(23, 32, 51, 0.5)', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#1e293b' }}>
        <Text style={{ color: '#64748b', fontStyle: 'italic', fontSize: 14 }}>Yorum yapmak için giriş yapın</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={{ backgroundColor: '#172033', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
      onPress={() => {
        onPressWrite();
      }}
    >
      <Text style={{ color: '#a3a3a3', flex: 1, fontStyle: 'italic' }}>{placeholderText}</Text>
      <View style={{ backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{t('common:write')}</Text>
      </View>
    </TouchableOpacity>
  );
}

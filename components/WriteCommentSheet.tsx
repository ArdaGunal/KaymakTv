import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Switch, Alert } from 'react-native';
import { X, Send, AlertTriangle, Edit2, Trash2, Check } from 'lucide-react-native';
import { addComment, getUserComments, updateComment, deleteComment } from '../services/traktApi';
import { useTranslation } from 'react-i18next';

interface WriteCommentSheetProps {
  visible: boolean;
  onClose: () => void;
  mediaId: number;
  mediaType: 'show' | 'movie' | 'episode';
  episodeTraktId?: number;
  onSuccess?: () => void;
}

export default function WriteCommentSheet({ visible, onClose, mediaId, mediaType, episodeTraktId, onSuccess }: WriteCommentSheetProps) {
  const [inputText, setInputText] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(true);
  const [sending, setSending] = useState(false);
  const [wordError, setWordError] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [existingCommentId, setExistingCommentId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const { t } = useTranslation(['media', 'common']);

  useEffect(() => {
    if (visible && mediaId) {
      loadMyComment();
    }
  }, [visible, mediaId]);

  const loadMyComment = async () => {
    setLoadingInitial(true);
    try {
      const userRes = await getUserComments();
      const myComment = userRes.find((c: any) => {
        if (mediaType === 'show' && c.show?.ids?.trakt === mediaId) return true;
        if (mediaType === 'episode' && c.episode?.ids?.trakt === (episodeTraktId || mediaId)) return true;
        if (mediaType === 'movie' && c.movie?.ids?.trakt === mediaId) return true;
        return false;
      });
      if (myComment) {
        setInputText(myComment.comment.comment);
        setIsSpoiler(myComment.comment.spoiler);
        setExistingCommentId(myComment.comment.id);
        setViewMode(true);
      } else {
        setInputText('');
        setExistingCommentId(null);
        setViewMode(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleSend = async () => {
    const wordCount = inputText.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 5) {
      setWordError(true);
      setTimeout(() => setWordError(false), 2000);
      return;
    }

    setSending(true);
    try {
      if (existingCommentId) {
        await updateComment(existingCommentId, inputText, isSpoiler);
      } else {
        const targetId = mediaType === 'episode' && episodeTraktId ? episodeTraktId : mediaId;
        await addComment(targetId, mediaType, inputText, isSpoiler);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
      let errorMessage = t('commentSendError');
      if (e?.response?.status === 422) errorMessage = t('commentLengthError');
      else if (e?.response?.status === 409) errorMessage = t('commentDuplicateError');
      else if (e?.message) errorMessage = e.message;
      Alert.alert(t('common:error'), errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('deleteCommentTitle'),
      t('deleteCommentConfirm'),
      [
        { text: t('common:cancel'), style: "cancel" },
        { 
          text: t('common:delete'), 
          style: "destructive",
          onPress: async () => {
            setSending(true);
            try {
              if (existingCommentId) {
                await deleteComment(existingCommentId);
              }
              setExistingCommentId(null);
              setInputText('');
              setViewMode(false);
              if (onSuccess) onSuccess();
              onClose();
            } catch (e) {
              console.error(e);
            } finally {
              setSending(false);
            }
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{existingCommentId ? (viewMode ? t('yourComment') : t('editComment')) : t('writeComment')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </View>

          {loadingInitial ? (
            <ActivityIndicator style={{marginTop: 20}} color="#3b82f6" />
          ) : viewMode ? (
            <View style={styles.viewModeContainer}>
              <Text style={styles.viewModeText}>{inputText}</Text>
              <View style={styles.viewModeActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setViewMode(false)}>
                  <Edit2 size={20} color="#F97316" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={handleDelete} disabled={sending}>
                  {sending ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={20} color="#ef4444" />}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.inputSection}>
              <View style={styles.inputHeader}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Switch 
                    value={isSpoiler} 
                    onValueChange={setIsSpoiler} 
                    trackColor={{false: '#3f3f46', true: '#3b82f6'}} 
                    thumbColor={Platform.OS === 'ios' ? '#fff' : isSpoiler ? '#fff' : '#a3a3a3'}
                  />
                  <Text style={styles.spoilerText}>{t('containsSpoiler')}</Text>
                </View>
                <Text style={styles.guidelineText}>{t('min5Words')}</Text>
              </View>
              <View style={[styles.inputRow, wordError && styles.inputError]}>
                <TextInput 
                  style={styles.textInput}
                  placeholder={existingCommentId ? t('updateComment') : t('episodeThought')}
                  placeholderTextColor="#a3a3a3"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  autoFocus={!existingCommentId}
                />
                <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
                  {sending ? (
                    <ActivityIndicator size="small" color="#3b82f6" />
                  ) : existingCommentId ? (
                    <Check size={20} color="#3b82f6" />
                  ) : (
                    <Send size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              </View>
              {wordError && (
                <View style={styles.errorBanner}>
                  <AlertTriangle size={14} color="#ef4444" style={{marginRight: 4}} />
                  <Text style={styles.errorText}>{t('min5WordsError')}</Text>
                </View>
              )}
            </View>
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0B1120',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#172033',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  inputSection: {
    padding: 16,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  spoilerText: {
    color: '#e5e5e5',
    fontSize: 12,
    marginLeft: 6,
  },
  guidelineText: {
    color: '#737373',
    fontSize: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#172033',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  textInput: {
    color: '#fff',
    maxHeight: 150,
    minHeight: 80,
    width: '90%',
  },
  sendBtn: {
    marginLeft: 12,
    padding: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
  },
  viewModeContainer: {
    padding: 16,
  },
  viewModeText: {
    color: '#e5e5e5',
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: '#172033',
    padding: 12,
    borderRadius: 8,
    minHeight: 60,
  },
  viewModeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  actionBtn: {
    padding: 8,
    marginLeft: 16,
    backgroundColor: '#172033',
    borderRadius: 8,
  }
});

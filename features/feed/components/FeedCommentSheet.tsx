import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  TextInput,
  Switch,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { confirmAsync } from '../../../utils/confirmDialog';
import { X, Send, MessageSquare } from '../../../components/icons';
import FeedCommentItem from './FeedCommentItem';
import { useFeedComments } from '../hooks/useFeedComments';

const COMMENT_MAX_LENGTH = 500;

interface FeedCommentSheetProps {
  visible: boolean;
  activityId: string;
  onClose: () => void;
}

/**
 * Akış aktivitesine özel yorum sheet'i — TRAKT'IN KENDİ YORUM SİSTEMİYLE
 * KARIŞTIRILMASIN (bkz. `components/CommentSheet.tsx`, dizi/film/bölüm
 * sayfalarındaki, herkese açık Trakt tartışması). Bu tamamen ayrı: bir
 * arkadaşının "izledim" gönderisine bırakılan, yalnızca KaymakTV içinde
 * yaşayan yorumlar (bkz. docs/design/FEED_SOCIAL_PLAN.md).
 */
export default function FeedCommentSheet({ visible, activityId, onClose }: FeedCommentSheetProps) {
  const { t } = useTranslation('feed');
  const {
    comments,
    isLoading,
    hasError,
    isSubmitting,
    myUserId,
    likedCommentIds,
    submitComment,
    removeComment,
    toggleCommentLike,
  } = useFeedComments(activityId, visible);

  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedLength = body.trim().length;
  const overLimit = trimmedLength > COMMENT_MAX_LENGTH;
  const canSend = trimmedLength > 0 && !overLimit && !isSubmitting;

  const handleClose = () => {
    setBody('');
    setSpoiler(false);
    setSubmitError(null);
    onClose();
  };

  /**
   * Y16: kapatma yolu artık ONAY istiyor. Eskiden arka plana dokunmak, X ve
   * Android geri tuşu metni onaysız siliyordu — klavyeyi kapatmak için
   * karartılmış alana dokunmak mobilde en doğal refleks olduğu için uzun bir
   * metin tek dokunuşla, geri alınamaz şekilde gidiyordu. WriteReviewSheet bu
   * korumayı F4-T9 sırasında kazanmıştı; kapatma tarafı buraya taşınmamıştı.
   */
  const requestClose = async () => {
    if (!(body.trim().length > 0)) { handleClose(); return; }
    const confirmed = await confirmAsync(
      t('commentDiscardTitle', 'Yorumdan çıkılsın mı?'),
      t('commentDiscardText', 'Yazdıkların kaydedilmeyecek.'),
      t('discardConfirm', 'Vazgeç'),
      t('keepEditing', 'Devam Et')
    );
    if (confirmed) handleClose();
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSubmitError(null);
    const result = await submitComment(body.trim(), spoiler);
    if (result.ok) {
      setBody('');
      setSpoiler(false);
    } else {
      setSubmitError(result.message);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={requestClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <TouchableWithoutFeedback onPress={requestClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.sheet}
            >
              <View style={styles.header}>
                <Text style={styles.title}>{t('commentsTitle', 'Akış Yorumları')}</Text>
                <TouchableOpacity onPress={requestClose} hitSlop={8}>
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {isLoading ? (
                <ActivityIndicator style={styles.loading} color="#3b82f6" />
              ) : hasError ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>{t('commentsError', 'Yorumlar yüklenemedi.')}</Text>
                </View>
              ) : comments.length === 0 ? (
                <View style={styles.emptyState}>
                  <MessageSquare size={28} color="#334155" />
                  <Text style={styles.emptyText}>
                    {t('commentsEmpty', 'Henüz yorum yok — ilk yorumu sen yaz.')}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={comments}
                  keyExtractor={(c) => c.id}
                  style={styles.list}
                  renderItem={({ item }) => (
                    <FeedCommentItem
                      comment={item}
                      isOwn={!!myUserId && item.userId === myUserId}
                      isLiked={likedCommentIds.has(item.id)}
                      onToggleLike={() => toggleCommentLike(item.id)}
                      onDelete={() => removeComment(item.id)}
                    />
                  )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              )}

              <View style={styles.composer}>
                {submitError && <Text style={styles.submitError}>{submitError}</Text>}
                <View style={styles.composerRow}>
                  <TextInput
                    style={styles.input}
                    value={body}
                    onChangeText={setBody}
                    placeholder={t('commentPlaceholder', 'Bir yorum yaz...')}
                    placeholderTextColor="#475569"
                    multiline
                    maxLength={COMMENT_MAX_LENGTH + 50}
                    editable={!isSubmitting}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!canSend}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Send size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
                <View style={styles.composerFooter}>
                  <View style={styles.spoilerToggle}>
                    <Switch
                      value={spoiler}
                      onValueChange={setSpoiler}
                      trackColor={{ false: '#334155', true: '#3b82f6' }}
                      thumbColor="#f1f5f9"
                    />
                    <Text style={styles.spoilerToggleLabel}>{t('spoilerToggle', 'Spoiler içeriyor')}</Text>
                  </View>
                  <Text style={[styles.counter, overLimit && styles.counterOver]}>
                    {trimmedLength}/{COMMENT_MAX_LENGTH}
                  </Text>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#22304A',
    maxHeight: '80%',
    minHeight: 320,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  loading: {
    marginVertical: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  list: {
    paddingHorizontal: 20,
    flexGrow: 0,
  },
  separator: {
    height: 1,
    backgroundColor: '#1e293b',
  },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  submitError: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#172033',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22304A',
    color: '#e2e8f0',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  spoilerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spoilerToggleLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  counter: {
    color: '#475569',
    fontSize: 11,
  },
  counterOver: {
    color: '#f87171',
  },
});

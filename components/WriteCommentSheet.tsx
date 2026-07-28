import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Switch, ActivityIndicator } from 'react-native';
import { X, Send, AlertTriangle, Edit2, Trash2, Check } from 'lucide-react-native';
import { addComment, getUserComments, updateComment, deleteComment } from '../services/traktApi';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { confirmAsync, notify } from '../utils/confirmDialog';
import { validateComment, MAX_COMMENT_CHARS, MIN_COMMENT_CHARS, MIN_COMMENT_WORDS } from '../utils/commentValidation';

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
  // Trakt'ın kendi varsayılanı da `false`. Eskiden `true` idi — bu yüzden bu
  // uygulamadan atılan HER yorum, kullanıcı hiç dokunmasa bile Trakt'ta
  // "SPOILER" etiketiyle görünüyor ve diğer kullanıcılara bulanık geliyordu.
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [existingCommentId, setExistingCommentId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const { t } = useTranslation(['media', 'common']);
  const { isGuest } = useAuth();

  const validation = useMemo(() => validateComment(inputText), [inputText]);
  const canSend = validation.isValid && !sending;

  useEffect(() => {
    if (visible && mediaId) {
      loadMyComment();
    }
  }, [visible, mediaId]);

  // Sheet kapandığında state'i sıfırla. Eskiden sıfırlanmıyordu: A dizisinde
  // yorumu olan biri sheet'i kapatıp B dizisininkini açtığında, yeni veri
  // gelene kadar A'nın yorumu (ve `viewMode`/`isSpoiler` durumu) ekranda
  // kalıyordu.
  useEffect(() => {
    if (!visible) {
      setInputText('');
      setIsSpoiler(false);
      setExistingCommentId(null);
      setViewMode(false);
      setSending(false);
    }
  }, [visible]);

  const loadMyComment = async () => {
    if (isGuest) {
      setLoadingInitial(false);
      return;
    }
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
        setIsSpoiler(!!myComment.comment.spoiler);
        setExistingCommentId(myComment.comment.id);
        setViewMode(true);
      } else {
        // `isSpoiler` de sıfırlanmalı — aksi halde önce spoiler'lı bir yorumu
        // olan medya açılıp sonra yorumu olmayan bir medyaya geçilince switch
        // açık kalıyordu.
        setInputText('');
        setIsSpoiler(false);
        setExistingCommentId(null);
        setViewMode(false);
      }
    } catch (e) {
      console.error('[WriteCommentSheet] loadMyComment:', e);
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleSend = async () => {
    // NOT: bu sheet normalde `MyInlineComment`'in misafir korumasının arkasında
    // açılır (misafirlere yazma butonu yerine giriş daveti gösterilir) — bu
    // yine de ikinci bir savunma katmanı.
    if (isGuest) {
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    // Buton zaten pasif olduğu için buraya normalde hiç düşülmez — son savunma.
    if (!validation.isValid) return;

    setSending(true);
    try {
      const body = inputText.trim();
      if (existingCommentId) {
        await updateComment(existingCommentId, body, isSpoiler);
      } else {
        const targetId = mediaType === 'episode' && episodeTraktId ? episodeTraktId : mediaId;
        await addComment(targetId, mediaType, body, isSpoiler);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      console.error('[WriteCommentSheet] handleSend:', e?.response?.data ?? e);
      let errorMessage = t('commentSendError');
      // 422 = Trakt kuralı ihlali. Pratikte neredeyse her zaman "5 kelimeden
      // kısa" demek (eski metin "Yorum çok uzun" diyordu — tam tersi, yanıltıcıydı).
      if (e?.response?.status === 422) errorMessage = t('commentRejectedError');
      else if (e?.response?.status === 409) errorMessage = t('commentDuplicateError');
      else if (e?.message) errorMessage = e.message;
      notify(t('common:error'), errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    // `Alert.alert` react-native-web'de TAM NO-OP — web'de silme onayı hiç
    // görünmediği için yorum SİLİNEMİYORDU. `confirmAsync` web'de
    // `window.confirm`e düşer.
    const confirmed = await confirmAsync(
      t('deleteCommentTitle'),
      t('deleteCommentConfirm'),
      t('common:delete'),
      t('common:cancel')
    );
    if (!confirmed) return;

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
    } catch (e: any) {
      console.error('[WriteCommentSheet] handleDelete:', e?.response?.data ?? e);
      notify(t('common:error'), t('commentDeleteError'));
    } finally {
      setSending(false);
    }
  };

  // Girdi durumuna göre anlık ipucu: kullanıcı butonun NEDEN pasif olduğunu her
  // an görsün diye. Eskiden yalnızca gönderme denemesinden SONRA 2 saniyeliğine
  // bir hata çıkıyordu — kullanıcı butona basana kadar eksiği göremiyordu.
  const hint = useMemo(() => {
    switch (validation.reason) {
      case 'empty':
        return { text: t('commentHintEmpty', { min: MIN_COMMENT_WORDS }), isError: false };
      case 'tooShort':
        return { text: t('commentHintTooShort', { count: validation.charCount, min: MIN_COMMENT_CHARS }), isError: true };
      case 'tooFewWords':
        return { text: t('commentHintTooFewWords', { count: validation.wordCount, min: MIN_COMMENT_WORDS }), isError: true };
      case 'tooLong':
        return { text: t('commentHintTooLong', { max: MAX_COMMENT_CHARS }), isError: true };
      default:
        return {
          text: validation.isReviewLength
            ? t('commentHintReview', { chars: validation.charCount, words: validation.wordCount })
            : t('commentHintValid', { chars: validation.charCount, words: validation.wordCount }),
          isError: false,
        };
    }
  }, [validation, t]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      {/* iOS: padding; Android: height — RN Modal içinde Android'de 'padding' çoğu
          cihazda çalışmayıp input'un klavye altında kalmasına sebep oluyordu. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{existingCommentId ? (viewMode ? t('yourComment') : t('editComment')) : t('writeComment')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </View>

          {loadingInitial ? (
          <ActivityIndicator size="small" style={{marginTop: 20}} />
          ) : viewMode ? (
            <View style={styles.viewModeContainer}>
              <Text style={styles.viewModeText}>{inputText}</Text>
              <View style={styles.viewModeActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setViewMode(false)}>
                  <Edit2 size={20} color="#F97316" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={handleDelete} disabled={sending}>
                  {sending ? <ActivityIndicator size="small" /> : <Trash2 size={20} color="#ef4444" />}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.inputSection}>
              <View style={styles.inputHeader}>
                {/* Switch'i TouchableOpacity ile SARMAMAK önemli: switch'e
                    dokunma hem switch'i hem sarmalayıcıyı tetikleyip değeri iki
                    kez çevirebiliyor. Bunun yerine yalnızca etiket metni
                    ayrı bir dokunma hedefi. */}
                <View style={styles.spoilerToggle}>
                  <Switch
                    value={isSpoiler}
                    onValueChange={setIsSpoiler}
                    trackColor={{false: '#3f3f46', true: '#3b82f6'}}
                    thumbColor={Platform.OS === 'ios' ? '#fff' : isSpoiler ? '#fff' : '#a3a3a3'}
                  />
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setIsSpoiler((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Text style={styles.spoilerText}>{t('containsSpoiler')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.inputRow, hint.isError && styles.inputError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder={existingCommentId ? t('updateComment') : t('episodeThought')}
                  placeholderTextColor="#a3a3a3"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={MAX_COMMENT_CHARS}
                  autoFocus={!existingCommentId}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                  onPress={handleSend}
                  disabled={!canSend}
                >
                  {sending ? (
                    <ActivityIndicator size="small" />
                  ) : existingCommentId ? (
                    <Check size={20} color={canSend ? '#3b82f6' : '#475569'} />
                  ) : (
                    <Send size={20} color={canSend ? '#3b82f6' : '#475569'} />
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.hintRow}>
                {hint.isError && <AlertTriangle size={13} color="#ef4444" style={{marginRight: 5}} />}
                <Text style={[styles.hintText, hint.isError && styles.hintTextError]}>{hint.text}</Text>
              </View>
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
    // Web'de sheet ekranın tamamına yayılıp devasa görünüyordu.
    ...(Platform.OS === 'web' && {
      maxWidth: 680,
      alignSelf: 'center',
      width: '100%',
    } as any),
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
  spoilerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spoilerText: {
    color: '#e5e5e5',
    fontSize: 12,
    marginLeft: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#172033',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textInput: {
    color: '#fff',
    maxHeight: 150,
    minHeight: 80,
    flex: 1, // '%90' sabit genişlik dar ekranlarda gönder butonunu taşırıyordu
    ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any),
  },
  sendBtn: {
    marginLeft: 12,
    padding: 8,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    minHeight: 18,
  },
  hintText: {
    color: '#737373',
    fontSize: 11,
  },
  hintTextError: {
    color: '#ef4444',
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, TextInput, Keyboard } from 'react-native';
import { useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquare } from '../../../../components/icons';
import { confirmAsync } from '../../../../utils/confirmDialog';
import { FeedActivity } from '../../types';
import { useActivityActions } from '../../hooks/useActivityActions';
import { useFeedComments } from '../../hooks/useFeedComments';
import { useOwnRatingEdit } from '../../hooks/useOwnRatingEdit';
import { useAppBack } from '../../../../hooks/useAppBack';
import FeedCommentItem from '../FeedCommentItem';
import ActivityDetailHero from './ActivityDetailHero';
import ActivityActionBar from './ActivityActionBar';
import CommentComposer from './CommentComposer';

interface Props {
  activity: FeedActivity;
  patchLocal: (patch: Partial<FeedActivity>) => void;
  /** Yorum ikonundan gelindiyse (`?yorum=1`) klavye yorum kutusunda açılır. */
  focusComposer: boolean;
}

/**
 * C2 · Kullanıcı yayınının tam ekran detayı (onaylanan taslak A): üstte yayın,
 * altında beğeni/yorum sayaçları ve eylem satırı, yorum listesi, en altta
 * sabit yorum kutusu. Eski alttan açılan yorum penceresinin yerini aldı.
 */
export default function PublishedActivityDetail({ activity, patchLocal, focusComposer }: Props) {
  const { t } = useTranslation('feed');
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const inputRef = useRef<TextInput>(null);
  const actions = useActivityActions(activity, { onLocalPatch: patchLocal });
  const yorumlar = useFeedComments(activity.id, true);
  const geri = useAppBack();
  // C3 · Kendi yayınının düzenle/sil yolları (bugün var olanlar).
  const puan = useOwnRatingEdit(activity, actions, geri);
  // Silme onayı türüne göre (DIL-05: inceleme/gönderi silerken «Delete Activity» yazıyordu).
  const silmeOnayi =
    activity.activityType === 'reviewed'
      ? { title: t('reviewDeleteConfirmTitle', 'İncelemeyi Sil'), message: t('reviewDeleteConfirmMessage', 'Bu incelemeyi silmek istediğine emin misin? Bu işlem geri alınamaz.') }
      : activity.activityType === 'posted'
        ? { title: t('postDeleteConfirmTitle', 'Gönderiyi Sil'), message: t('postDeleteConfirmMessage', 'Bu gönderiyi silmek istediğine emin misin? Bu işlem geri alınamaz.') }
        : undefined;
  const menuProps = {
    ...actions.menuProps,
    deleteConfirm: silmeOnayi,
    onDelete: actions.isOwnActivity
      ? async () => {
          if (await actions.deleteOwn()) geri();
        }
      : undefined,
  };

  // Klavye açıkken alt güvenli alan payı (insets.bottom) eklenmez — yoksa
  // yorum kutusuyla klavye arasında boş bir şerit kalıyordu (cihazda görüldü).
  const [klavyeAcik, setKlavyeAcik] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setKlavyeAcik(true));
    const k = Keyboard.addListener('keyboardDidHide', () => setKlavyeAcik(false));
    return () => {
      a.remove();
      k.remove();
    };
  }, []);

  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const send = async () => {
    const metin = body.trim();
    if (!metin) return;
    setSubmitError(null);
    const sonuc = await yorumlar.submitComment(metin, spoiler);
    if (sonuc.ok) {
      setBody('');
      setSpoiler(false);
      // Store'daki kopyayı hook kesin sayıyla yazıyor; yerel kopya (paylaşım linki) için:
      if (sonuc.count != null) patchLocal({ commentCount: sonuc.count });
    } else {
      setSubmitError(sonuc.message);
    }
  };

  const removeComment = useCallback(
    async (id: string) => {
      await yorumlar.removeComment(id);
      patchLocal({ commentCount: Math.max(0, activity.commentCount - 1) });
    },
    [yorumlar, patchLocal, activity.commentCount]
  );

  // Y16 ile aynı koruma (eski yorum penceresinde vardı): yazılmış yorum varken
  // geri çıkış onay ister — uzun bir metin tek dokunuşla kaybolmasın.
  useEffect(() => {
    if (!body.trim()) return;
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      e.preventDefault();
      confirmAsync(
        t('commentDiscardTitle', 'Yorumdan çıkılsın mı?'),
        t('commentDiscardText', 'Yazdıkların kaydedilmeyecek.'),
        t('discardConfirm', 'Vazgeç'),
        t('keepEditing', 'Devam Et')
      ).then((ok) => {
        if (ok) navigation.dispatch(e.data.action);
      });
    });
    return unsub;
  }, [navigation, body, t]);

  const header = (
    <View>
      <ActivityDetailHero
        activity={activity}
        actions={actions}
        menuProps={menuProps}
        onPressRating={puan.canEditRating ? puan.openRatingEditor : undefined}
      />
      <ActivityActionBar
        activity={activity}
        onToggleLike={actions.toggleLike}
        isLiking={actions.isLiking}
        onShare={actions.share}
        onPressComment={() => inputRef.current?.focus()}
      />
    </View>
  );

  const bos = yorumlar.isLoading ? (
    <ActivityIndicator style={styles.loading} color="#3b82f6" />
  ) : yorumlar.hasError ? (
    <Text style={styles.emptyText}>{t('commentsError', 'Yorumlar yüklenemedi.')}</Text>
  ) : (
    <View style={styles.empty}>
      <MessageSquare size={26} color="#334155" />
      <Text style={styles.emptyText}>{t('detailFirstComment', 'İlk yorumu sen yaz.')}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        data={yorumlar.isLoading || yorumlar.hasError ? [] : yorumlar.comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={header}
        ListEmptyComponent={bos}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <FeedCommentItem
            comment={item}
            isOwn={!!yorumlar.myUserId && item.userId === yorumlar.myUserId}
            isLiked={yorumlar.likedCommentIds.has(item.id)}
            onToggleLike={() => yorumlar.toggleCommentLike(item.id)}
            onDelete={() => removeComment(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      {actions.canComment && (
        <View style={styles.composerWrap}>
          <CommentComposer
            ref={inputRef}
            value={body}
            onChange={setBody}
            spoiler={spoiler}
            onToggleSpoiler={() => setSpoiler((s) => !s)}
            onSend={send}
            isSubmitting={yorumlar.isSubmitting}
            error={submitError}
            autoFocus={focusComposer}
            bottomInset={klavyeAcik ? 0 : insets.bottom}
          />
        </View>
      )}
      {actions.modals}
      {puan.ratingModal}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  composerWrap: { width: '100%', maxWidth: 680, alignSelf: 'center' },
  separator: { height: 1, backgroundColor: '#1a2438' },
  loading: { marginTop: 24 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 28 },
  emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 12 },
});

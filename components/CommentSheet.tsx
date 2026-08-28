import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { X, MessageSquare } from './icons';
import CommentItem from './comments/CommentItem';
import CommentSortBar from './comments/CommentSortBar';
import CommentListSkeleton from './skeletons/CommentListSkeleton';
import { useComments, CommentSort } from '../hooks/useComments';
import { UseMediaReviewsResult } from '../hooks/useMediaReviews';
import ReviewItem from './reviews/ReviewItem';

interface CommentSheetProps {
  visible: boolean;
  onClose: () => void;
  mediaId: number;
  mediaType: 'show' | 'movie' | 'episode';
  season?: number;
  episode?: number;
  /**
   * Y6 (Madde 244): bu sheet eskiden YALNIZCA Trakt yorumlarını gösteriyordu
   * — "Tümünü Gör" adının vaat ettiğinin aksine, kullanıcının kendi KaymakTV
   * incelemesi burada hiç görünmüyordu. Ekran (`app/{show,movie,episode}/
   * [id].tsx`) `useMediaReviews`'i BİR KEZ çağırıp `MediaCommentsSection` ile
   * BU sheet'e AYNI referansı geçiriyor — burada tekrar çağırmak her sayfa
   * açılışında incelemeleri iki kez çeker (bkz. MediaCommentsSection başlığı).
   */
  reviewsState: UseMediaReviewsResult & { canSubmit: boolean };
}

export default function CommentSheet({
  visible,
  onClose,
  mediaId,
  mediaType,
  season,
  episode,
  reviewsState,
}: CommentSheetProps) {
  const { t } = useTranslation(['common', 'media']);
  const [sort, setSort] = useState<CommentSort>('likes');
  const { comments, loading, loadingMore, error, totalCount, loadComments, loadMore } =
    useComments({ mediaId, mediaType, season, episode, sort });

  const { myReview, otherReviews, toggleReviewLike } = reviewsState;

  // S7 ile AYNI tekilleştirme (bkz. TraktCommentsBlock başlığı): aynı
  // kişinin hem KaymakTV incelemesi hem eski bir Trakt yorumu olabilir —
  // üstteki KaymakTV bloğunda zaten göründüğü için Trakt listesinde bir
  // daha çıkmamalı, aksi halde "aynı kişi iki kez" görünür.
  const excludeSlugs = useMemo(() => {
    const slugs = new Set<string>();
    if (myReview?.user.traktSlug) slugs.add(myReview.user.traktSlug);
    for (const r of otherReviews) if (r.user.traktSlug) slugs.add(r.user.traktSlug);
    return slugs;
  }, [myReview, otherReviews]);

  const dedupedComments = useMemo(
    () => comments.filter((c) => !c.user?.ids?.slug || !excludeSlugs.has(c.user.ids.slug)),
    [comments, excludeSlugs]
  );

  const kaymakReviewCount = (myReview ? 1 : 0) + otherReviews.length;

  // `sort` bağımlılığa dahil: kullanıcı sıralamayı değiştirdiğinde de yeniden
  // çekilsin. `loadComments` zaten `sort` değiştiğinde yeniden oluşturuluyor
  // (`useComments` içindeki `useCallback` bağımlılığı) — bu yüzden burada
  // yalnızca "ne zaman çağrılsın" sorusu var.
  useEffect(() => {
    if (visible && mediaId) {
      loadComments();
    }
  }, [visible, mediaId, sort]);

  // Sheet kapanınca sıralamayı sıfırla — bir sonraki açılışta her zaman
  // varsayılan "en çok beğenilen" ile başlasın, önceki medyada seçilmiş
  // sıralama sızmasın.
  useEffect(() => {
    if (!visible) setSort('likes');
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      {/* Cevap yazma kutusu liste içinde olduğundan klavye yönetimi burada da şart */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MessageSquare size={20} color="#60a5fa" />
              <Text style={styles.title}>
                {t('media:comments')}
                {(totalCount + kaymakReviewCount) > 0 && (
                  <Text style={styles.count}> ({totalCount + kaymakReviewCount})</Text>
                )}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color="#94a3b8" size={22} />
            </TouchableOpacity>
          </View>

          {/* Sıralama: yalnızca en az bir yorum bilindiğinde göster — ilk
              yükleme bitmeden (totalCount hâlâ varsayılan 0) veya boş
              durumda gösterip kullanıcıyı yanıltmayalım. Sıralama
              değişirken de `totalCount` bir önceki istekten kalma değerini
              koruduğu için (yalnızca başarılı fetch sonunda güncelleniyor)
              bar geçişler arasında ZIPLAMIYOR. */}
          {totalCount > 0 && <CommentSortBar value={sort} onChange={setSort} />}

          {/* Content */}
          {loading ? (
            <CommentListSkeleton />
          ) : error ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={loadComments} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>{t('retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={dedupedComments}
              keyExtractor={(item, index) =>
                item.id ? item.id.toString() : index.toString()
              }
              renderItem={({ item }) => <CommentItem item={item} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              // Y6 (Madde 244): "Tümünü Gör" artık gerçekten TÜMÜNÜ gösteriyor
              // — KaymakTV incelemeleri (varsa) üstte, sonra yumuşak bir
              // ayraç, sonra Trakt'ın sayfalanan listesi. `ListHeaderComponent`
              // FlatList'in KENDİ scroll'unun içinde akar — ikinci bir
              // kaydırılabilir alan açmaz.
              ListHeaderComponent={
                kaymakReviewCount > 0 ? (
                  <View style={styles.kaymakReviews}>
                    {myReview && (
                      <ReviewItem review={myReview} isOwn onToggleLike={() => toggleReviewLike(myReview.id)} />
                    )}
                    {otherReviews.map((review) => (
                      <ReviewItem
                        key={review.id}
                        review={review}
                        isOwn={false}
                        onToggleLike={() => toggleReviewLike(review.id)}
                      />
                    ))}
                    {dedupedComments.length > 0 && (
                      <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerLabel}>
                          {t('media:traktCommunityTitle', 'Trakt topluluğundan')}
                        </Text>
                        <View style={styles.dividerLine} />
                      </View>
                    )}
                  </View>
                ) : null
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" />
                  </View>
                ) : null
              }
              // KaymakTV bloğu zaten dolu göründüyse "henüz yorum yok" boş
              // durumu YANLIŞ olur — yalnızca İKİ liste de gerçekten boşsa
              // gösterilir (ListHeaderComponent'in `null` döndüğü tek durum).
              ListEmptyComponent={
                kaymakReviewCount === 0 ? (
                  <View style={styles.emptyState}>
                    <MessageSquare size={40} color="#1e293b" />
                    <Text style={styles.emptyTitle}>{t('noCommentsYet')}</Text>
                    <Text style={styles.emptySubtitle}>{t('firstCommentPrompt')}</Text>
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kaymakReviews: {
    marginBottom: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1e293b',
  },
  dividerLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0B1120',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '88%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' && {
      maxWidth: 680,
      alignSelf: 'center',
      width: '100%',
      borderRadius: 20,
      marginBottom: 40,
    } as any),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  count: {
    color: '#475569',
    fontWeight: '500',
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 60,
  },
  stateText: {
    color: '#475569',
    fontSize: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  retryBtnText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    color: '#475569',
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#334155',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
});

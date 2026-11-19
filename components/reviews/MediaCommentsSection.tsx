import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { PenLine, LogIn, AlertTriangle } from '../icons';
import { useTranslation } from 'react-i18next';
import { incelemeHataMetni } from '../../hooks/useMediaReviews';
import { useAuth } from '../../context/AuthContext';
import { UseMediaReviewsResult } from '../../hooks/useMediaReviews';
import { notify } from '../../utils/confirmDialog';
import ReviewItem from './ReviewItem';
import WriteReviewSheet from './WriteReviewSheet';
import { MOBILE_PALETTE, nativeColor, nativeTint } from '../../constants/mobilePalette';

/**
 * Dizi/film/bölüm detay sayfasının YORUMLAR bölümü — yalnız KaymakTV incelemeleri.
 *
 *     [ İnceleme Yaz ]
 *     ● incelemeler   ❤ 💬 ⋯     ← etkileşimli (beğeni, şikâyet, engel)
 *
 * Trakt topluluğu yorumları 2026-11-18'de kaldırıldı (kullanıcı kararı,
 * BACKLOG `TRAKT-YORUM-KALDIR`, docs/design/TRAKT_YORUM_KALDIRMA.md). Eskiden
 * bu listenin altında salt okunur bir Trakt kuyruğu ve «Tümünü Gör» penceresi
 * vardı; incelemeler zaten burada aynı 20 sınırla tam göründüğü için pencere
 * de kalktı.
 *
 * Tüm veri/mutasyon mantığı `hooks/useMediaReviews.ts`'te — bu dosya yalnızca
 * gösterir (docs/AI_RULES.md §1).
 */

interface MediaCommentsSectionProps {
  /** Dizi/film native detayında buton yerine yazı alanı görünümü. */
  writeActionVariant?: 'default' | 'input';
  // ⚠️ Veri kaynağı (F12/Y6, Madde 244): `useMediaReviews` ekranda
  // (`app/{show,movie,episode}/[id].tsx`) bir kez çağrılıp buraya geçilir.
  reviewsState: UseMediaReviewsResult & { canSubmit: boolean };

  // ── C4 · Akıştan gelinen inceleme (bkz. hooks/useScrollToComment.ts) ──
  /** Vurgulanacak incelemenin id'si (`?yorum=`). */
  focusReviewId?: string | null;
  /** Vurgulanan satır çizilince çağrılır — sayfa oraya kaydırır. */
  onFocusTarget?: (node: View) => void;
}

export default function MediaCommentsSection({
  reviewsState,
  focusReviewId,
  onFocusTarget,
  writeActionVariant = 'default',
}: MediaCommentsSectionProps) {
  const { t } = useTranslation(['media', 'common']);
  const { isGuest } = useAuth();
  const [sheetVisible, setSheetVisible] = useState(false);
  const inputAppearance = writeActionVariant === 'input';
  // C4 · Vurgu birkaç saniye sonra söner (kalıcı bir çerçeve dikkat dağıtırdı).
  const [vurguAcik, setVurguAcik] = useState(!!focusReviewId);
  const vurguRef = useRef<View>(null);
  useEffect(() => {
    if (!focusReviewId) return;
    setVurguAcik(true);
    const z = setTimeout(() => setVurguAcik(false), 3500);
    return () => clearTimeout(z);
  }, [focusReviewId]);

  /** Odaktaki incelemeyi vurgu çerçevesine sarar ve sayfaya konumunu bildirir. */
  const sar = (reviewId: string, node: React.ReactNode) =>
    reviewId === focusReviewId ? (
      <View
        key={reviewId}
        ref={vurguRef}
        onLayout={() => vurguRef.current && onFocusTarget?.(vurguRef.current)}
        style={[styles.focusWrap, vurguAcik && styles.focusOn]}
      >
        {node}
      </View>
    ) : (
      <React.Fragment key={reviewId}>{node}</React.Fragment>
    );

  const {
    myReview,
    otherReviews,
    reviews,
    isLoading,
    hasError,
    isSubmitting,
    canSubmit,
    isTmdbIdPending,
    submitReview,
    removeReview,
    toggleReviewLike,
    refresh,
  } = reviewsState;

  // ⚠️ v2: Burada eskiden `onPublished?.()` çağrısı vardı — ekranın Trakt
  // verisini tazelemesi için. İki gerekçesi de düştü: (1) inceleme artık
  // Trakt'a yazılmıyor, yani Trakt listesi bayatlamıyor; (2) bu bölümün kendi
  // listesi `useMediaReviews` içinde zaten `load(true)` ile tazeleniyor.
  // Kalan tek etkisi, ekranın özet/sezon/benzer yapımları GEREKSİZ yere
  // yeniden çekmesiydi (bkz. MASTER_PLAN "SONRADAN BULUNANLAR" Y1).
  const handleSubmit = submitReview;

  const handleDelete = async () => {
    const result = await removeReview();
    if (!result.ok) {
      // Sessiz başarısızlık YASAK — kart geri geldi, sebebi de görünmeli.
      notify(t('common:error'), incelemeHataMetni(t, result.neden));
    }
  };

  const renderWriteAction = () => {
    if (isGuest) {
      return (
        <View style={styles.guestBox}>
          <LogIn size={16} color={nativeColor('mutedDeep', "#475569")} />
          <Text style={styles.guestText}>
            {t('loginToReview', 'İnceleme yazmak için giriş yap')}
          </Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.writeBtn, inputAppearance && styles.writeInput, !canSubmit && (inputAppearance ? styles.writeInputDisabled : styles.writeBtnDisabled)]}
        onPress={() => setSheetVisible(true)}
        disabled={!canSubmit}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <PenLine size={16} color={canSubmit ? MOBILE_PALETTE.steel : MOBILE_PALETTE.mutedDeep} />
        <Text style={[styles.writeBtnText, inputAppearance && styles.writeInputText, !canSubmit && styles.writeBtnTextDisabled]}>
          {myReview ? t('editReview', 'İncelemeni Düzenle') : t('writeReview', 'İnceleme Yaz')}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return <ActivityIndicator size="small" style={styles.loader} />;
    }

    // "Yüklenemedi" ile "henüz yok" AYRI durumlar — ikisini aynı boş ekranla
    // göstermek sessiz bir yalan olurdu (docs/AI_RULES.md §2, Madde 142'de
    // Akış için çözülen aynı sorun).
    if (hasError) {
      return (
        <View style={styles.errorBox}>
          <AlertTriangle size={15} color="#f87171" />
          <Text style={styles.errorText}>
            {t('reviewsError', 'İncelemeler yüklenemedi.')}
          </Text>
          <TouchableOpacity onPress={refresh} style={styles.retryBtn} activeOpacity={0.8}>
            <Text style={styles.retryText}>{t('common:retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (reviews.length === 0) {
      // Bugünkü ölçekte neredeyse HER yapımda bu dal çalışacak. Bu yüzden
      // hata gibi DEĞİL, davet gibi görünmeli (docs/design/REVIEWS_PLAN.md §7).
      return (
        <Text style={styles.emptyText}>
          {t('reviewsEmpty', 'Henüz kimse inceleme yazmadı. İlk sen ol!')}
        </Text>
      );
    }

    return (
      <View>
        {/* Kendi incelemem HER ZAMAN en üstte — kullanıcı kendi yazdığını
            listede aramak zorunda kalmasın. */}
        {myReview &&
          sar(
            myReview.id,
            <ReviewItem
              review={myReview}
              isOwn
              onToggleLike={() => toggleReviewLike(myReview.id)}
              onEdit={() => setSheetVisible(true)}
              onDelete={handleDelete}
            />
          )}
        {otherReviews.map((review) =>
          sar(
            review.id,
            <ReviewItem review={review} isOwn={false} onToggleLike={() => toggleReviewLike(review.id)} />
          )
        )}
      </View>
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          {t('kaymakReviewsTitle', 'KaymakTV İncelemeleri')}
        </Text>
        {reviews.length > 0 && <Text style={styles.count}>{reviews.length}</Text>}
      </View>

      {renderWriteAction()}

      {/* tmdbId henüz çözülmediyse buton pasif — kullanıcı NEDEN pasif
          olduğunu görmeli, yoksa "bozuk" sanır. */}
      {!isGuest && !canSubmit && isTmdbIdPending && (
        <Text style={styles.pendingNote}>
          {t('reviewTmdbPending', 'Yapım bilgisi yükleniyor…')}
        </Text>
      )}

      {renderBody()}

      {/* Mevcut metin BİZİM satırımızdan geliyor (v2). */}
      <WriteReviewSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        isSubmitting={isSubmitting}
        initialBody={myReview?.note ?? undefined}
        initialSpoiler={myReview?.noteSpoiler}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // C4 · akıştan gelinen incelemenin vurgusu (3,5 sn sonra söner).
  focusWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  focusOn: {
    borderColor: nativeColor('primary', '#3b82f6'),
    backgroundColor: nativeTint('primary', 0.10, 'rgba(59,130,246,0.10)'),
  },
  section: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  count: {
    color: nativeColor('mutedDeep', '#64748b'),
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: nativeColor('surface', '#172033'),
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  writeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: MOBILE_PALETTE.surface,
    borderWidth: 1,
    borderColor: MOBILE_PALETTE.border,
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 4,
  },
  writeBtnDisabled: {
    backgroundColor: nativeColor('surface', '#111827'),
    borderColor: 'rgba(255,255,255,0.06)',
  },
  writeBtnText: {
    color: MOBILE_PALETTE.steel,
    fontSize: 13,
    fontWeight: '700',
  },
  writeInput: {
    justifyContent: 'flex-start',
    minHeight: 52,
    paddingHorizontal: 16,
    backgroundColor: MOBILE_PALETTE.surface,
    borderColor: MOBILE_PALETTE.border,
    borderRadius: 14,
  },
  writeInputDisabled: { backgroundColor: MOBILE_PALETTE.surface, borderColor: MOBILE_PALETTE.border },
  writeInputText: { color: MOBILE_PALETTE.muted, fontSize: 14, fontWeight: '500' },
  writeBtnTextDisabled: {
    color: nativeColor('mutedDeep', '#475569'),
  },
  pendingNote: {
    color: nativeColor('mutedDeep', '#475569'),
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },
  guestBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(23,32,51,0.5)',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: nativeColor('raised', '#1e293b'),
  },
  loader: {
    marginVertical: 20,
  },
  emptyText: {
    color: nativeColor('mutedDeep', '#475569'),
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 14,
  },
  guestText: {
    color: nativeColor('mutedDeep', '#475569'),
    fontStyle: 'italic',
    fontSize: 14,
  },
  errorBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  errorText: {
    color: nativeColor('muted', '#94a3b8'),
    fontSize: 13,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: nativeColor('surface', '#172033'),
    borderRadius: 8,
  },
  retryText: {
    color: '#e5e5e5',
    fontSize: 12,
    fontWeight: '700',
  },
});

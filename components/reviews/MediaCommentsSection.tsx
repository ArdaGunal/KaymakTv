import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { PenLine, LogIn, AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useMediaReviews } from '../../hooks/useMediaReviews';
import { FeedMediaType } from '../../features/feed/types';
import { notify } from '../../utils/confirmDialog';
import { CommentData } from '../../hooks/useComments';
import SectionErrorBoundary from '../SectionErrorBoundary';
import ReviewItem from './ReviewItem';
import TraktCommentsBlock from './TraktCommentsBlock';
import WriteReviewSheet from './WriteReviewSheet';

/**
 * Dizi/film/bölüm detay sayfasının YORUMLAR bölümü — **tek akış, iki blok**.
 *
 * ⚠️ ADI DEĞİŞTİ (eski: `MediaReviewsSection`): bileşen artık yalnızca
 * "incelemeler"i değil, TÜM yorumlar bölümünü çiziyor — bizim etkileşimli
 * incelemelerimiz + Trakt'ın salt okunur kuyruğu.
 *
 * ⚠️ v2 DEĞİŞİKLİĞİ: v1'de bu bölüm yalnızca KaymakTV incelemelerini çiziyor,
 * Trakt yorumları ekranda AYRI bir bölüm olarak duruyordu. Artık ikisi tek bir
 * kesintisiz liste (sekme YOK, ayrı alan YOK):
 *
 *     [ İnceleme Yaz ]
 *     ● bizim incelemelerimiz   ❤ 💬 ⋯     ← etkileşimli
 *     ───── Trakt topluluğundan ─────      ← yumuşak ayraç
 *     ○ Trakt yorumları  ᴛʀᴀᴋᴛ            ← SALT OKUNUR, buton yok
 *
 * NEDEN GERÇEK "INTERLEAVE" DEĞİL: iki kaynağı tarihe göre iç içe harmanlamak
 * iki imleçli bir merge-sort ister (tamponlama + "hangi kaynaktan kaç kayıt
 * tüketildi" durumu). Ölçek bunu gereksiz kılıyor — bir yapımda bizim inceleme
 * sayımız uzun süre 0-2, Trakt'ınki yüzlerce olacak. Bloklar sıralı olunca
 * Trakt'ın mevcut sayfalaması (`useComments`) HİÇ DEĞİŞMEDEN çalışıyor
 * (bkz. docs/REVIEWS_PLAN.md §4).
 *
 * KADEMELİ ÇÖKÜŞ: Trakt bloğu veri hatasında (boş liste) ve render hatasında
 * (`SectionErrorBoundary silent`) SESSİZCE kaybolur — sayfa çalışmaya devam
 * eder (Karar 10).
 *
 * Tüm veri/mutasyon mantığı `hooks/useMediaReviews.ts`'te — bu dosya yalnızca
 * gösterir (docs/AI_RULES.md §1).
 */

interface MediaCommentsSectionProps {
  mediaId: number;
  mediaType: FeedMediaType;
  mediaTitle: string;
  /** Çözülene kadar undefined olabilir — o sürede yazma pasif kalır (§1.2). */
  tmdbId?: number;
  /** "S01E02" — bölüm sayfasında geçilir; bu bölüme özel incelemeler listelenir. */
  episodeNumber?: string;

  // ── Trakt bloğu (salt okunur) ─────────────────────────────────────────
  /** Ekranın `useShowDetail`/`useMovieDetail`'den aldığı Trakt yorumları. */
  traktComments?: CommentData[];
  /** Trakt yorumları hâlâ yükleniyor mu (S12 — bağımsız yükleme). */
  isLoadingTraktComments?: boolean;
  /** "Tümünü Gör" — Trakt'ın kendi sheet'ini açar (sayfalama + sıralama orada). */
  onSeeAllTrakt?: () => void;
}

export default function MediaCommentsSection({
  mediaId,
  mediaType,
  mediaTitle,
  tmdbId,
  episodeNumber,
  traktComments,
  isLoadingTraktComments,
  onSeeAllTrakt,
}: MediaCommentsSectionProps) {
  const { t } = useTranslation(['media', 'common']);
  const { isGuest } = useAuth();
  const [sheetVisible, setSheetVisible] = useState(false);

  const {
    myReview,
    otherReviews,
    reviews,
    isLoading,
    hasError,
    isSubmitting,
    canSubmit,
    submitReview,
    removeReview,
    toggleReviewLike,
    refresh,
  } = useMediaReviews({ mediaId, mediaType, mediaTitle, tmdbId, episodeNumber });

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
      notify(t('common:error'), result.message);
    }
  };

  const renderWriteAction = () => {
    if (isGuest) {
      return (
        <View style={styles.guestBox}>
          <LogIn size={16} color="#475569" />
          <Text style={styles.guestText}>
            {t('loginToReview', 'İnceleme yazmak için giriş yap')}
          </Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.writeBtn, !canSubmit && styles.writeBtnDisabled]}
        onPress={() => setSheetVisible(true)}
        disabled={!canSubmit}
        activeOpacity={0.8}
      >
        <PenLine size={15} color={canSubmit ? '#fb923c' : '#475569'} />
        <Text style={[styles.writeBtnText, !canSubmit && styles.writeBtnTextDisabled]}>
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
      // Bugünkü ölçekte neredeyse HER yapımda bu dal çalışacak (canlıda 0
      // inceleme var). Bu yüzden hata gibi DEĞİL, davet gibi görünmeli —
      // hemen altında Trakt bloğu akmaya devam ettiği için sayfa asla boş
      // görünmüyor (docs/REVIEWS_PLAN.md §7).
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
        {myReview && (
          <ReviewItem
            review={myReview}
            isOwn
            onToggleLike={() => toggleReviewLike(myReview.id)}
            onEdit={() => setSheetVisible(true)}
            onDelete={handleDelete}
          />
        )}
        {otherReviews.map((review) => (
          <ReviewItem
            key={review.id}
            review={review}
            isOwn={false}
            onToggleLike={() => toggleReviewLike(review.id)}
          />
        ))}
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
      {!isGuest && !canSubmit && !tmdbId && (
        <Text style={styles.pendingNote}>
          {t('reviewTmdbPending', 'Yapım bilgisi yükleniyor…')}
        </Text>
      )}

      {renderBody()}

      {/* Trakt bloğu SESSİZ hata sınırıyla sarılı: bir render istisnası
          yalnızca bu kuyruğu düşürür, kendi incelemelerimiz ve sayfanın geri
          kalanı ayakta kalır (S13 + Karar 10). */}
      <SectionErrorBoundary label="trakt-comments" silent>
        <TraktCommentsBlock
          comments={traktComments}
          isLoading={isLoadingTraktComments}
          // Tekilleştirme anahtarı BURADA üretiliyor — iki veri kümesinin
          // buluştuğu tek yer burası (bkz. TraktCommentsBlock başlığı, S7).
          excludeSlugs={new Set(reviews.map((r) => r.user.traktSlug).filter(Boolean) as string[])}
          onSeeAll={onSeeAllTrakt}
        />
      </SectionErrorBoundary>

      {/* Mevcut metin artık BİZİM satırımızdan geliyor (v2) — sheet'in
          Trakt'tan okuması kalktı. */}
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
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#172033',
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
    backgroundColor: 'rgba(251,146,60,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.3)',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 4,
  },
  writeBtnDisabled: {
    backgroundColor: '#111827',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  writeBtnText: {
    color: '#fb923c',
    fontSize: 13,
    fontWeight: '700',
  },
  writeBtnTextDisabled: {
    color: '#475569',
  },
  pendingNote: {
    color: '#475569',
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
    borderColor: '#1e293b',
  },
  loader: {
    marginVertical: 20,
  },
  emptyText: {
    color: '#475569',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 14,
  },
  guestText: {
    color: '#475569',
    fontStyle: 'italic',
    fontSize: 14,
  },
  errorBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: '#172033',
    borderRadius: 8,
  },
  retryText: {
    color: '#e5e5e5',
    fontSize: 12,
    fontWeight: '700',
  },
});

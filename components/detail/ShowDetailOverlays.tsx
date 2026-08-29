import React from 'react';
import { useTranslation } from 'react-i18next';
import EpisodeOptionsModal from '../modals/EpisodeOptionsModal';
import EpisodeRatingModal from '../modals/EpisodeRatingModal';
import CommentSheet from '../CommentSheet';
import Snackbar from '../Snackbar';

export interface SelectedEpisode {
  season: number;
  episode: number;
  title: string;
  traktId?: number;
}

interface ShowDetailOverlaysProps {
  showTraktId: number;
  reviewsState: any;

  selectedEpisode: SelectedEpisode | null;
  onCloseEpisodeOptions: () => void;
  loadingOption: any;
  onOpenEpisodeRating: () => void;
  onRewatchEpisode: () => void;
  onUnwatchEpisode: () => void;

  episodeRatingVisible: boolean;
  onCloseEpisodeRating: () => void;
  episodeInitialRating?: number;
  onRateEpisode: (rating: number) => void;
  onRemoveEpisodeRating?: () => void;

  commentSheetVisible: boolean;
  onCloseCommentSheet: () => void;

  unwatchSnackbarVisible: boolean;
  onUndoUnwatch: () => void;
  onDismissUnwatchSnackbar: () => void;

  rewatchSnackbarVisible: boolean;
  onDismissRewatchSnackbar: () => void;
}

/**
 * Dizi detay ekranının TÜM üst katmanı (modallar + snackbar'lar).
 *
 * NEDEN AYRI DOSYA: `app/show/[id].tsx` mobil ve masaüstü olmak üzere İKİ
 * yerleşim döndürüyor; bu blok ikisinde de aynen kullanılıyor. Ekranın içinde
 * bıraksaydık ya kopyalanacaktı (AI_RULES §2.5 yasak) ya da dosya 400 satır
 * sınırını aşacaktı (AI_RULES §1 — "Modallar bağımsız bileşenler haline
 * getirilip ana dosyadan dışarı çıkarılmalıdır").
 *
 * Saf sunum: hiçbir karar burada verilmiyor, her şey prop olarak geliyor.
 */
export default function ShowDetailOverlays({
  showTraktId,
  reviewsState,
  selectedEpisode,
  onCloseEpisodeOptions,
  loadingOption,
  onOpenEpisodeRating,
  onRewatchEpisode,
  onUnwatchEpisode,
  episodeRatingVisible,
  onCloseEpisodeRating,
  episodeInitialRating,
  onRateEpisode,
  onRemoveEpisodeRating,
  commentSheetVisible,
  onCloseCommentSheet,
  unwatchSnackbarVisible,
  onUndoUnwatch,
  onDismissUnwatchSnackbar,
  rewatchSnackbarVisible,
  onDismissRewatchSnackbar,
}: ShowDetailOverlaysProps) {
  const { t } = useTranslation('media');

  return (
    <>
      {/* Bölüm Seçenekleri (Bottom Sheet Modal) */}
      <EpisodeOptionsModal
        visible={!!selectedEpisode}
        onClose={onCloseEpisodeOptions}
        episode={selectedEpisode}
        loadingOption={loadingOption}
        onRatePress={onOpenEpisodeRating}
        onRewatch={onRewatchEpisode}
        onUnwatch={onUnwatchEpisode}
      />

      <EpisodeRatingModal
        visible={episodeRatingVisible}
        onClose={onCloseEpisodeRating}
        initialRating={episodeInitialRating}
        onRate={onRateEpisode}
        onRemove={onRemoveEpisodeRating}
      />

      <CommentSheet
        visible={commentSheetVisible}
        onClose={onCloseCommentSheet}
        mediaId={showTraktId}
        mediaType="show"
        reviewsState={reviewsState}
      />

      <Snackbar
        visible={unwatchSnackbarVisible}
        message={t('episodeUnwatched')}
        actionText={t('undo')}
        onAction={onUndoUnwatch}
        onDismiss={onDismissUnwatchSnackbar}
        duration={4000}
      />

      {/* "Tekrar İzle" isteği Trakt'a doğru gidiyordu ama hiçbir görsel geri
          bildirim yoktu — bu yüzden "çalışmıyor gibi" hissettiriyordu. */}
      <Snackbar
        visible={rewatchSnackbarVisible}
        message={t('rewatchConfirmation')}
        onDismiss={onDismissRewatchSnackbar}
        duration={2500}
      />
    </>
  );
}

import React from 'react';
import { useTranslation } from 'react-i18next';
import EpisodeOptionsModal from '../modals/EpisodeOptionsModal';
import EpisodeRatingModal from '../modals/EpisodeRatingModal';
import Snackbar from '../Snackbar';

export interface SelectedEpisode {
  season: number;
  episode: number;
  title: string;
  traktId?: number;
  /** 1.0.1 Dal 4 · izleme sayısı; 2+ ise «son izlemeyi geri al» sunulur. */
  playCount?: number;
}

interface ShowDetailOverlaysProps {
  selectedEpisode: SelectedEpisode | null;
  onCloseEpisodeOptions: () => void;
  loadingOption: any;
  onOpenEpisodeRating: () => void;
  onRewatchEpisode: () => void;
  onUnwatchEpisode: () => void;
  onUnwatchLastPlay: () => void;

  episodeRatingVisible: boolean;
  onCloseEpisodeRating: () => void;
  episodeInitialRating?: number;
  onRateEpisode: (rating: number) => void;
  onRemoveEpisodeRating?: () => void;

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
  selectedEpisode,
  onCloseEpisodeOptions,
  loadingOption,
  onOpenEpisodeRating,
  onRewatchEpisode,
  onUnwatchEpisode,
  onUnwatchLastPlay,
  episodeRatingVisible,
  onCloseEpisodeRating,
  episodeInitialRating,
  onRateEpisode,
  onRemoveEpisodeRating,
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
        playCount={selectedEpisode?.playCount ?? 1}
        onUnwatchLast={onUnwatchLastPlay}
      />

      <EpisodeRatingModal
        visible={episodeRatingVisible}
        onClose={onCloseEpisodeRating}
        initialRating={episodeInitialRating}
        onRate={onRateEpisode}
        onRemove={onRemoveEpisodeRating}
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

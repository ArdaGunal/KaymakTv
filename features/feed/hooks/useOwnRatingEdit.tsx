import React, { useCallback, useState } from 'react';
import { notify } from '../../../utils/confirmDialog';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useLibraryActions } from '../../../context/LibraryContext';
import RatingModal from '../../../components/modals/RatingModal';
import { FeedActivity } from '../types';
import { useActivityActions } from './useActivityActions';

/**
 * C3 · Kendi puan kartında puanı DETAY SAYFASINDAN değiştir / kaldır
 * (kullanıcı kararı 2026-10-10: «direkt kişi oradan değiştirebilsin… sadece
 * kişiye özel»).
 *
 * 🔒 Yalnız sahibi: `isOwnActivity` (users.id karşılaştırması) değilse hiçbir
 * şey açılmaz. Sunucu tarafı zaten güvenli — puan yazma kullanıcının KENDİ
 * oturumuyla kendi kütüphanesine gider; başkasının puanına yazacak bir yol yok.
 *
 * 🔁 «Geri dönünce bug olmasın»: dizi/film sayfasının KULLANDIĞI AYNI yol
 * (`setLocalRating` + `rateMedia` / `removeLocalRating` + `unrateMedia`).
 * Böylece kütüphane dilimi (dizi sayfası, profil), akış kartı (rateMedia
 * aynı satırı günceller; unrateMedia kartı geri çeker — 062) ve bu sayfa
 * tek kaynaktan beslenir. Hata olursa hepsi geri alınır.
 */
export function useOwnRatingEdit(
  activity: FeedActivity,
  actions: ReturnType<typeof useActivityActions>,
  onRemoved: () => void
) {
  const { t } = useTranslation('feed');
  const { isGuest } = useAuth();
  const { rateMedia, unrateMedia, setLocalRating, removeLocalRating } = useLibraryActions();
  const [visible, setVisible] = useState(false);

  const canEditRating =
    actions.isOwnActivity &&
    !isGuest &&
    activity.activityType === 'rated' &&
    activity.rating != null &&
    activity.showId != null &&
    (activity.mediaType === 'show' || activity.mediaType === 'movie');

  const onRate = useCallback(
    async (val: number) => {
      if (!canEditRating || val === activity.rating) return;
      const id = activity.showId!;
      const tur = activity.mediaType!;
      const onceki = activity.rating!;
      setLocalRating(id, tur, val);
      actions.patch({ rating: val });
      try {
        await rateMedia(id, tur, val, { title: activity.showTitle, tmdbId: activity.tmdbId });
      } catch (error) {
        console.warn('[Feed] Puan değiştirilemedi:', error);
        setLocalRating(id, tur, onceki);
        actions.patch({ rating: onceki });
        notify(t('common:error', 'Hata'), t('detailRatingError', 'Puan kaydedilemedi, tekrar dene.'));
      }
    },
    [canEditRating, activity.rating, activity.showId, activity.mediaType, activity.showTitle, activity.tmdbId, setLocalRating, rateMedia, actions, t]
  );

  const onRemove = useCallback(async () => {
    if (!canEditRating) return;
    const id = activity.showId!;
    const tur = activity.mediaType!;
    const onceki = activity.rating!;
    removeLocalRating(id, tur);
    try {
      // unrateMedia akıştaki kartı da geri çeker (retractLocalActivity); sunucu
      // satırını 062 tetikleyicisi siler. Kart artık yok → sayfadan çık.
      await unrateMedia(id, tur);
      onRemoved();
    } catch (error) {
      console.warn('[Feed] Puan kaldırılamadı:', error);
      setLocalRating(id, tur, onceki);
      notify(t('common:error', 'Hata'), t('detailRatingRemoveError', 'Puan kaldırılamadı, tekrar dene.'));
    }
  }, [canEditRating, activity.showId, activity.mediaType, activity.rating, removeLocalRating, unrateMedia, setLocalRating, onRemoved, t]);

  const ratingModal = canEditRating ? (
    <RatingModal
      visible={visible}
      onClose={() => setVisible(false)}
      userRating={activity.rating}
      onRate={onRate}
      onRemoveRating={onRemove}
    />
  ) : null;

  return { canEditRating, openRatingEditor: () => setVisible(true), ratingModal };
}

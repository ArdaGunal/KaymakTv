import React, { useCallback, useState } from 'react';
import { Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FeedActivity } from '../types';
import { useAuth } from '../../../context/AuthContext';
import { useMyUserId } from './useMyUserId';
import { useQuickBlock } from './useQuickBlock';
import { useFeedStore } from '../store/feedStore';
import { setLike, setActivityNote } from '../services/feedSocial';
import {
  deleteActivitiesBulk,
  invalidateFeedCache,
  invalidateMediaReviewsCache,
  invalidateUserFeedActivitiesCache,
} from '../services/feedApi';
import { useAktiviteSurumu } from '../store/aktiviteSurumu';
import { buildMediaHref } from '../utils/feedNavigation';
import { isUserPublished } from '../utils/activityKind';
import NoteEditorModal from '../components/NoteEditorModal';
import ReportContentModal from '../components/ReportContentModal';

/**
 * C2 · Bir aktivitenin kullanıcı eylemleri — akış kartı (FeedCard), detay
 * sayfası ve sistem kartı penceresi AYNI davranışı paylaşsın diye tek yerde.
 * (Eskiden hepsi FeedCard'ın içindeydi; detay sayfası gelince üç kopya olurdu.)
 *
 * `onLocalPatch`: aktivite feedStore'da OLMAYABİLİR (paylaşım linki, profil
 * listesi). Store'a yama her zaman yapılır (varsa uygulanır, yoksa no-op);
 * çağıranın yerel kopyası da bu geri çağrıyla güncellenir.
 */
export function useActivityActions(
  activity: FeedActivity,
  options: { onLocalPatch?: (patch: Partial<FeedActivity>) => void } = {}
) {
  const { onLocalPatch } = options;
  const { t } = useTranslation('feed');
  const router = useRouter();
  const { accessToken, isGuest } = useAuth();
  const myUserId = useMyUserId();
  const { blockUserQuick } = useQuickBlock();

  // İyimser (isPending) kartın gerçek id'si yok — sosyal etkileşim hedefi olamaz.
  const isInteractive = !activity.isPending;
  // 🪪 `users.id` ile (M339 · §F6): slug'la sorulunca Google-only kullanıcı
  // KENDİ kartında "Sil" yerine "Engelle" görüyordu.
  const isOwnActivity = isInteractive && !!myUserId && myUserId === activity.user.id;
  const published = isUserPublished(activity);
  // Yorum yalnız kullanıcının yayınına (Worker `handleFeedComment` aynı kural).
  const canComment = isInteractive && published;
  const hasShow = activity.showId != null && activity.mediaType != null;

  const [isLiking, setIsLiking] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const patch = useCallback(
    (p: Partial<FeedActivity>) => {
      useFeedStore.getState().patchActivity(activity.id, p);
      onLocalPatch?.(p);
    },
    [activity.id, onLocalPatch]
  );

  const toggleLike = useCallback(async () => {
    if (!accessToken || isGuest || isLiking || !isInteractive) return;
    const onceki = { isLikedByMe: activity.isLikedByMe, likeCount: activity.likeCount };
    const nextLiked = !activity.isLikedByMe;
    patch({ isLikedByMe: nextLiked, likeCount: Math.max(0, activity.likeCount + (nextLiked ? 1 : -1)) });
    setIsLiking(true);
    try {
      await setLike(accessToken, 'activity', activity.id, nextLiked);
    } catch (error) {
      console.warn('[Feed] Beğeni gönderilemedi:', error);
      patch(onceki); // iyimser durumu geri al
    } finally {
      setIsLiking(false);
    }
  }, [accessToken, isGuest, isLiking, isInteractive, activity.id, activity.isLikedByMe, activity.likeCount, patch]);

  const saveNote = async (note: string, spoiler: boolean) => {
    // Oturum yoksa sessiz dönmek «buton çalışmıyor» hissi veriyordu (AI_RULES).
    if (!accessToken) {
      setNoteError(t('noteSaveAuthError', 'Oturumun bulunamadı, tekrar giriş yap.'));
      return;
    }
    setIsSavingNote(true);
    setNoteError(null);
    try {
      const saved = await setActivityNote(accessToken, activity.id, note || null, spoiler);
      // ⚠️ activityAt BİLİNÇLİ OLARAK yamanmıyor — kart kronolojik yerinde kalır.
      patch({ note: saved.note, noteSpoiler: saved.noteSpoiler });
      setNoteModalVisible(false);
    } catch (error: any) {
      console.warn('[Feed] Not kaydedilemedi:', error);
      setNoteError(
        error?.response?.data?.message || error?.message || t('noteSaveError', 'Alıntı kaydedilemedi, tekrar dene.')
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  // Paylaşım linki — hedef `app/activity/[id].tsx` (herkese açık kalıcı bağlantı).
  const share = useCallback(async () => {
    try {
      const url = `https://kaymaktv.com/activity/${activity.id}`;
      await Share.share({ message: `${t('shareActivityMsg')}\n${url}` });
    } catch (error) {
      console.log(error);
    }
  }, [activity.id, t]);

  // Takip durumu kanonik slug ile anahtarlı ama rota kullanıcı adıyla çözülüyor
  // (bkz. eski FeedCard notu) — davranış aynen korunur.
  const openProfile = useCallback(() => {
    router.push(`/user/${activity.user.username}`);
  }, [router, activity.user.username]);

  const openMedia = useCallback(() => {
    if (!hasShow) return;
    router.push(buildMediaHref({ showId: activity.showId!, mediaType: activity.mediaType!, tmdbId: activity.tmdbId }) as any);
  }, [router, hasShow, activity.showId, activity.mediaType, activity.tmdbId]);

  /** C2 · Yayın → tam ekran detay; `yorum` true ise yorum kutusu odaklı açılır. */
  const openDetail = useCallback(
    (yorum = false) => {
      if (!isInteractive) return;
      router.push((`/activity/${activity.id}` + (yorum ? '?yorum=1' : '')) as any);
    },
    [router, isInteractive, activity.id]
  );

  /**
   * C3 · Detay sayfasından KENDİ yayınını sil. Akıştaki silmeyle AYNI uç
   * (`/feed/delete`, hard delete + tombstone); kart iyimser kaldırılır, hata
   * olursa geri konur. Profil listesi, akış önbelleği ve (incelemeyse) yapım
   * sayfasının inceleme önbelleği de tazelenir — geri dönünce eski kart
   * görünmesin. true = silindi (çağıran sayfadan çıkar).
   */
  const deleteOwn = useCallback(async (): Promise<boolean> => {
    if (!isOwnActivity || !accessToken || isGuest) return false;
    const store = useFeedStore.getState();
    const kaldirilan = store.activities.filter((a) => a.id === activity.id);
    kaldirilan.forEach((a) => store.removeActivity(a.id));
    try {
      await deleteActivitiesBulk(accessToken, [activity.id]);
      invalidateFeedCache();
      invalidateUserFeedActivitiesCache();
      if (activity.activityType === 'reviewed' && activity.showId != null && activity.mediaType) {
        invalidateMediaReviewsCache(activity.showId, activity.mediaType, activity.episodeNumber);
      }
      useAktiviteSurumu.getState().artir();
      return true;
    } catch (error) {
      console.warn('[Feed] Aktivite silinemedi:', error);
      kaldirilan.forEach((a) => useFeedStore.getState().upsertActivity(a, false));
      Alert.alert(
        t('common:error', 'Hata'),
        t('media:activityDeleteError', 'Aktivite(ler) silinirken bir sorun oluştu. Lütfen tekrar deneyin.')
      );
      return false;
    }
  }, [isOwnActivity, accessToken, isGuest, activity, t]);

  /** CardMenu'ye verilecek eylemler — `onDelete` çağıranın (silme yolu ekrana göre değişir). */
  const menuProps = {
    onEdit: isOwnActivity ? () => setNoteModalVisible(true) : undefined,
    onShare: share,
    onReport: isInteractive && !isOwnActivity ? () => setReportModalVisible(true) : undefined,
    onBlock:
      isInteractive && !isOwnActivity && accessToken && !isGuest
        ? () => blockUserQuick({ userId: activity.user.id })
        : undefined,
  };

  const modals = (
    <>
      {isOwnActivity && (
        <NoteEditorModal
          visible={noteModalVisible}
          initialNote={activity.note ?? ''}
          initialSpoiler={!!activity.noteSpoiler}
          saving={isSavingNote}
          error={noteError}
          onSave={saveNote}
          onCancel={() => {
            setNoteError(null);
            setNoteModalVisible(false);
          }}
        />
      )}
      {isInteractive && !isOwnActivity && (
        <ReportContentModal
          visible={reportModalVisible}
          targetType="activity"
          targetId={activity.id}
          onClose={() => setReportModalVisible(false)}
        />
      )}
    </>
  );

  return {
    isInteractive,
    isOwnActivity,
    published,
    canComment,
    hasShow,
    isLiking,
    toggleLike,
    share,
    openProfile,
    openMedia,
    openDetail,
    openNoteEditor: () => setNoteModalVisible(true),
    deleteOwn,
    /** Store + çağıranın yerel kopyasına kısmi yama (C3 puan düzenleme). */
    patch,
    menuProps,
    modals,
  };
}

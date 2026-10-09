import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, Pressable } from 'react-native';
import Avatar from '../../../components/Avatar';
import { Eye, Play, CheckCircle2, Star, Clapperboard, Heart, MessageCircle, Repeat, MessageSquarePlus, PenLine } from '../../../components/icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import MediaPoster from '../../../components/MediaPoster';
import { FeedActivity } from '../types';
import { formatRelativeTime } from '../../../utils/formatRelativeTime';
import { buildMediaHref } from '../utils/feedNavigation';
import { activityLabel } from '../utils/activityLabel';
import CardMenu from './CardMenu';
import FeedActivityNote from './FeedActivityNote';
import NoteEditorModal from './NoteEditorModal';
import FeedCommentSheet from './FeedCommentSheet';
import ReportContentModal from './ReportContentModal';
import { useAuth } from '../../../context/AuthContext';
import { useMyUserId } from '../hooks/useMyUserId';
import { useQuickBlock } from '../hooks/useQuickBlock';
import { useFeedStore } from '../store/feedStore';
import { setLike, setActivityNote } from '../services/feedSocial';

interface FeedCardProps {
  activity: FeedActivity;
  /** Akış (feed.tsx) VE Profil › Aktiviteler'in İKİSİ de geçer — hangi
   *  ekranda olduğuna göre farklı bir silme yolu (feedStore vs. yerel liste)
   *  çağırırlar, kart bunu bilmek zorunda değil. Verilmezse (ör. Public
   *  Profile — başkasının aktivitesi) 3-nokta menüsünde "Sil" hiç görünmez. */
  onDeleteActivity?: () => void | Promise<void>;
  /** C1 · Kartın boş alanına dokununca detay sayfası (`/activity/[id]`) açılır.
   *  Detay sayfasının KENDİSİ false geçer — kart kendine yönlendirmesin. */
  openDetailOnPress?: boolean;
}

// Her aktivite tipi kendi ikonunu ve vurgu rengini taşır. Cümlenin kendisi
// (A-3, çeviri) `utils/activityLabel.ts`'te — yapım adı orada dile göre
// cümlenin başına ya da ortasına yerleşir.
const ACTIVITY_META: Record<FeedActivity['activityType'], { icon: typeof Eye; color: string }> = {
  watched_episode: { icon: Eye, color: '#38bdf8' },
  watched_movie: { icon: Clapperboard, color: '#f472b6' },
  started_show: { icon: Play, color: '#a78bfa' },
  completed_show: { icon: CheckCircle2, color: '#4ade80' },
  // Puanın 5 üzerinden gösterimi (`formatRating`) activityLabel'da.
  rated: { icon: Star, color: '#facc15' },
  // Bağımsız gönderi ("Fikir Paylaş") — bkz. 017_feed_posts.sql.
  posted: { icon: MessageSquarePlus, color: '#22d3ee' },
  // İnceleme — bkz. 018_feed_reviews.sql, docs/design/REVIEWS_PLAN.md.
  reviewed: { icon: PenLine, color: '#fb923c' },
};

export default function FeedCard({ activity, onDeleteActivity, openDetailOnPress = true }: FeedCardProps) {
  const { t } = useTranslation('feed');
  const meta = ACTIVITY_META[activity.activityType];
  const Icon = meta.icon;
  const label = activityLabel(activity, t);
  const router = useRouter();
  const { accessToken, isGuest } = useAuth();
  const myUserId = useMyUserId();
  const { blockUserQuick } = useQuickBlock();

  // Sosyal katman (bkz. docs/design/FEED_SOCIAL_PLAN.md) — henüz sunucu onayı
  // gelmemiş (iyimser) kartlarda GEÇİCİ bir id var, gerçek bir like/comment
  // hedefi olamaz; bu yüzden tüm sosyal etkileşim onay gelene kadar gizli.
  const isInteractive = !activity.isPending;
  // 🪪 `users.id` ile (M339 · §F6): slug'la sorulunca Google-only kullanıcı
  // KENDİ kartında "Sil" yerine "Engelle" görüyordu.
  const isOwnActivity = isInteractive && !!myUserId && myUserId === activity.user.id;
  // Yalnızca kişisel not eklenmiş ya da puanlanmış aktivitelere yorum
  // yapılabilir — çıplak "izledi" logları kasıtlı olarak yorumlanamaz
  // (Worker aynı kuralı da doğruluyor, bkz. handleFeedComment).
  const canComment = isInteractive && (!!activity.note || activity.rating != null);

  const [isLiking, setIsLiking] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const handleToggleLike = async () => {
    if (!accessToken || isGuest || isLiking || !isInteractive) return;
    const nextLiked = !activity.isLikedByMe;
    const nextCount = Math.max(0, activity.likeCount + (nextLiked ? 1 : -1));
    useFeedStore.getState().patchActivity(activity.id, { isLikedByMe: nextLiked, likeCount: nextCount });
    setIsLiking(true);
    try {
      await setLike(accessToken, 'activity', activity.id, nextLiked);
    } catch (error) {
      console.warn('[Feed] Beğeni gönderilemedi:', error);
      // Başarısızsa gösterdiğimiz iyimser durumu geri al.
      useFeedStore.getState().patchActivity(activity.id, {
        isLikedByMe: activity.isLikedByMe,
        likeCount: activity.likeCount,
      });
    } finally {
      setIsLiking(false);
    }
  };

  const handleSaveNote = async (note: string, spoiler: boolean) => {
    // Oturum yoksa SESSİZCE dönmek "buton çalışmıyor" hissi veriyordu —
    // görünür bir sebep göster (bkz. docs/AI_RULES.md § Sessiz başarısızlık).
    if (!accessToken) {
      setNoteError(t('noteSaveAuthError', 'Oturumun bulunamadı, tekrar giriş yap.'));
      return;
    }
    setIsSavingNote(true);
    setNoteError(null);
    try {
      const saved = await setActivityNote(accessToken, activity.id, note || null, spoiler);
      // ⚠️ activityAt BİLİNÇLİ OLARAK patch'lenmiyor — kart akıştaki
      // kronolojik konumunda sabit kalmalı (bkz. Worker handleFeedNote'taki
      // aynı not). Yalnızca içerik güncellenir, "bump" edilmez.
      useFeedStore.getState().patchActivity(activity.id, {
        note: saved.note,
        noteSpoiler: saved.noteSpoiler,
      });
      setNoteModalVisible(false);
    } catch (error: any) {
      console.warn('[Feed] Not kaydedilemedi:', error);
      // ESKİDEN yalnızca konsola yazılıyordu: modal açık kalıyor ama kullanıcı
      // NEDEN kapanmadığını göremiyordu — "Kaydet çalışmıyor" izlenimi.
      setNoteError(
        error?.response?.data?.message || error?.message || t('noteSaveError', 'Alıntı kaydedilemedi, tekrar dene.')
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  // Paylaşım linki — TrackingCardMenu.tsx/OptionsModal.tsx/episode/[id].tsx
  // ile AYNI desen (Share.share + kaymaktv.com URL'i). Hedef `app/activity/
  // [id].tsx` — herkese açık, tek bu aktiviteyi gösteren kalıcı bağlantı.
  const handleShare = async () => {
    try {
      const url = `https://kaymaktv.com/activity/${activity.id}`;
      await Share.share({ message: `${t('shareActivityMsg')}\n${url}` });
    } catch (error) {
      console.log(error);
    }
  };

  const handlePressProfile = () => {
    // Takip durumu (followStore) HER ZAMAN Trakt'ın kanonik `slug`'ıyla
    // anahtarlanıyor — kullanıcı adıyla (username) yönlendirirse ve ikisi
    // farklıysa (ör. username'de büyük harf varsa), profile.web.tsx/
    // PublicProfileMobile.tsx'teki `useFollowState` bu slug'ı store'da
    // BULAMAZ ve zaten takip edilen biri için "Takip Et" gösterirdi.
    router.push(`/user/${activity.user.username}`);
  };

  // Dizi mi film mi — `mediaType` olmadan doğru rota bilinemez (ikisi de aynı
  // `showId` kolonunda taşınıyor). Bkz. utils/feedNavigation.ts
  //
  // `hasShow`: yalnızca 'posted' tipi yapımsız olabilir (bkz.
  // 017_feed_posts.sql) — o durumda gidilecek bir detay sayfası yok.
  const hasShow = activity.showId != null && activity.mediaType != null;
  const handlePressShow = () => {
    if (!hasShow) return;
    router.push(buildMediaHref({ showId: activity.showId!, mediaType: activity.mediaType!, tmdbId: activity.tmdbId }) as any);
  };

  // C1 · Dokunma haritası (AKIS_PLANI Faz C): kartın boş alanı → detay. İçteki
  // hedefler (avatar/ad → profil, yapım adı/poster → yapım, kalp, yorum, menü,
  // alıntı) kendi dokunuşunu yakalar: native'de iç yanıtlayıcı kazanır, web'de
  // react-native-web Pressable ve Text onPress `stopPropagation` yapar.
  // Bekleyen (isPending) kartın gerçek id'si yok → dokunulmaz.
  const canOpenDetail = openDetailOnPress && isInteractive;
  const handleOpenDetail = () => {
    if (canOpenDetail) router.push(`/activity/${activity.id}` as any);
  };

  const card = (
    <Pressable
      onPress={handleOpenDetail}
      disabled={!canOpenDetail}
      // `hovered` yalnız web'de gelir (react-native-web); native'de undefined.
      style={(state) => [
        styles.card,
        activity.isPending && styles.cardPending,
        canOpenDetail && (state as { hovered?: boolean }).hovered && styles.cardHover,
        canOpenDetail && state.pressed && styles.cardPressed,
      ]}
    >
      <TouchableOpacity activeOpacity={0.7} onPress={handlePressProfile}>
        <Avatar url={activity.user.avatarUrl} ad={activity.user.username} size={40} />
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity activeOpacity={0.7} onPress={handlePressProfile}>
              <Text style={styles.username}>{activity.user.username}</Text>
            </TouchableOpacity>
            <Icon size={14} color={meta.color} />
          </View>
          {/* Geçici/optimistic (isPending) kartlarda hiç render edilmez —
              henüz gerçek bir id'si yok, silinemez/paylaşılamaz. */}
          {isInteractive && (
            <CardMenu
              onEdit={isOwnActivity ? () => setNoteModalVisible(true) : undefined}
              onDelete={isOwnActivity && onDeleteActivity ? onDeleteActivity : undefined}
              onShare={handleShare}
              onReport={!isOwnActivity ? () => setReportModalVisible(true) : undefined}
              onBlock={
                !isOwnActivity && accessToken && !isGuest
                  ? () => blockUserQuick({ userId: activity.user.id })
                  : undefined
              }
            />
          )}
        </View>

        {/* Görsel hiyerarşi (kullanıcı geri bildirimi): alıntı VARSA o
            BİRİNCİL içerik olmalı — "X izledi" satırı ikincil bir bağlam
            satırına düşer (Twitter'ın Alıntı Tweet'i: senin yeni metnin
            büyük/üstte, alıntıladığın gönderi küçük/altta). Alıntı YOKSA
            eskisi gibi "X izledi" tek ve birincil satır. */}
        {activity.note ? (
          <>
            {/* Kişisel not/alıntı — Twitter'ın "Alıntı Yap" modeline yakın bir
                tasarım (bkz. docs/design/FEED_SOCIAL_PLAN.md §3.1 + kullanıcı
                revizyonu). Alıntı zaten varsa ayrı bir "Düzenle" butonu YOK,
                bloğun kendisi tıklanınca düzenleme açılır. Trakt'ın kendi
                yorum sistemiyle KARIŞMASIN diye tamamen ayrı bir bileşen. */}
            <FeedActivityNote
              note={activity.note}
              spoiler={!!activity.noteSpoiler}
              editable={isOwnActivity}
              onPressEdit={() => setNoteModalVisible(true)}
            />

            {/* Bağlam satırı — artık küçük/soluk bir "chip": hangi yapımdan/
                bölümden bahsedildiğini hâlâ söylüyor ama alıntının önüne
                geçmiyor. 'posted' tipinde yapım OPSİYONEL (bkz.
                017_feed_posts.sql) — seçilmediyse chip hiç render edilmez,
                ayrıca "bir gönderi paylaştı" gibi bir fiil eklenmez, yalnızca
                yapımın adı gösterilir (chip zaten "bununla ilgili" demek). */}
            {hasShow && (
              <TouchableOpacity
                style={styles.contextChip}
                onPress={handlePressShow}
                activeOpacity={0.7}
              >
                <Icon size={10} color={meta.color} />
                <Text style={styles.contextChipText} numberOfLines={1}>
                  {`${label.before}${activity.showTitle ?? ''}${label.after}`}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <Text style={styles.label} numberOfLines={2}>
              {label.before}
              <Text style={styles.showNameLink} onPress={handlePressShow}>
                {activity.showTitle}
              </Text>
              {label.after}
            </Text>
          </>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.timestamp}>{formatRelativeTime(activity.activityAt, t)}</Text>
          {/* Yayınlanıyor göstergesi: kart ekranda ama sunucu onayı henüz
              gelmedi. Onaylanınca kaybolur, hata olursa kart geri alınır. */}
          {activity.isPending && <ActivityIndicator size="small" color="#475569" />}
        </View>

        {/* Sosyal eylem satırı — sunucu onayı gelene kadar (isPending)
            gösterilmez, geçici bir id'ye like/comment atmak anlamsız. */}
        {isInteractive && (
          <View style={styles.socialRow}>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={handleToggleLike}
              activeOpacity={0.7}
              disabled={isLiking}
              hitSlop={6}
            >
              <Heart
                size={15}
                color={activity.isLikedByMe ? '#f87171' : '#64748b'}
                fill={activity.isLikedByMe ? '#f87171' : 'none'}
              />
              {activity.likeCount > 0 && <Text style={styles.socialCount}>{activity.likeCount}</Text>}
            </TouchableOpacity>

            {canComment && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => setCommentSheetVisible(true)}
                activeOpacity={0.7}
                hitSlop={6}
              >
                <MessageCircle size={15} color="#64748b" />
                {activity.commentCount > 0 && <Text style={styles.socialCount}>{activity.commentCount}</Text>}
              </TouchableOpacity>
            )}

            {/* Alıntı ekle — yalnızca kendi aktivitene ve henüz alıntın yokken
                (varsa düzenleme zaten notun kendisine tıklanınca açılıyor).
                Twitter'ın "retweet" ikonuna yakın, iki dönen ok — beğeni/
                yorumla BİREBİR aynı stil: salt gri ikon, etiket metni yok,
                vurgu rengi yok (önceki mor + "Alıntı" yazısı denemesi
                kullanıcı geri bildirimiyle geri alındı). */}
            {isOwnActivity && !activity.note && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => setNoteModalVisible(true)}
                activeOpacity={0.7}
                hitSlop={6}
              >
                <Repeat size={15} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Poster: bir sosyal akışın en güçlü görsel sinyali. ESKİDEN burada
          sabit gri bir film ikonu vardı — `show_poster_url` her zaman NULL
          yazılıyordu. Artık tmdb id'si saklanıyor (migration 013) ve poster
          uygulamanın var olan TMDB önbellekli bileşeniyle çiziliyor.
          `hasShow` yoksa (yapımsız 'posted' gönderisi) HİÇ render edilmez —
          boş bir gri kutu göstermek yerine metin tüm genişliği kullanır. */}
      {hasShow && (
        <TouchableOpacity activeOpacity={0.8} onPress={handlePressShow}>
          <MediaPoster
            tmdbId={activity.tmdbId}
            type={activity.mediaType}
            title={activity.showTitle}
            style={styles.poster}
            placeholderTextLines={2}
          />
        </TouchableOpacity>
      )}
    </Pressable>
  );

  // Modaller kartın DIŞINDA, koşulsuz render edilir (Akış sekmesi VEYA
  // Profil › Aktiviteler, ikisinde de aynı sosyal etkileşim çalışmalı).
  const modals = (
    <>
      {isOwnActivity && (
        <NoteEditorModal
          visible={noteModalVisible}
          initialNote={activity.note ?? ''}
          initialSpoiler={!!activity.noteSpoiler}
          saving={isSavingNote}
          error={noteError}
          onSave={handleSaveNote}
          onCancel={() => {
            setNoteError(null);
            setNoteModalVisible(false);
          }}
        />
      )}
      {canComment && (
        <FeedCommentSheet
          visible={commentSheetVisible}
          activityId={activity.id}
          onClose={() => setCommentSheetVisible(false)}
        />
      )}
      {!isOwnActivity && (
        <ReportContentModal
          visible={reportModalVisible}
          targetType="activity"
          targetId={activity.id}
          onClose={() => setReportModalVisible(false)}
        />
      )}
    </>
  );

  return (
    <>
      {card}
      {modals}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    // 'center' değil 'flex-start': sosyal satır/not eklenince body boyu
    // değişken hale geldi — avatar/poster her zaman üstte hizalı kalsın.
    alignItems: 'flex-start',
    backgroundColor: '#172033',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#22304A',
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  // Sunucu onayı beklenirken hafif soluk — "gönderiliyor" hissi.
  cardPending: {
    opacity: 0.65,
  },
  // C1 · Dokunulabilir kart geri bildirimi — web'de fare üstünde, her yerde basılıyken.
  cardHover: {
    borderColor: '#2E4166',
  },
  cardPressed: {
    backgroundColor: '#1A2540',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 14,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  showNameLink: {
    color: '#f1f5f9',
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  // Alıntı varken "X izledi" satırının küçülmüş hâli — Twitter'ın Alıntı
  // Tweet'indeki gömülü orijinal gönderi gibi, soluk ve ikincil.
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    maxWidth: '100%',
  },
  contextChipText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
  timestamp: {
    color: '#64748b',
    fontSize: 11,
  },
  poster: {
    width: 44,
    height: 62,
    borderRadius: 8,
    backgroundColor: '#0B1120',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialCount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
});

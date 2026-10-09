import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import Avatar from '../../../components/Avatar';
import { Heart, MessageCircle, Repeat } from '../../../components/icons';
import { useTranslation } from 'react-i18next';
import MediaPoster from '../../../components/MediaPoster';
import { FeedActivity } from '../types';
import { formatRelativeTime } from '../../../utils/formatRelativeTime';
import { activityLabel } from '../utils/activityLabel';
import { ACTIVITY_META } from '../utils/activityMeta';
import CardMenu from './CardMenu';
import FeedActivityNote from './FeedActivityNote';
import SystemActivitySheet from './detail/SystemActivitySheet';
import { useActivityActions } from '../hooks/useActivityActions';

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

export default function FeedCard({ activity, onDeleteActivity, openDetailOnPress = true }: FeedCardProps) {
  const { t } = useTranslation('feed');
  const meta = ACTIVITY_META[activity.activityType];
  const Icon = meta.icon;
  const label = activityLabel(activity, t);
  const actions = useActivityActions(activity);
  const { isInteractive, isOwnActivity, canComment, hasShow, isLiking } = actions;
  const handlePressProfile = actions.openProfile;
  const handlePressShow = actions.openMedia;
  // C2 · Sistem kartı («X izledi») tam ekran değil, yarım ekran pencere açar.
  const [systemSheetVisible, setSystemSheetVisible] = useState(false);

  // C1/C2 · Dokunma haritası (AKIS_PLANI Faz C): kartın boş alanı →
  // kullanıcının yayını ise tam ekran detay, sistem kaydıysa yarım pencere.
  // İçteki hedefler (avatar/ad, yapım adı/poster, kalp, yorum, menü, alıntı)
  // kendi dokunuşunu yakalar: native'de iç yanıtlayıcı kazanır, web'de
  // react-native-web Pressable ve Text onPress `stopPropagation` yapar.
  // Bekleyen (isPending) kartın gerçek id'si yok → dokunulmaz.
  const canOpenDetail = openDetailOnPress && isInteractive;
  const handleOpenDetail = () => {
    if (!canOpenDetail) return;
    if (actions.published) actions.openDetail();
    else setSystemSheetVisible(true);
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
              {...actions.menuProps}
              onDelete={isOwnActivity && onDeleteActivity ? onDeleteActivity : undefined}
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
              onPressEdit={actions.openNoteEditor}
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
              onPress={actions.toggleLike}
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
                // C2 · Yorum ikonu → detay sayfası, yorum kutusu odaklı.
                onPress={() => actions.openDetail(true)}
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
                onPress={actions.openNoteEditor}
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

  return (
    <>
      {card}
      {/* Modaller kartın DIŞINDA (Akış VE Profil › Aktiviteler aynı davranış). */}
      {actions.modals}
      {!actions.published && isInteractive && (
        <SystemActivitySheet
          visible={systemSheetVisible}
          activity={activity}
          actions={actions}
          onClose={() => setSystemSheetVisible(false)}
        />
      )}
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

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Eye, Play, CheckCircle2, Star, Clapperboard } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import MediaPoster from '../../../components/MediaPoster';
import { FeedActivity } from '../types';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import { formatRating } from '../../../utils/formatRating';
import { buildMediaHref } from '../utils/feedNavigation';
import ActivityDeleteRow from './ActivityDeleteRow';

interface FeedCardProps {
  activity: FeedActivity;
  /** Yalnızca Profil › Aktiviteler'de kullanılır — Akış (feed.tsx) sekmesinde
   *  hiçbiri geçilmez, bu yüzden `onDelete` yoksa kart eskisi gibi davranır. */
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onDelete?: () => void;
}

// Her aktivite tipi kendi ikonunu, vurgu rengini ve metin şablonunu taşır —
// yeni bir tip eklemek (Phase 2: 'commented' vb.) bu map'e bir satır eklemek
// kadar basit olacak şekilde tasarlandı.
//
// `labelSuffix` BİLİNÇLİ OLARAK yapım adını İÇERMEZ, yalnızca ONDAN SONRA
// gelen kısmı döndürür — yapım adı JSX'te ayrı, tıklanabilir bir <Text>
// olarak render edilir.
const ACTIVITY_META: Record<
  FeedActivity['activityType'],
  { icon: typeof Eye; color: string; labelSuffix: (a: FeedActivity) => string }
> = {
  watched_episode: {
    icon: Eye,
    color: '#38bdf8',
    labelSuffix: (a) => `${a.episodeNumber ?? ''} izledi`.trim(),
  },
  watched_movie: {
    icon: Clapperboard,
    color: '#f472b6',
    labelSuffix: () => 'filmini izledi',
  },
  started_show: {
    icon: Play,
    color: '#a78bfa',
    labelSuffix: () => 'izlemeye başladı',
  },
  completed_show: {
    icon: CheckCircle2,
    color: '#4ade80',
    labelSuffix: () => 'tamamladı',
  },
  rated: {
    // Puanlama hem dizi hem film olabilir — metin `mediaType`e göre değişir,
    // eskiden her puanlama için sabit "filmine" yazıyordu (diziler için yanlış).
    //
    // `formatRating` ŞART: Trakt'ın API'si puanı 1-10 skalada tutar ama bu
    // uygulamanın kendi arayüzü (StarSlider, 5 yıldız) kullanıcıya HER YERDE
    // 5 üzerinden gösterir (bkz. ShowCard/MediaHero — ikisi de aynı
    // yardımcıyı kullanır). ESKİ DAVRANIŞ burada ham `a.rating` ile "/10"
    // yazıyordu — kullanıcının 5 yıldız üzerinden verdiği bir puan akışta
    // "9/10" gibi görünüyordu, uygulamanın geri kalanıyla TUTARSIZDI.
    icon: Star,
    color: '#facc15',
    labelSuffix: (a) =>
      a.mediaType === 'movie'
        ? `filmine ${formatRating(a.rating)}/5 puan verdi`
        : `dizisine ${formatRating(a.rating)}/5 puan verdi`,
  },
};

export default function FeedCard({
  activity,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onDelete,
}: FeedCardProps) {
  const meta = ACTIVITY_META[activity.activityType];
  const Icon = meta.icon;
  const initial = activity.user.username.charAt(0).toUpperCase();
  const router = useRouter();

  const handlePressProfile = () => {
    // Takip durumu (followStore) HER ZAMAN Trakt'ın kanonik `slug`'ıyla
    // anahtarlanıyor — kullanıcı adıyla (username) yönlendirirse ve ikisi
    // farklıysa (ör. username'de büyük harf varsa), profile.web.tsx/
    // PublicProfileMobile.tsx'teki `useFollowState` bu slug'ı store'da
    // BULAMAZ ve zaten takip edilen biri için "Takip Et" gösterirdi.
    router.push(`/user/${activity.user.traktSlug || activity.user.username}`);
  };

  // Dizi mi film mi — `mediaType` olmadan doğru rota bilinemez (ikisi de aynı
  // `showId` kolonunda taşınıyor). Bkz. utils/feedNavigation.ts
  const handlePressShow = () => router.push(buildMediaHref(activity) as any);

  const card = (
    <View style={[styles.card, activity.isPending && styles.cardPending]}>
      <TouchableOpacity activeOpacity={0.7} onPress={handlePressProfile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <TouchableOpacity activeOpacity={0.7} onPress={handlePressProfile}>
            <Text style={styles.username}>{activity.user.username}</Text>
          </TouchableOpacity>
          <Icon size={14} color={meta.color} />
        </View>

        <Text style={styles.label} numberOfLines={2}>
          <Text style={styles.showNameLink} onPress={handlePressShow}>
            {activity.showTitle}
          </Text>
          {' '}
          {meta.labelSuffix(activity)}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.timestamp}>{formatRelativeTime(activity.activityAt)}</Text>
          {/* Yayınlanıyor göstergesi: kart ekranda ama sunucu onayı henüz
              gelmedi. Onaylanınca kaybolur, hata olursa kart geri alınır. */}
          {activity.isPending && <ActivityIndicator size="small" color="#475569" />}
        </View>
      </View>

      {/* Poster: bir sosyal akışın en güçlü görsel sinyali. ESKİDEN burada
          sabit gri bir film ikonu vardı — `show_poster_url` her zaman NULL
          yazılıyordu. Artık tmdb id'si saklanıyor (migration 013) ve poster
          uygulamanın var olan TMDB önbellekli bileşeniyle çiziliyor. */}
      <TouchableOpacity activeOpacity={0.8} onPress={handlePressShow}>
        <MediaPoster
          tmdbId={activity.tmdbId}
          type={activity.mediaType}
          title={activity.showTitle}
          style={styles.poster}
          placeholderTextLines={2}
        />
      </TouchableOpacity>
    </View>
  );

  if (!onDelete) return card;

  return (
    <ActivityDeleteRow
      isSelectionMode={isSelectionMode}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect ?? (() => {})}
      onDelete={onDelete}
    >
      {card}
    </ActivityDeleteRow>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 15,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
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
});

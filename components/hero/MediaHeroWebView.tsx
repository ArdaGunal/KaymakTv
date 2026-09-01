import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Home, MoreVertical, Play, Star, Heart, ListPlus, Bookmark } from '../icons';
import ProgressBar from '../ProgressBar';
import ExpandableText from '../ExpandableText';
import { formatRuntime } from '../../utils/formatters';
import { formatRating } from '../../utils/formatRating';
import { MediaFollowStatus } from '../../utils/followStatus';
import { webHeroStyles as s } from './mediaHeroWeb.styles';

interface MediaHeroWebViewProps {
  type: 'show' | 'movie';
  data: any;
  poster?: string | null;
  trailerId?: string | null;
  userRating?: number | null;
  isFavorited?: boolean;
  hasProgress: boolean;
  progressPercentage: number;
  progressColor: string;
  followStatus: MediaFollowStatus;
  onBack: () => void;
  onHome: () => void;
  onOptions: () => void;
  onOpenRating: () => void;
  onToggleFavorite: () => void;
  onOpenList: () => void;
  onToggleFollow: () => void;
}

/**
 * Dizi/film detayının MASAÜSTÜ WEB başlığı.
 *
 * ⚠️ Mobil hero'nun (components/MediaHero.tsx içindeki JSX) yerine GEÇMEZ —
 * yalnızca `useDetailLayout().isDesktopWeb` true iken render edilir. Bütün
 * iş mantığı (misafir kontrolü, takip kararı, modallar) hâlâ `MediaHero.tsx`'te;
 * bu dosya SALT SUNUM (AI_RULES §1 "UI & Logic Ayrımı").
 *
 * Kapak görseli burada YOK: masaüstünde onu `DetailWebLayout` sayfanın arka
 * planı olarak çiziyor, bu blok onun üstünde duruyor.
 */
export default function MediaHeroWebView({
  type,
  data,
  poster,
  trailerId,
  userRating,
  isFavorited,
  hasProgress,
  progressPercentage,
  progressColor,
  followStatus,
  onBack,
  onHome,
  onOptions,
  onOpenRating,
  onToggleFavorite,
  onOpenList,
  onToggleFollow,
}: MediaHeroWebViewProps) {
  const { t } = useTranslation(['media', 'common']);
  const hasUserRating = userRating !== undefined && userRating !== null;

  return (
    <View style={s.webHeroContainer}>
      {/* Arac cubugu — mobildeki yuzen dairelerin masaustu karsiligi.
          Ikonlar BILINCLI olarak solda toplandi: sag sutun ayri bir kolon
          oldugu icin sola yaslanmayan bir ikon, sayfanin ORTASINDA asili
          duruyormus gibi gorunuyordu (canli goruntuden duzeltildi). */}
      <View style={s.toolbar}>
        <TouchableOpacity style={s.ghostButton} onPress={onBack} activeOpacity={0.75}>
          <ChevronLeft color="#e2e8f0" size={18} />
          <Text style={s.ghostButtonText}>{t('common:back', 'Geri')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ghostIconButton} onPress={onHome} activeOpacity={0.75}>
          <Home color="#e2e8f0" size={18} />
        </TouchableOpacity>
        <TouchableOpacity style={s.ghostIconButton} onPress={onOptions} activeOpacity={0.75}>
          <MoreVertical color="#e2e8f0" size={18} />
        </TouchableOpacity>
      </View>

      <View style={s.headRow}>
        <Image
          source={poster ? { uri: poster } : undefined}
          style={s.poster}
          contentFit="cover"
          transition={300}
        />

        <View style={s.headText}>
          <Text style={s.title} numberOfLines={2}>{data?.title}</Text>

          <Text style={s.meta}>
            {data?.year}
            {type === 'show' && data?.network ? ` • ${data.network}` : ''}
            {type === 'movie' && data?.runtime ? ` • ${formatRuntime(data.runtime)}` : ''}
          </Text>

          {!!data?.genres?.length && (
            <Text style={s.genres} numberOfLines={1}>{data.genres.join(', ')}</Text>
          )}

          <View style={s.actionRow}>
            {/* Takip Et: satırın BİRİNCİ ve tek dolgulu öğesi — masaüstünde
                birincil eylemin hangisi olduğu bir bakışta anlaşılsın. */}
            <TouchableOpacity
              style={[s.followButton, followStatus.isFollowing && s.followButtonActive]}
              onPress={onToggleFollow}
              activeOpacity={0.85}
            >
              <Bookmark
                size={17}
                color={followStatus.isFollowing ? '#60a5fa' : '#ffffff'}
                fill={followStatus.isFollowing ? '#60a5fa' : 'transparent'}
              />
              <Text style={[s.followButtonText, followStatus.isFollowing && s.followButtonTextActive]}>
                {followStatus.isFollowing ? t('watchlistActive', 'Takip Ediliyor') : t('watchlistAction', 'Takip Et')}
              </Text>
            </TouchableOpacity>

            <View style={[s.pill, s.pillStatic, s.pillRating]}>
              <Star size={15} color="#facc15" fill="#facc15" />
              <Text style={[s.pillText, s.pillRatingText]}>{formatRating(data?.rating)}</Text>
            </View>

            <TouchableOpacity
              style={[s.pill, hasUserRating && s.pillActive]}
              onPress={onOpenRating}
              activeOpacity={0.75}
            >
              <Star
                size={15}
                color={hasUserRating ? '#60a5fa' : '#94a3b8'}
                fill={hasUserRating ? '#60a5fa' : 'transparent'}
              />
              <Text style={[s.pillText, hasUserRating && s.pillActiveText]}>
                {hasUserRating ? `${formatRating(userRating)}/5` : t('rate', 'Puanla')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.pill, s.pillIconOnly, isFavorited && s.pillFavActive]}
              onPress={onToggleFavorite}
              activeOpacity={0.75}
            >
              <Heart size={17} color={isFavorited ? '#ef4444' : '#94a3b8'} fill={isFavorited ? '#ef4444' : 'transparent'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.pill, s.pillIconOnly]}
              onPress={onOpenList}
              activeOpacity={0.75}
            >
              <ListPlus size={17} color="#94a3b8" />
            </TouchableOpacity>

          </View>

          {hasProgress && (
            <View style={s.progressRow}>
              <View style={s.progressBarWrapper}>
                <ProgressBar percentage={progressPercentage} fillColor={progressColor} height={6} />
              </View>
              <Text style={s.progressText}>%{Math.round(progressPercentage)}</Text>
            </View>
          )}

          {/* Ozet afisin ALTINDA degil YANINDA — bkz. stil dosyasindaki not. */}
          {!!data?.overview && <ExpandableText text={data.overview} style={s.overview} limit={250} />}
        </View>
      </View>

      {!!trailerId && trailerId !== 'null' && (
        <View style={s.trailerSection}>
          <Text style={s.sectionTitle}>{t('trailer')}</Text>
          <TouchableOpacity
            style={s.trailerCard}
            activeOpacity={0.85}
            onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${trailerId}`)}
          >
            <Image
              source={{ uri: `https://img.youtube.com/vi/${trailerId}/hqdefault.jpg` }}
              style={s.trailerImage}
              contentFit="cover"
              transition={200}
            />
            <View style={s.trailerOverlay}>
              <Play color="#fff" size={44} fill="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

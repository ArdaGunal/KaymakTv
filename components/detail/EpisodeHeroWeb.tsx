import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Share2, Star, Check } from '../icons';
import ProgressBar from '../ProgressBar';
import { formatRating } from '../../utils/formatRating';
import { webHeroStyles as s } from '../hero/mediaHeroWeb.styles';

interface EpisodeHeroWebProps {
  showName: string;
  title: string;
  season: number;
  episode: number;
  firstAired: string;
  stillUrl?: string | null;
  rating: string;
  votes: number;
  myRating?: number | null;
  isWatched: boolean;
  isCheckLoading: boolean;
  /** `null` → yayınlanmamış/TBA: "İzledim" yerine bilgi rozeti gösterilir. */
  airStatus: 'aired' | 'unaired' | 'tba';
  hasShowProgress: boolean;
  showProgressPercentage: number;
  showProgressColor: string;
  onBack: () => void;
  onShare: () => void;
  onShowPress: () => void;
  onOpenRating: () => void;
  onToggleWatched: () => void;
}

/**
 * Bölüm detayının MASAÜSTÜ WEB başlığı.
 *
 * Mobil başlık (`app/episode/[id].tsx` içindeki JSX) DEĞİŞTİRİLMEDİ; bu blok
 * yalnızca `useDetailLayout().isDesktopWeb` iken render edilir.
 *
 * Kritik fark: mobilde bölüm karesi 350px sabit yükseklikte, TAM GENİŞLİKTE
 * bir arka plandı — masaüstünde bu 1440x350'lik bir şeride kırpılıyor, yani
 * görselin büyük kısmı kesiliyordu. Burada `aspectRatio: 16/9` ile gerçek
 * oranında, sol sütunun genişliğine göre çiziliyor.
 */
export default function EpisodeHeroWeb({
  showName,
  title,
  season,
  episode,
  firstAired,
  stillUrl,
  rating,
  votes,
  myRating,
  isWatched,
  isCheckLoading,
  airStatus,
  hasShowProgress,
  showProgressPercentage,
  showProgressColor,
  onBack,
  onShare,
  onShowPress,
  onOpenRating,
  onToggleWatched,
}: EpisodeHeroWebProps) {
  const { t } = useTranslation(['media', 'common']);
  const hasMyRating = myRating !== undefined && myRating !== null;

  return (
    <View>
      <View style={s.toolbar}>
        <TouchableOpacity style={s.ghostButton} onPress={onBack} activeOpacity={0.75}>
          <ChevronLeft color="#e2e8f0" size={18} />
          <Text style={s.ghostButtonText}>{t('common:back', 'Geri')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ghostIconButton} onPress={onShare} activeOpacity={0.75}>
          <Share2 color="#e2e8f0" size={18} />
        </TouchableOpacity>
      </View>

      {/* Bölüm karesi — 16:9, kırpılmadan. */}
      <View style={local.still}>
        {stillUrl ? (
          <Image source={{ uri: stillUrl }} style={local.stillImage} contentFit="cover" transition={300} />
        ) : (
          <View style={local.stillPlaceholder} />
        )}
      </View>

      {/* Dizi adı: sade, tıklanabilir breadcrumb. */}
      <TouchableOpacity onPress={onShowPress} activeOpacity={0.6} style={local.breadcrumb}>
        <Text style={local.breadcrumbText} numberOfLines={1}>{showName}</Text>
        <ChevronRight size={12} color="rgba(148,163,184,0.8)" strokeWidth={2.5} />
      </TouchableOpacity>

      <Text style={local.title}>{title}</Text>
      <Text style={local.identifier}>
        {t('seasonEpisodeIdentifier', { season, episode })} • {firstAired}
      </Text>

      <View style={[s.actionRow, local.actions]}>
        <View style={[s.pill, s.pillStatic, s.pillRating]}>
          <Star size={15} color="#facc15" fill="#facc15" />
          <Text style={[s.pillText, s.pillRatingText]}>{rating}</Text>
          {votes > 0 && (
            <Text style={local.votes}>({votes.toLocaleString('tr-TR')})</Text>
          )}
        </View>

        <TouchableOpacity
          style={[s.pill, hasMyRating && s.pillActive]}
          onPress={onOpenRating}
          activeOpacity={0.75}
        >
          <Star size={15} color={hasMyRating ? '#60a5fa' : '#94a3b8'} fill={hasMyRating ? '#60a5fa' : 'transparent'} />
          <Text style={[s.pillText, hasMyRating && s.pillActiveText]}>
            {hasMyRating ? `${formatRating(myRating)}/5` : t('rate', 'Puanla')}
          </Text>
        </TouchableOpacity>

        {airStatus !== 'aired' ? (
          <View style={[s.pill, s.pillStatic, local.pillUnaired]}>
            <Text style={local.pillUnairedText}>
              {airStatus === 'tba' ? 'TBA' : t('notAiredYet', { defaultValue: 'Yayınlanmadı' })}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.pill, isWatched && local.pillWatched]}
            onPress={onToggleWatched}
            disabled={isCheckLoading}
            activeOpacity={0.75}
          >
            {isCheckLoading ? (
              <ActivityIndicator size="small" color={isWatched ? '#10b981' : '#94a3b8'} />
            ) : (
              <>
                <Check size={15} color={isWatched ? '#10b981' : '#94a3b8'} strokeWidth={3} />
                <Text style={[s.pillText, isWatched && local.pillWatchedText]}>
                  {isWatched ? t('watched') : t('markAsWatched')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {hasShowProgress && (
        <View style={s.progressRow}>
          <View style={s.progressBarWrapper}>
            <ProgressBar percentage={showProgressPercentage} fillColor={showProgressColor} height={6} />
          </View>
          <Text style={s.progressText}>%{Math.round(showProgressPercentage)}</Text>
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  still: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stillImage: { width: '100%', height: '100%' },
  stillPlaceholder: { width: '100%', height: '100%', backgroundColor: '#172033' },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 26,
    marginBottom: 8,
    cursor: 'pointer',
  } as any,
  breadcrumbText: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  identifier: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 20,
  },
  actions: { marginBottom: 4 },
  votes: {
    color: 'rgba(250,204,21,0.65)',
    fontSize: 12,
    fontWeight: '600',
  },
  pillUnaired: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.20)',
  },
  pillUnairedText: { color: '#10b981', fontSize: 13, fontWeight: '700' },
  pillWatched: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.32)',
  },
  pillWatchedText: { color: '#10b981', fontWeight: '700' },
});

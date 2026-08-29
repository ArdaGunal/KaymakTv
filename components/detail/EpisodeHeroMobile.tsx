import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Star, Check, Share2 } from '../icons';
import ProgressBar from '../ProgressBar';
import { formatRating } from '../../utils/formatRating';
import { styles } from './episodeDetail.styles';

interface EpisodeHeroMobileProps {
  stillUrl?: string | null;
  showName: string;
  title: string;
  season: number;
  episode: number;
  firstAired: string;
  rating: string;
  votes: string;
  episodeData: any;
  myRating?: number | null;
  isWatchedLocal: boolean;
  isCheckLoading: boolean;
  hasShowProgress: boolean;
  showProgressPercentage: number;
  showProgressColor: string;
  handleBack: () => void;
  handleShare: () => void;
  handleShowPress: () => void;
  openRating: () => void;
  onToggleWatched: () => void;
}

/**
 * Bolum detayinin MOBIL basligi.
 *
 * AI_RULES §1 (400 satir siniri) geregi `app/episode/[id].tsx`'ten BIREBIR
 * tasindi — JSX metnine hicbir sey eklenmedi/cikarilmadi, yalnizca disaridan
 * gelen degerler prop oldu. Masaustu web karsiligi: EpisodeHeroWeb.tsx.
 */
export default function EpisodeHeroMobile({
  stillUrl,
  showName,
  title,
  season,
  episode,
  firstAired,
  rating,
  votes,
  episodeData,
  myRating,
  isWatchedLocal,
  isCheckLoading,
  hasShowProgress,
  showProgressPercentage,
  showProgressColor,
  handleBack,
  handleShare,
  handleShowPress,
  openRating,
  onToggleWatched,
}: EpisodeHeroMobileProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('media');

  return (
    <>
    {/* Header Section */}
    <View style={styles.headerContainer}>
      {stillUrl ? (
        <Image source={{ uri: stillUrl }} style={styles.stillImage} contentFit="cover" transition={300} />
      ) : (
        <View style={styles.stillPlaceholder} />
      )}
      
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'transparent', '#0a0a0a']}
        style={styles.gradientOverlay}
      />

      {/* Güvenli alan (safe area) DİNAMİK olmalı: `styles.backButton`/
          `styles.shareButton` eskiden `top: 50` ile SABİT kodlanmıştı ve
          bu ekranda çağrılan `useSafeAreaInsets()` sonucu hiç
          kullanılmıyordu. Sonuç: çentiği/durum çubuğu yüksekliği farklı
          cihazlarda (küçük ekranlı Android, katlanabilir, Dynamic Island)
          butonlar ya durum çubuğunun altına giriyor ya da gereksiz aşağıda
          kalıyordu. Artık `MediaHero.tsx`'teki mevcut desenin AYNISI
          kullanılıyor (`insets.top + 10`, yatayda da insets'e saygılı). */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 10, left: insets.left + 16 }]}
        onPress={handleBack}
      >
        <ChevronLeft color="#fff" size={24} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.shareButton, { top: insets.top + 10, right: insets.right + 16 }]}
        onPress={handleShare}
      >
        <Share2 color="#fff" size={24} />
      </TouchableOpacity>

      <View style={styles.headerContent}>
        {/* Dizi adı: küçük, sade bir üst başlık (breadcrumb) — göze batmadan tıklanabilir */}
        <TouchableOpacity
          onPress={handleShowPress}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 0, right: 8 }}
          style={styles.showNameRow}
        >
          <Text style={styles.showName} numberOfLines={1}>{showName}</Text>
          <ChevronRight size={11} color="rgba(148,163,184,0.7)" strokeWidth={2.5} />
        </TouchableOpacity>

        <Text style={styles.episodeTitle}>{title}</Text>
        <Text style={styles.episodeIdentifier}>
          {t('seasonEpisodeIdentifier', { season: season, episode: episode })} • {firstAired}
        </Text>

        <View style={styles.ratingsRow}>
          {/* Global Trakt puanı + oy sayısı. `votes` zaten hesaplanıyordu
              ama HİÇBİR yerde basılmıyordu (repo genelinde `.votes`'un tek
              kullanımı buydu) — puanın kaç oya dayandığı bilgisi bir
              refaktörde arayüzden düşmüş. Oy sayısı yalnızca gerçekten
              varsa gösterilir: 0 oylu (yeni/niş) bölümlerde "(0)" basmak
              puanı gereksiz yere şüpheli gösterirdi. */}
          <View style={styles.ratingBadge}>
            <Star size={14} color="#facc15" fill="#facc15" />
            <Text style={styles.ratingText}>
              {rating}
            </Text>
            {episodeData?.votes > 0 && (
              <Text style={styles.votesText}>({votes})</Text>
            )}
          </View>

          {/* User Rating Badge (Puanla) */}
          <TouchableOpacity 
            style={[styles.userRatingBadge, (myRating !== undefined && myRating !== null) ? styles.userRatingActive : null]} 
            onPress={openRating}
            activeOpacity={0.7}
          >
            <Star size={14} color={(myRating !== undefined && myRating !== null) ? "#3b82f6" : "#a3a3a3"} fill={(myRating !== undefined && myRating !== null) ? "#3b82f6" : "transparent"} />
            <Text style={[styles.userRatingText, (myRating !== undefined && myRating !== null) ? styles.userRatingTextActive : null]}>
              {(myRating !== undefined && myRating !== null) ? `${formatRating(myRating)}/5` : t('rate', { defaultValue: 'Puanla' })}
            </Text>
          </TouchableOpacity>

          {/* Check (Watched/Unwatched) Badge */}
          {(() => {
            // `isWatchedLocal` prop olarak geliyor (bkz. bilesen imzasi).
            const isFutureOrTBA = !episodeData?.first_aired || new Date(episodeData.first_aired) > new Date();
            
            if (isFutureOrTBA) {
              return (
                <View style={[styles.userRatingBadge, { backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 13 }}>
                    {!episodeData?.first_aired ? 'TBA' : t('notAiredYet', { defaultValue: 'Yayınlanmadı' })}
                  </Text>
                </View>
              );
            }
            const isAired = episodeData?.first_aired ? new Date(episodeData.first_aired) <= new Date() : true;
            if (!isAired) return null;

            return (
              <TouchableOpacity 
                style={[styles.userRatingBadge, isWatchedLocal && { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]} 
                onPress={onToggleWatched}
                disabled={isCheckLoading}
              >
                {isCheckLoading ? (
                  <ActivityIndicator size="small" color={isWatchedLocal ? "#10b981" : "#a3a3a3"} />
                ) : (
                  <>
                    <Check size={14} color={isWatchedLocal ? "#10b981" : "#a3a3a3"} strokeWidth={3} />
                    <Text style={[styles.userRatingText, isWatchedLocal ? { color: '#10b981' } : null]}>
                      {isWatchedLocal ? t('watched') : t('markAsWatched')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })()}
        </View>

        {hasShowProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarWrapper}>
              <ProgressBar percentage={showProgressPercentage} fillColor={showProgressColor} />
            </View>
            <Text style={styles.progressText}>%{Math.round(showProgressPercentage)}</Text>
          </View>
        )}
      </View>
    </View>
    </>
  );
}

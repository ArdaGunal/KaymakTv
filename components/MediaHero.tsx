import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Image } from 'expo-image';
import { ChevronLeft, Play, Star, Home, MoreVertical, Heart, ListPlus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { BlurView } from 'expo-blur';
import RatingModal from './modals/RatingModal';
import OptionsModal from './modals/OptionsModal';
import { formatRuntime } from '../utils/formatters';
import { generateMediaSlug } from '../utils/slugHelper';
import AddToListModal from './AddToListModal';
import ProgressBar from './ProgressBar';
import { useLibrary } from '../context/LibraryContext';
import { getProgressBarColor } from '../utils/progressBarColor';

interface MediaHeroProps {
  type: 'show' | 'movie';
  data: any;
  backdrop: string | null;
  poster: string | null;
  trailerId: string | null;
  userRating: number | null;
  isWatchlisted?: boolean;
  isFavorited?: boolean;
  isWatched?: boolean;
  onRate: (rating: number) => void;
  onRemoveRating: () => void;
  onToggleWatchlist: () => void;
  onToggleFavorite?: () => void;
  onHideFromProgress?: () => void;
  onDeleteFromHistory?: () => void;
  onRewatch?: () => void;
  /** Yalnızca dizilerde: takip modülündeki manuel "Bırakıldı" işaretlemesi. */
  isDropped?: boolean;
  onToggleDropped?: () => void;
}

export default function MediaHero({
  type,
  data,
  backdrop,
  poster,
  trailerId,
  userRating,
  isWatchlisted,
  isFavorited,
  isWatched,
  onRate,
  onRemoveRating,
  onToggleWatchlist,
  onToggleFavorite,
  onHideFromProgress,
  onDeleteFromHistory,
  onRewatch,
  isDropped,
  onToggleDropped,
}: MediaHeroProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['media', 'common']);
  const { isGuest } = useAuth();
  const { showProgressMap } = useLibrary();
  const { isDesktop } = useResponsive();
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [listModalVisible, setListModalVisible] = useState(false);

  const progress = type === 'show' && data?.ids?.trakt ? showProgressMap[data.ids.trakt] : null;
  const hasProgress = progress && progress.aired > 0 && progress.completed > 0;
  const progressPercentage = hasProgress ? (progress.completed / progress.aired) * 100 : 0;
  const isFinished = !!hasProgress && progress.completed >= progress.aired;
  const progressColor = getProgressBarColor(!!isDropped, isFinished);


  const handleRate = (r: number) => {
    onRate(r);
    setRatingModalVisible(false);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleRemove = () => {
    onRemoveRating();
    setRatingModalVisible(false);
  };

  const handleToggleFavorite = () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      setOptionsModalVisible(false);
      return;
    }
    if (onToggleFavorite) {
      onToggleFavorite();
    }
    setOptionsModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* BACKDROP */}
      <View style={styles.backdropContainer}>
        {backdrop ? (
          <Image source={{ uri: backdrop }} style={styles.backdropImage} contentFit="cover" transition={300} />
        ) : (
          <View style={styles.backdropPlaceholder} />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(11,17,32,0.8)', '#0B1120']}
          style={styles.gradientOverlay}
        />
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 10, left: insets.left + 20 }]}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft color="#fff" size={32} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.homeButton, { top: insets.top + 10, right: insets.right + 64 }]}
          onPress={() => router.dismissAll()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Home color="#fff" size={24} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.optionsButton, { top: insets.top + 10, right: insets.right + 16 }]}
          onPress={() => setOptionsModalVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MoreVertical color="#fff" size={24} />
        </TouchableOpacity>
      </View>

      {/* FOREGROUND CONTENT */}
      <View style={[styles.contentContainer, { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }]}>
        {poster ? (
          <Image source={{ uri: poster }} style={styles.posterImage} contentFit="cover" transition={300} />
        ) : (
          <View style={styles.posterPlaceholder} />
        )}
        
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>{data.title}</Text>
          
          <Text style={styles.meta}>
            {data.year} 
            {type === 'show' && data.network ? ` • ${data.network}` : ''}
            {type === 'movie' && data.runtime ? ` • ${formatRuntime(data.runtime)}` : ''}
          </Text>

          <Text style={styles.genres} numberOfLines={1}>
            {data.genres?.join(', ')}
          </Text>

          {/* RATINGS ROW */}
          <View style={styles.ratingsRow}>
            {/* Global Trakt Rating */}
            <View style={styles.ratingBadge}>
              <Star size={14} color="#facc15" fill="#facc15" />
              <Text style={styles.ratingText}>
                {data.rating ? (data.rating / 2).toFixed(1) : '-'}
              </Text>
            </View>

            {/* User Rating (Delicate Button) */}
            <TouchableOpacity
              style={[styles.userRatingBadge, (userRating !== undefined && userRating !== null) ? styles.userRatingActive : null]}
              onPress={() => {
                if (isGuest) {
                  Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
                  return;
                }
                setRatingModalVisible(true)
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Star size={14} color={(userRating !== undefined && userRating !== null) ? "#3b82f6" : "#a3a3a3"} fill={(userRating !== undefined && userRating !== null) ? "#3b82f6" : "transparent"} />
              <Text style={[styles.userRatingText, (userRating !== undefined && userRating !== null) ? styles.userRatingTextActive : null]}>
                {(userRating !== undefined && userRating !== null) ? `${(userRating / 2).toFixed(1)}/5` : t('rate')}
              </Text>
            </TouchableOpacity>

            {/* Quick Favorite Button */}
            <TouchableOpacity
              style={[
                styles.userRatingBadge,
                styles.iconOnlyBadge,
                isFavorited ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' } : null
              ]}
              activeOpacity={0.7}
              onPress={handleToggleFavorite}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Heart size={16} color={isFavorited ? "#ef4444" : "#a3a3a3"} fill={isFavorited ? "#ef4444" : "transparent"} />
            </TouchableOpacity>

            {/* Add to List Button — hem mobil hem web'de TEK dokunuşla liste
                modalını açar. (Eskiden mobilde dokunmak izleme listesine ekliyor,
                liste için basılı tutmak gerekiyordu — kafa karıştırıcıydı.
                İzleme listesi hâlâ "..." menüsünden erişilebilir.) */}
            <TouchableOpacity
              style={[styles.userRatingBadge, styles.iconOnlyBadge]}
              activeOpacity={0.7}
              onPress={() => {
                if (isGuest) {
                  Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
                  return;
                }
                setListModalVisible(true);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ListPlus size={16} color="#a3a3a3" />
            </TouchableOpacity>
          </View>
          
          {hasProgress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarWrapper}>
                <ProgressBar percentage={progressPercentage} fillColor={progressColor} />
              </View>
              <Text style={styles.progressText}>%{Math.round(progressPercentage)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* OVERVIEW */}
      {data.overview && (
        <View style={styles.overviewSection}>
          <Text style={styles.overviewText}>{data.overview}</Text>
        </View>
      )}

      {/* TRAILER */}
      {trailerId && trailerId !== 'null' && (
        <View style={styles.trailerSection}>
          <Text style={styles.sectionTitle}>{t('trailer')}</Text>
          <TouchableOpacity 
            style={styles.trailerContainer}
            activeOpacity={0.8}
            onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${trailerId}`)}
          >
            <Image 
              source={{ uri: `https://img.youtube.com/vi/${trailerId}/hqdefault.jpg` }} 
              style={styles.trailerImage}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.trailerOverlay}>
              <Play color="#fff" size={40} fill="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* RATING MODAL */}
      <RatingModal
        visible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        userRating={userRating}
        onRate={handleRate}
        onRemoveRating={handleRemove}
      />

      {/* OPTIONS MODAL */}
      <OptionsModal
        visible={optionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
        type={type}
        data={data}
        isWatchlisted={isWatchlisted}
        isWatched={isWatched}
        onToggleWatchlist={onToggleWatchlist}
        onHideFromProgress={onHideFromProgress}
        onDeleteFromHistory={onDeleteFromHistory}
        onRewatch={onRewatch}
        isDropped={isDropped}
        onToggleDropped={onToggleDropped}
      />

      <AddToListModal
        visible={listModalVisible}
        onClose={() => setListModalVisible(false)}
        mediaId={data?.ids?.trakt}
        mediaType={type}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0B1120',
  },
  backdropContainer: {
    height: 280,
    width: '100%',
    position: 'relative',
  },
  backdropImage: {
    width: '100%',
    height: '100%',
  },
  backdropPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#172033',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButton: {
    position: 'absolute',
    right: 64,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsButton: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flexDirection: 'row',
    marginTop: -80,
    zIndex: 5,
  },
  progressContainer: {
    marginTop: 16,
    width: '100%',
    maxWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarWrapper: {
    flex: 1,
  },
  progressText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  posterImage: {
    width: 110,
    height: 165,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A364F',
  },
  posterPlaceholder: {
    width: 110,
    height: 165,
    borderRadius: 8,
    backgroundColor: '#172033',
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: '#a3a3a3',
    marginBottom: 4,
  },
  genres: {
    fontSize: 13,
    color: '#a3a3a3',
    marginBottom: 12,
  },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 10,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.2)',
  },
  ratingText: {
    color: '#facc15',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
  userRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(163, 163, 163, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(163, 163, 163, 0.2)',
  },
  // Sadece ikon barındıran rozetler: metin olmadığı için dokunma alanı
  // önerilen 44pt'nin çok altında kalıyordu — biraz genişletildi.
  iconOnlyBadge: {
    minWidth: 32,
    justifyContent: 'center',
  },
  userRatingActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  userRatingText: {
    color: '#a3a3a3',
    fontWeight: '500',
    fontSize: 13,
    marginLeft: 4,
  },
  userRatingTextActive: {
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  overviewSection: {
    padding: 16,
    marginTop: 8,
  },
  overviewText: {
    color: '#d4d4d4',
    fontSize: 14,
    lineHeight: 22,
  },
  trailerSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  trailerContainer: {
    height: 180,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  trailerImage: {
    width: '100%',
    height: '100%',
  },
  trailerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

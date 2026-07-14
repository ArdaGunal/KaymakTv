import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Modal, Pressable, Share, Alert } from 'react-native';
import { Image } from 'expo-image';
import { ChevronLeft, Play, Star, ChevronDown, Home, MoreVertical, Bookmark, EyeOff, Trash2, Share2, CheckCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import StarSlider from './StarSlider';
import { useTranslation } from 'react-i18next';

interface MediaHeroProps {
  type: 'show' | 'movie';
  data: any;
  backdrop: string | null;
  poster: string | null;
  trailerId: string | null;
  userRating: number | null;
  isWatchlisted?: boolean;
  isWatched?: boolean;
  onRate: (rating: number) => void;
  onRemoveRating: () => void;
  onToggleWatchlist: () => void;
  onHideFromProgress?: () => void;
  onDeleteFromHistory?: () => void;
  onRewatch?: () => void;
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MediaHero({
  type,
  data,
  backdrop,
  poster,
  trailerId,
  userRating,
  isWatchlisted,
  isWatched,
  onRate,
  onRemoveRating,
  onToggleWatchlist,
  onHideFromProgress,
  onDeleteFromHistory,
  onRewatch,
}: MediaHeroProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['media', 'common']);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  const formatRuntime = (minutes: number) => {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleRate = (r: number) => {
    onRate(r);
    setRatingModalVisible(false);
  };

  const handleRemove = () => {
    onRemoveRating();
    setRatingModalVisible(false);
  };

  const handleShare = async () => {
    try {
      const url = type === 'show' ? `https://trakt.tv/shows/${data.ids.trakt}` : `https://trakt.tv/movies/${data.ids.trakt}`;
      await Share.share({
        message: `${data.title} ${type === 'show' ? t('shareShowMsg') : t('shareMovieMsg')}\n${url}`,
      });
      setOptionsModalVisible(false);
    } catch (error) {
      console.log(error);
    }
  };

  const handleToggleWatchlist = () => {
    onToggleWatchlist();
    setOptionsModalVisible(false);
  };

  const handleHideProgress = () => {
    if (onHideFromProgress) {
      onHideFromProgress();
    }
    setOptionsModalVisible(false);
  };

  const handleDeleteHistory = () => {
    if (!onDeleteFromHistory) return;
    Alert.alert(
      t('areYouSure'),
      t('historyDeleteConfirm'),
      [
        { text: t('common:cancel'), style: "cancel" },
        { 
          text: t('yesDelete'), 
          style: "destructive", 
          onPress: () => {
            onDeleteFromHistory();
            setOptionsModalVisible(false);
            router.back();
          } 
        }
      ]
    );
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
        <TouchableOpacity style={[styles.backButton, { top: insets.top + 10 }]} onPress={() => router.back()}>
          <ChevronLeft color="#fff" size={32} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.homeButton, { top: insets.top + 10 }]} onPress={() => router.dismissAll()}>
          <Home color="#fff" size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.optionsButton, { top: insets.top + 10 }]} onPress={() => setOptionsModalVisible(true)}>
          <MoreVertical color="#fff" size={24} />
        </TouchableOpacity>
      </View>

      {/* FOREGROUND CONTENT */}
      <View style={styles.contentContainer}>
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
                {data.rating ? data.rating.toFixed(1) : '-'}
              </Text>
            </View>

            {/* User Rating (Delicate Button) */}
            <TouchableOpacity 
              style={[styles.userRatingBadge, userRating ? styles.userRatingActive : null]} 
              activeOpacity={0.7}
              onPress={() => setRatingModalVisible(true)}
            >
              <Star size={14} color={userRating ? "#3b82f6" : "#a3a3a3"} fill={userRating ? "#3b82f6" : "transparent"} />
              <Text style={[styles.userRatingText, userRating ? styles.userRatingTextActive : null]}>
                {userRating ? `${userRating}/10` : t('rate')}
              </Text>
            </TouchableOpacity>
          </View>
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
      <Modal visible={ratingModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setRatingModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('giveRating')}</Text>
            <StarSlider 
              initialRating={userRating} 
              onRate={(val) => { 
                handleRate(val); 
                setRatingModalVisible(false); 
              }} 
              onRemove={userRating ? () => { 
                handleRemove(); 
                setRatingModalVisible(false); 
              } : undefined}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* OPTIONS MODAL */}
      <Modal visible={optionsModalVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setOptionsModalVisible(false)}>
          <View style={styles.modalContent}>
            
            <TouchableOpacity style={styles.optionRow} onPress={handleToggleWatchlist}>
              <Bookmark color={isWatchlisted ? "#3b82f6" : "#fff"} size={24} fill={isWatchlisted ? "#3b82f6" : "transparent"} />
              <Text style={styles.optionText}>
                {isWatchlisted ? t('removeFromWatchlist') : t('addToWatchlist')}
              </Text>
            </TouchableOpacity>

            {type === 'show' && onHideFromProgress && (
              <TouchableOpacity style={styles.optionRow} onPress={handleHideProgress}>
                <EyeOff color="#fff" size={24} />
                <Text style={styles.optionText}>{t('hideProgress')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.optionRow} onPress={handleShare}>
              <Share2 color="#fff" size={24} />
              <Text style={styles.optionText}>{t('share')}</Text>
            </TouchableOpacity>

            {type === 'movie' && isWatched && onRewatch && (
              <TouchableOpacity style={styles.optionRow} onPress={() => {
                onRewatch();
                setOptionsModalVisible(false);
              }}>
                <CheckCheck color="#10b981" size={24} />
                <Text style={[styles.optionText, {color: '#10b981'}]}>{t('rewatch')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.optionRow, styles.destructiveRow]} onPress={handleDeleteHistory}>
              <Trash2 color="#ef4444" size={24} />
              <View>
                <Text style={styles.destructiveText}>{t('removeHistory')}</Text>
                <Text style={{color: '#737373', fontSize: 11, marginTop: 2}}>{t('removeHistorySub')}</Text>
              </View>
            </TouchableOpacity>

          </View>
        </Pressable>
      </Modal>
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
    paddingHorizontal: 16,
    marginTop: -80,
    zIndex: 5,
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
    gap: 12,
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
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(163, 163, 163, 0.2)',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#172033',
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  starButton: {
    alignItems: 'center',
    padding: 8,
  },
  starNumber: {
    color: '#a3a3a3',
    fontSize: 12,
    marginTop: 4,
  },
  removeRatingButton: {
    padding: 12,
    alignItems: 'center',
  },
  removeRatingText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A364F',
  },
  optionText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
  },
  destructiveRow: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  destructiveText: {
    color: '#ef4444',
    fontSize: 16,
    marginLeft: 16,
    fontWeight: 'bold',
  },
});

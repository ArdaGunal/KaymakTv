import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { Image } from 'expo-image';
import { ChevronLeft, Play, Star, Home, MoreVertical, Heart, ListPlus, Bookmark } from './icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import RatingModal from './modals/RatingModal';
import OptionsModal from './modals/OptionsModal';
import { formatRuntime } from '../utils/formatters';
import { formatRating } from '../utils/formatRating';
import AddToListModal from './AddToListModal';
import ProgressBar from './ProgressBar';
import { useLibrary } from '../context/LibraryContext';
import { getProgressBarColor } from '../utils/progressBarColor';
import { useAppBack, useAppHome } from '../hooks/useAppBack';
import { useDetailLayout } from '../hooks/useDetailLayout';
import MediaHeroWebView from './hero/MediaHeroWebView';
import { deriveFollowStatus, resolveFollowAction } from '../utils/followStatus';
import { styles } from './MediaHero.styles';
import ExpandableText from './ExpandableText';

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
  /** Yapımı izleme listesine ekler/çıkarır. Takip butonu bunu YALNIZCA
   *  `resolveFollowAction` "addToWatchlist"/"removeFromWatchlist" dediğinde
   *  çağırır — izleme geçmişi olan yapımlarda doğru karşılık `Bırak`tır
   *  (bkz. utils/followStatus.ts). */
  onToggleWatchlist: () => void;
  onToggleFavorite?: () => void;
  /** "Bırak" eylemi — Trakt'ta "İlerlemeyi Gizle/Göster", `isHidden` durumuna
   * göre iki yöne de çalışan bir toggle. Diziler için `hiddenShowIds`, filmler
   * için `hiddenMovieIds` üzerinden gelir — ilgili ekran hangisini besleyeceğini
   * bilir. */
  isHidden?: boolean;
  onHideFromProgress?: () => void;
  onDeleteFromHistory?: () => void;
  onRewatch?: () => void;
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
  isHidden,
  onHideFromProgress,
  onDeleteFromHistory,
  onRewatch,
}: MediaHeroProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['media', 'common']);
  const { isGuest } = useAuth();
  const { showProgressMap } = useLibrary();
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [listModalVisible, setListModalVisible] = useState(false);

  const progress = type === 'show' && data?.ids?.trakt ? showProgressMap[data.ids.trakt] : null;
  const hasProgress = progress && progress.aired > 0 && progress.completed > 0;
  const progressPercentage = hasProgress ? (progress.completed / progress.aired) * 100 : 0;
  const isFinished = !!hasProgress && progress.completed >= progress.aired;
  const progressColor = getProgressBarColor(!!isHidden, isFinished);


  const handleRate = (r: number) => {
    onRate(r);
    setRatingModalVisible(false);
  };

  // Geri/Ana sayfa davranışı tek kaynakta: hooks/useAppBack.ts (geçmiş
  // yoksa misafir dahil oturumu olan kullanıcı Keşfet'e döner — eskiden
  // karşılama/vitrin ekranında mahsur kalıyordu).
  const handleBack = useAppBack();
  const handleHome = useAppHome();
  // Masaüstü web'de hero TAMAMEN farklı bir düzende çiziliyor (bkz.
  // hooks/useDetailLayout.ts). Native'de `isDesktopWeb` HER ZAMAN false —
  // aşağıdaki mobil ağaç bit bit aynı kalır.
  const { isDesktopWeb } = useDetailLayout();

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

  // ── Takip durumu ────────────────────────────────────────────────────────
  // ESKİ DAVRANIŞ: buton YALNIZCA `isWatchlisted`e bakıyordu. Bu uygulamada
  // izleme listesi "henüz başlanmadı" demek olduğundan, kullanıcının izlediği
  // ya da bitirdiği yüzlerce dizi/film için buton hâlâ "Takip Et" gösteriyordu.
  // Tanım artık tek yerde: utils/followStatus.ts.
  // Üç bayrak zaten prop olarak geliyor — store'u burada tekrar taramaya
  // gerek yok, kuralı doğrudan uygula.
  const followStatus = deriveFollowStatus({ isWatchlisted, isWatched, isDropped: isHidden });

  // "..." menüsünde gizli duran İzleme Listesi satırı kaldırılıp buraya,
  // rozet satırına taşındı — Favori butonuyla birebir aynı desen (bkz. plan:
  // C:\Users\ardag\.claude\plans\iterative-sparking-hippo.md).
  const handleToggleFollow = () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    // Hangi eylemin doğru olduğu duruma göre değişir — karar tablosu
    // utils/followStatus.ts'te (saf ve test edilebilir), burada yalnızca
    // uygulanıyor.
    const action = resolveFollowAction(followStatus);
    if (action === 'drop' || action === 'undrop') {
      // "Bırak"/"Devam Et" — izleme geçmişi ve puanlar KORUNUR, yapım yalnızca
      // vitrin listelerinden çıkar. `onHideFromProgress` verilmemişse (ör.
      // eski bir çağıran) sessizce hiçbir şey yapmak yerine watchlist'e
      // düşmüyoruz: yanlış eylem yapmaktansa hiç yapmamak doğrudur.
      onHideFromProgress?.();
      return;
    }
    onToggleWatchlist();
  };

  // Misafir kontrolü + modal açma tek yerde kalsın diye küçük sarmalayıcılar
  // (web görünümü SALT SUNUM — kendi kuralını bilmez).
  const openRating = () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    setRatingModalVisible(true);
  };
  const openList = () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    setListModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {isDesktopWeb ? (
        <MediaHeroWebView
          type={type}
          data={data}
          poster={poster}
          trailerId={trailerId}
          userRating={userRating}
          isFavorited={isFavorited}
          hasProgress={!!hasProgress}
          progressPercentage={progressPercentage}
          progressColor={progressColor}
          followStatus={followStatus}
          onBack={handleBack}
          onHome={handleHome}
          onOptions={() => setOptionsModalVisible(true)}
          onOpenRating={openRating}
          onToggleFavorite={handleToggleFavorite}
          onOpenList={openList}
          onToggleFollow={handleToggleFollow}
        />
      ) : (
      <>
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
          onPress={handleHome}
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
                {formatRating(data.rating)}
              </Text>
            </View>

            {/* User Rating (Delicate Button) */}
            <TouchableOpacity
              style={[styles.userRatingBadge, (userRating !== undefined && userRating !== null) ? styles.userRatingActive : null]}
              onPress={openRating}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Star size={14} color={(userRating !== undefined && userRating !== null) ? "#3b82f6" : "#a3a3a3"} fill={(userRating !== undefined && userRating !== null) ? "#3b82f6" : "transparent"} />
              <Text style={[styles.userRatingText, (userRating !== undefined && userRating !== null) ? styles.userRatingTextActive : null]}>
                {(userRating !== undefined && userRating !== null) ? `${formatRating(userRating)}/5` : t('rate')}
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
              onPress={openList}
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

      {/* TAKİP ET (Watchlist) — rozet satırından BİLİNÇLİ OLARAK ayrıldı: 5
          rozetin (Puan/Kullanıcı Puanı/Favori/Takip Et/Listeye Ekle) tek
          satırda sıkışması mobilde karmaşık görünüyordu (proje sahibinin
          ekran görüntüsüyle bildirdiği sorun, bkz. docs/HISTORY.md). Artık
          kendi başına, tam genişlikte, tanınabilir bir aksiyon çubuğu —
          "kişiyi takip et" (Public Profile) butonuyla karışmasın diye hâlâ
          `Bookmark` ikonunu ve farklı bir sayfa bağlamını koruyor. */}
      <View style={[styles.watchlistSection, { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }]}>
        <TouchableOpacity
          style={[styles.watchlistBtn, followStatus.isFollowing && styles.watchlistBtnActive]}
          onPress={handleToggleFollow}
          activeOpacity={0.85}
        >
          <Bookmark
            size={18}
            color={followStatus.isFollowing ? '#3b82f6' : '#fff'}
            fill={followStatus.isFollowing ? '#3b82f6' : 'transparent'}
          />
          <Text style={[styles.watchlistBtnText, followStatus.isFollowing && styles.watchlistBtnTextActive]}>
            {followStatus.isFollowing ? t('watchlistActive', 'Takip Ediliyor') : t('watchlistAction', 'Takip Et')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* OVERVIEW */}
      {data.overview && (
        <View style={styles.overviewSection}>
          <ExpandableText text={data.overview} style={styles.overviewText} limit={150} />
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

      </>
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
        isWatched={isWatched}
        isHidden={isHidden}
        onHideFromProgress={onHideFromProgress}
        onDeleteFromHistory={onDeleteFromHistory}
        onRewatch={onRewatch}
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

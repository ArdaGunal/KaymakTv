import { nativeColor } from '../../constants/mobilePalette';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Avatar from '../Avatar';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { TraktUserProfile } from '../../services/api/social';
import { ConnectionState } from '../../hooks/useFollowState';

/**
 * Başlığın GERÇEKTEN okuduğu alanlar (M338). Eskiden tam `TraktUserProfile`
 * istiyordu; bu, Google-only kullanıcının (Trakt profili YOK) başlığının hiç
 * çizilememesi demekti. Kendi profilim hâlâ Trakt nesnesi veriyor — `Pick`
 * yapısal olarak uyumlu, o çağrı değişmedi.
 */

import ProfilAdBlogu from './ProfilAdBlogu';
import ProfilPaylasDugmesi from './ProfilPaylasDugmesi';
export type ProfilKimligi = Pick<TraktUserProfile, 'username' | 'name' | 'about' | 'images'>;

interface ProfileHeaderProps {
  profile: ProfilKimligi;
  followersCount: number;
  followingCount: number;
  // Public Profile ekranında (app/(protected)/user/[slug].tsx) kullanılıyor:
  // isOwnProfile=false verilince "Takip Et"/"Takip Ediliyor"/"Onay Bekleniyor"
  // durumlarını `connectionState`'ten okuyan bir butona döner (bkz.
  // hooks/useFollowState.ts).
  isOwnProfile?: boolean;
  connectionState?: ConnectionState;
  /** Takip et/bırak isteği uçuşta — buton devre dışı + spinner gösterir. */
  isFollowPending?: boolean;
  /** İlk bağlantı durumu kontrolü sürüyor — aynı şekilde spinner gösterir,
   *  aksi halde buton kısa süreliğine yanlış bir "Takip Et" gösterebilirdi. */
  isLoadingConnection?: boolean;
  onPressFollowers?: () => void;
  onPressFollowing?: () => void;
  onPressAction?: () => void;
  // «Profili bildir» 1.0.1'de (2026-11-15) başlıktan üst çubuktaki «⋮» menüsüne taşındı
  // (`features/publicProfile/components/ProfilMenusu.tsx`).
  /** Kimlik birliği Faz 2 · `066`. 1.0.1 Dal 2: başlıkta GÖSTERİLMEZ, yalnız paylaş bağlantısı için. */
  kaymakNo?: number | null;
}

export default function ProfileHeader({
  profile,
  followersCount,
  followingCount,
  isOwnProfile = true,
  connectionState = 'none',
  isFollowPending = false,
  isLoadingConnection = false,
  onPressFollowers,
  onPressFollowing,
  onPressAction,
  kaymakNo,
}: ProfileHeaderProps) {
  const { t } = useTranslation('media');
  const router = useRouter();
  const isFollowBusy = !isOwnProfile && (isFollowPending || isLoadingConnection);


  const handleAction = () => {
    if (onPressAction) return onPressAction();
    if (isOwnProfile) router.push('/(protected)/profile/edit');
  };

  return (
    <View style={styles.container}>
      {/* Üst Satır: Sol Avatar + Sağ İstatistikler & Aksiyon Butonu */}
      <View style={styles.topRow}>
        <Avatar url={profile.images?.avatar?.full} ad={profile.username} size={72} halka />

        <View style={styles.rightCol}>
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={onPressFollowers} activeOpacity={0.7}>
              <Text style={styles.statValue}>{followersCount}</Text>
              <Text style={styles.statLabel}>{t('profileFollowers', 'Takipçi')}</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity style={styles.statItem} onPress={onPressFollowing} activeOpacity={0.7}>
              <Text style={styles.statValue}>{followingCount}</Text>
              <Text style={styles.statLabel}>{t('profileFollowing', 'Takip Edilen')}</Text>
            </TouchableOpacity>
          </View>

          {/* 1.0.1 Dal 2: paylaş, eylem düğmesinin HEMEN SAĞINDA (eskiden numaranın yanında küçük simge). */}
          <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              !isOwnProfile && connectionState === 'none' && styles.actionBtnFollow,
              !isOwnProfile && connectionState === 'following' && styles.actionBtnFollowing,
              !isOwnProfile && connectionState === 'pending' && styles.actionBtnPending,
            ]}
            onPress={handleAction}
            disabled={isFollowBusy}
            activeOpacity={0.85}
          >
            {isFollowBusy ? (
              <ActivityIndicator size="small" color={connectionState === 'none' ? '#fff' : nativeColor('muted', '#94a3b8')} />
            ) : (
              <Text
                style={[
                  styles.actionBtnText,
                  !isOwnProfile && connectionState === 'none' && styles.actionBtnTextFollow,
                  !isOwnProfile && connectionState === 'following' && styles.actionBtnTextFollowing,
                  !isOwnProfile && connectionState === 'pending' && styles.actionBtnTextPending,
                ]}
                numberOfLines={1}
              >
                {isOwnProfile
                  ? t('editProfile', 'Profili Düzenle')
                  : connectionState === 'following'
                  ? t('followingAction', 'Takip Ediliyor')
                  : connectionState === 'pending'
                  ? t('pendingAction', 'Onay Bekleniyor')
                  : t('followAction', 'Takip Et')}
              </Text>
            )}
          </TouchableOpacity>
          <ProfilPaylasDugmesi kaymakNo={kaymakNo} />
          </View>
        </View>
      </View>

      {/* Alt Blok: ad (+ farklıysa @kullanıcı adı) — kural `utils/profilAdi.ts`. Kaymak numarası
          1.0.1 Dal 2'den beri burada değil, «Profilim» ekranında. */}
      <View style={styles.identityBlock}>
        <ProfilAdBlogu
          name={profile.name}
          username={profile.username}
          baslikStili={styles.name}
          altStili={styles.handle}
          yedekBaslik={t('profileTitle', 'Profil')}
        />
        {!!profile.about && (
          <Text style={styles.bio} numberOfLines={3}>
            {profile.about}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 10,
  },
  rightCol: {
    flex: 1,
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: nativeColor('text', '#f1f5f9'),
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: nativeColor('muted', '#94a3b8'),
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionBtnFollow: {
    backgroundColor: nativeColor('primary', '#2563eb'),
    borderColor: nativeColor('primary', '#2563eb'),
  },
  actionBtnFollowing: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderColor: 'rgba(74, 222, 128, 0.35)',
  },
  actionBtnPending: {
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    borderColor: 'rgba(250, 204, 21, 0.3)',
  },
  actionBtnText: {
    color: nativeColor('text', '#f1f5f9'),
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionBtnTextFollow: {
    color: '#fff',
  },
  actionBtnTextFollowing: {
    color: '#4ade80',
  },
  actionBtnTextPending: {
    color: '#facc15',
  },
  identityBlock: {
    gap: 1,
  },
  name: {
    color: nativeColor('text', '#f8fafc'),
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  handle: {
    color: nativeColor('mutedDeep', '#64748b'),
    fontSize: 12.5,
    fontWeight: '500',
  },
  // 1.0.1 Dal 2: ad bloğundan net ayrım (eskiden 6, ada yapışık görünüyordu).
  bio: {
    color: nativeColor('body', '#cbd5e1'),
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
});

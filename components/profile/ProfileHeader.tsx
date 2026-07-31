import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { TraktUserProfile } from '../../services/api/social';
import { ConnectionState } from '../../hooks/useFollowState';

interface ProfileHeaderProps {
  profile: TraktUserProfile;
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
}: ProfileHeaderProps) {
  const { t } = useTranslation('media');
  const router = useRouter();
  const isFollowBusy = !isOwnProfile && (isFollowPending || isLoadingConnection);

  const avatarUrl = profile.images?.avatar?.full;
  const initial = profile.username.charAt(0).toUpperCase();

  const handleAction = () => {
    if (onPressAction) return onPressAction();
    if (isOwnProfile) router.push('/(protected)/profile/edit');
  };

  return (
    <View style={styles.container}>
      {/* Üst Satır: Sol Avatar + Sağ İstatistikler & Aksiyon Butonu */}
      <View style={styles.topRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}

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
              <ActivityIndicator size="small" color={connectionState === 'none' ? '#fff' : '#94a3b8'} />
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
        </View>
      </View>

      {/* Alt Blok: İsim ve Kullanıcı Adı */}
      <View style={styles.identityBlock}>
        <Text style={styles.name} numberOfLines={1}>
          {profile.name || profile.username}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          @{profile.username}
        </Text>
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
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 26,
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
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionBtn: {
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
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
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
    color: '#f1f5f9',
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
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  handle: {
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '500',
  },
  bio: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
});

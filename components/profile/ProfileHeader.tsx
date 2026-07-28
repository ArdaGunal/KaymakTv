import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { TraktUserProfile } from '../../services/api/social';

interface ProfileHeaderProps {
  profile: TraktUserProfile;
  followersCount: number;
  followingCount: number;
  // Şu an yalnızca kendi profilimiz görüntülenebiliyor (başka bir kullanıcının
  // profilini görüntüleme Phase 1.5) — ama bileşen o senaryo için hazır:
  // isOwnProfile=false verilince "Takip Et"/"Takip Ediliyor" butonuna döner.
  isOwnProfile?: boolean;
  isFollowing?: boolean;
  onPressFollowers?: () => void;
  onPressFollowing?: () => void;
  onPressAction?: () => void;
}

export default function ProfileHeader({
  profile,
  followersCount,
  followingCount,
  isOwnProfile = true,
  isFollowing = false,
  onPressFollowers,
  onPressFollowing,
  onPressAction,
}: ProfileHeaderProps) {
  const { t } = useTranslation('media');
  const router = useRouter();

  const avatarUrl = profile.images?.avatar?.full;
  const initial = profile.username.charAt(0).toUpperCase();

  const handleAction = () => {
    if (onPressAction) return onPressAction();
    if (isOwnProfile) router.push('/(protected)/account');
  };

  return (
    <View style={styles.container}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}

      <Text style={styles.name} numberOfLines={1}>
        {profile.name || profile.username}
      </Text>
      <Text style={styles.handle} numberOfLines={1}>
        @{profile.username}
      </Text>

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
          !isOwnProfile && !isFollowing && styles.actionBtnFollow,
          !isOwnProfile && isFollowing && styles.actionBtnFollowing,
        ]}
        onPress={handleAction}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.actionBtnText,
            !isOwnProfile && !isFollowing && styles.actionBtnTextFollow,
            !isOwnProfile && isFollowing && styles.actionBtnTextFollowing,
          ]}
        >
          {isOwnProfile
            ? t('editProfile', 'Profili Düzenle')
            : isFollowing
            ? t('followingAction', 'Takip Ediliyor')
            : t('followAction', 'Takip Et')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.35)',
    marginBottom: 14,
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 34,
  },
  name: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  handle: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 18,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 64,
  },
  statValue: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '800',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionBtn: {
    alignSelf: 'center',
    paddingHorizontal: 32,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnFollow: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  actionBtnFollowing: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderColor: 'rgba(74, 222, 128, 0.35)',
  },
  actionBtnText: {
    color: '#f1f5f9',
    fontSize: 13.5,
    fontWeight: '700',
  },
  actionBtnTextFollow: {
    color: '#fff',
  },
  actionBtnTextFollowing: {
    color: '#4ade80',
  },
});

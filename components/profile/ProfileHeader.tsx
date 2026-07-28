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
              numberOfLines={1}
            >
              {isOwnProfile
                ? t('editProfile', 'Profili Düzenle')
                : isFollowing
                ? t('followingAction', 'Takip Ediliyor')
                : t('followAction', 'Takip Et')}
            </Text>
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
});

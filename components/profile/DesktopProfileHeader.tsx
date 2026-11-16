import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Avatar from '../Avatar';
import SkeletonLoader from '../SkeletonLoader';
import ProfilAdBlogu from './ProfilAdBlogu';
import ProfilPaylasDugmesi from './ProfilPaylasDugmesi';
import { MOBILE_PALETTE } from '../../constants/mobilePalette';

// ─── Masaüstü web profil başlığı (kendi profilim) ───────────────────────────
// Mobil `ProfileHeader.tsx` ayrı. 1.0.1 Dal 5: `app/(protected)/(tabs)/profile.web.tsx`
// 400 KOD satırını aştığı için oradan birebir taşındı (davranış aynı).
export default function DesktopProfileHeader({
  profile,
  followersCount,
  followingCount,
  kaymakNo,
}: {
  profile: any;
  followersCount: number;
  followingCount: number;
  kaymakNo: number | null;
}) {
  const { t } = useTranslation('media');
  const router = useRouter();

  const avatarUrl = profile.images?.avatar?.full;

  return (
    <View style={desktopHeaderStyles.container}>
      {/* Avatar */}
      <Avatar url={avatarUrl} ad={profile.username} size={80} halka />

      {/* Orta Kolon: ad (+ farklıysa @kullanıcı adı) — 1.0.1 Dal 2; Kaymak numarası «Profilim»de. */}
      <View style={desktopHeaderStyles.identityCol}>
        <ProfilAdBlogu
          name={profile.name}
          username={profile.username}
          baslikStili={desktopHeaderStyles.name}
          altStili={desktopHeaderStyles.handle}
        />
        {!!profile.about && (
          <Text style={desktopHeaderStyles.bio} numberOfLines={2}>
            {profile.about}
          </Text>
        )}
      </View>

      {/* Sağ Kolon: İstatistikler + Profili Düzenle Butonu */}
      <View style={desktopHeaderStyles.rightSection}>
        <View style={desktopHeaderStyles.statsRow}>
          <TouchableOpacity 
            style={desktopHeaderStyles.statItem} 
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/user/me/network', params: { type: 'followers' } })}
          >
            <Text style={desktopHeaderStyles.statValue}>{followersCount}</Text>
            <Text style={desktopHeaderStyles.statLabel}>{t('profileFollowers', 'Takipçi')}</Text>
          </TouchableOpacity>

          <View style={desktopHeaderStyles.statDivider} />

          <TouchableOpacity 
            style={desktopHeaderStyles.statItem} 
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/user/me/network', params: { type: 'following' } })}
          >
            <Text style={desktopHeaderStyles.statValue}>{followingCount}</Text>
            <Text style={desktopHeaderStyles.statLabel}>{t('profileFollowing', 'Takip Edilen')}</Text>
          </TouchableOpacity>
        </View>

        <View style={desktopHeaderStyles.actionRow}>
          <TouchableOpacity
            style={desktopHeaderStyles.editBtn}
            onPress={() => router.push('/(protected)/profile/edit')}
            activeOpacity={0.85}
          >
            <Text style={desktopHeaderStyles.editBtnText}>
              {t('editProfile', 'Profili Düzenle')}
            </Text>
          </TouchableOpacity>
          <ProfilPaylasDugmesi kaymakNo={kaymakNo} boyut={38} />
        </View>
      </View>
    </View>
  );
}

export function DesktopProfileHeaderSkeleton() {
  return (
    <View style={desktopHeaderStyles.container}>
      <SkeletonLoader width={80} height={80} borderRadius={40} />
      <View style={[desktopHeaderStyles.identityCol, { gap: 8 }]}>
        <SkeletonLoader width={160} height={18} borderRadius={5} />
        <SkeletonLoader width={100} height={13} borderRadius={4} />
      </View>
      <View style={desktopHeaderStyles.rightSection}>
        <View style={desktopHeaderStyles.statsRow}>
          <SkeletonLoader width={60} height={36} borderRadius={8} />
          <SkeletonLoader width={60} height={36} borderRadius={8} />
        </View>
        <SkeletonLoader width={140} height={36} borderRadius={10} />
      </View>
    </View>
  );
}

// ─── Stiller (yalnız bu dosyada) ────────────────────────────────────────────
const desktopHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    flex: 1,
  },
  identityCol: {
    flexShrink: 1,
  },
  name: {
    color: MOBILE_PALETTE.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  handle: {
    color: MOBILE_PALETTE.mutedDeep,
    fontSize: 13,
    fontWeight: '500',
  },
  // 1.0.1 Dal 2: ad bloğundan net ayrım.
  bio: {
    color: MOBILE_PALETTE.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightSection: {
    marginLeft: 'auto' as any,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    flexShrink: 0,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statValue: {
    color: MOBILE_PALETTE.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: MOBILE_PALETTE.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: MOBILE_PALETTE.raised,
  },
  editBtn: {
    height: 38,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: MOBILE_PALETTE.raised,
    borderWidth: 1,
    borderColor: MOBILE_PALETTE.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...({ cursor: 'pointer', transition: 'background-color 0.2s ease' } as any),
  },
  editBtnText: {
    color: MOBILE_PALETTE.text,
    fontSize: 13,
    fontWeight: '700',
  },
});

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Lock, Check, Clock, UserPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { TraktUserProfile } from '../../../services/api/social';
import { ConnectionState } from '../hooks/useUserSearch';

interface UserProfileCardProps {
  profile: TraktUserProfile | null;
  error: string | null;
  connectionState: ConnectionState;
  isFollowPending: boolean;
  onToggleFollow: () => void;
}

export default function UserProfileCard({
  profile,
  error,
  connectionState,
  isFollowPending,
  onToggleFollow,
}: UserProfileCardProps) {
  const { t } = useTranslation('feed');

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>
          {error === 'not_found'
            ? t('searchNotFound', 'Bu kullanıcı adında biri bulunamadı.')
            : t('searchError', 'Bir şeyler ters gitti, tekrar dene.')}
        </Text>
      </View>
    );
  }

  if (!profile) return null;

  const avatarUrl = profile.images?.avatar?.full;
  const initial = profile.username.charAt(0).toUpperCase();

  return (
    <View style={styles.card}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.username} numberOfLines={1}>
            {profile.name || profile.username}
          </Text>
          {profile.private && <Lock size={13} color="#94a3b8" />}
        </View>
        <Text style={styles.handle} numberOfLines={1}>
          @{profile.username}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.followBtn,
          connectionState === 'following' && styles.followingBtn,
          connectionState === 'pending' && styles.pendingBtn,
        ]}
        onPress={onToggleFollow}
        disabled={isFollowPending}
        activeOpacity={0.8}
      >
        {isFollowPending ? (
          <ActivityIndicator size="small" color={connectionState === 'none' ? '#fff' : '#94a3b8'} />
        ) : connectionState === 'following' ? (
          <>
            <Check size={14} color="#4ade80" />
            <Text style={styles.followingBtnText}>{t('following', 'Takip Ediliyor')}</Text>
          </>
        ) : connectionState === 'pending' ? (
          <>
            <Clock size={14} color="#facc15" />
            <Text style={styles.pendingBtnText}>{t('pending', 'Onay Bekleniyor')}</Text>
          </>
        ) : (
          <>
            <UserPlus size={14} color="#fff" />
            <Text style={styles.followBtnText}>{t('follow', 'Takip Et')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#172033',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#22304A',
    padding: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 16,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 15,
    flexShrink: 1,
  },
  handle: {
    color: '#64748b',
    fontSize: 12,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 112,
    justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.35)',
  },
  pendingBtn: {
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.3)',
  },
  followBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  followingBtnText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingBtnText: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 13,
    flex: 1,
    textAlign: 'center',
  },
});

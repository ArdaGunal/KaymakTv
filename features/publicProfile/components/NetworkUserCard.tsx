import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Avatar from '../../../components/Avatar';
import { Lock, Check, Clock, UserPlus } from '../../../components/icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useFollowState } from '../../../hooks/useFollowState';
import type { NetworkUser } from '../../../hooks/useNetworkList';

interface NetworkUserCardProps {
  user: NetworkUser;
}

/**
 * Takipçi/takip edilen listesindeki tek satır — **BİZİM** graftan
 * (Faz T · T3.3, M337).
 *
 * ⛔ ESKİDEN `UserProfileCard`'ı (Trakt profil kartı) sarıyordu ve
 * `user.ids?.slug` ile adresleniyordu. Google-only kullanıcının slug'ı YOK;
 * o kart onu hiç gösteremezdi.
 *
 * 🪪 Adres artık `username` ("EVRENSEL KAYMAK KİMLİĞİ"), takip düğmesi ise
 * `userId` ile çalışıyor — ikisi AYRI: biri kullanıcıya görünen adres, öbürü
 * iç kimlik.
 */
export default function NetworkUserCard({ user }: NetworkUserCardProps) {
  const { t } = useTranslation('feed');
  const router = useRouter();

  // `skipFetch=true`: grafı listeyi çeken ekran zaten bir kez yükledi; her
  // kart için tekrar tetiklemek aynı isteği N kez kuyruğa alırdı.
  const { connectionState, isLoadingConnection, isFollowPending, toggleFollow } = useFollowState(
    user.userId,
    user.username,
    true,
  );


  const dugmeIcerigi = () => {
    if (isFollowPending || isLoadingConnection) {
      return <ActivityIndicator size="small" color="#94a3b8" />;
    }
    if (connectionState === 'following') {
      return (
        <>
          <Check size={14} color="#94a3b8" />
          <Text style={styles.dugmeMetniPasif}>{t('following', 'Takiptesin')}</Text>
        </>
      );
    }
    if (connectionState === 'pending') {
      return (
        <>
          <Clock size={14} color="#94a3b8" />
          <Text style={styles.dugmeMetniPasif}>{t('requested', 'İstek gönderildi')}</Text>
        </>
      );
    }
    return (
      <>
        <UserPlus size={14} color="#0b1120" />
        <Text style={styles.dugmeMetni}>
          {/* 🔒 Gizli hesapta düğme "İstek Gönder" demeli — basınca doğrudan
              takip KURULMUYOR, sunucu bir istek satırı açıyor. "Takip Et"
              yazmak arayüzün yalan söylemesi olurdu. */}
          {user.isPrivate ? t('sendRequest', 'İstek Gönder') : t('follow', 'Takip Et')}
        </Text>
      </>
    );
  };

  const takipEdiliyor = connectionState !== 'none';

  return (
    <View style={styles.satir}>
      <TouchableOpacity
        style={styles.kimlik}
        activeOpacity={0.7}
        onPress={() => router.push(`/user/${user.username}`)}
      >
        <Avatar url={user.avatarUrl} ad={user.username} size={42} />
        <View style={styles.adAlani}>
          <View style={styles.adSatiri}>
            <Text style={styles.ad} numberOfLines={1}>{user.displayName || `@${user.username}`}</Text>
            {user.isPrivate && <Lock size={13} color="#94a3b8" />}
          </View>
          {/* §C24 — ad benzersiz değil; @username ad varken de görünür. */}
          {!!user.displayName && (
            <Text style={styles.kullaniciAdi} numberOfLines={1}>@{user.username}</Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.dugme, takipEdiliyor && styles.dugmePasif]}
        onPress={toggleFollow}
        disabled={isFollowPending || isLoadingConnection}
        activeOpacity={0.8}
      >
        {dugmeIcerigi()}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  kimlik: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  adAlani: {
    flex: 1,
  },
  adSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kullaniciAdi: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 1,
  },
  ad: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  dugme: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 118,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
  },
  dugmePasif: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  dugmeMetni: {
    color: '#0b1120',
    fontSize: 13,
    fontWeight: '700',
  },
  dugmeMetniPasif: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
});

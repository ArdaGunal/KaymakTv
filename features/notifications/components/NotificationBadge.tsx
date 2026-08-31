import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bell } from '../../../components/icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { useNotificationStore } from '../../../store/notificationStore';
import { useInboxStore } from '../inbox/useInboxStore';

export const NotificationBadge = () => {
  const { unreadCount: socialUnread, refreshActivity } = useNotificationStore();
  // İÇERİK bildirimleri (bugün yayında / prömiyer / film) AYRI bir listede
  // tutuluyor — gerekçe `inbox/useInboxStore.ts` başlığında. Rozet ikisinin
  // TOPLAMINI gösteriyor: kullanıcı açısından "okunmamış bildirim" tek bir
  // kavram, iki ayrı sayaç görmesi anlamsız olurdu.
  const contentUnread = useInboxStore((state) => state.unreadCount);
  const unreadCount = socialUnread + contentUnread;
  const { accessToken, isGuest } = useAuth();
  const router = useRouter();

  // Bu bileşen yalnızca gerçek (misafir olmayan) kullanıcının profil
  // ekranlarında render oluyor (bkz. ProfileMobile.tsx/profile.web.tsx'teki
  // `!accessToken || isGuest` guard'ları), ama yine de burada da kontrol
  // ediliyor — Madde 89'daki AYNI hata sınıfını (misafirde token'sız istek →
  // sessizce oturumdan atılma) tekrar açmamak için.
  useEffect(() => {
    if (!accessToken || isGuest) return;
    refreshActivity();
  }, [accessToken, isGuest, refreshActivity]);

  const handlePress = () => {
    router.push('/notifications');
  };

  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Bell size={20} color="#cbd5e1" />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{displayCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#0B1120', // Background color for cutout effect
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
  },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../../../store/notificationStore';

export const NotificationBadge = () => {
  const { unreadCount } = useNotificationStore();
  const { t } = useTranslation('common');

  // Bildirim sistemi henüz yapım aşamasında (bkz. docs/notifications.md) —
  // gerçek bir hedef ekran/yönlendirme yok. `useFollowState.ts`'teki
  // web/native Alert ayrımıyla aynı desen: RN'in `Alert.alert`'ı Web'de
  // hiç render olmaz, orada `window.alert` kullanılır.
  const handlePress = () => {
    if (Platform.OS === 'web') {
      window.alert(`${t('notificationsComingSoonTitle', 'Çok Yakında')}\n\n${t('notificationsComingSoonMessage', 'Bildirim sistemi yapım aşamasında.')}`);
    } else {
      Alert.alert(
        t('notificationsComingSoonTitle', 'Çok Yakında'),
        t('notificationsComingSoonMessage', 'Bildirim sistemi yapım aşamasında.')
      );
    }
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

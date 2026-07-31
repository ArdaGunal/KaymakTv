import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { UserPlus, Bell, Check, X, Inbox } from 'lucide-react-native';

import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { useAuth } from '../../context/AuthContext';
import { useFollowRequests } from '../../hooks/useFollowRequests';
import { useNotificationStore, ActivityNotification } from '../../store/notificationStore';
import { TraktFollowRequest } from '../../services/api/social';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

const DESKTOP_BREAKPOINT = 768;

interface FollowRequestRowProps {
  request: TraktFollowRequest;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
}

function FollowRequestRow({ request, onAccept, onReject }: FollowRequestRowProps) {
  const { t } = useTranslation('common');
  const displayName = request.user.name || request.user.username;
  const avatarUrl = request.user.images?.avatar?.full;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.requestRow}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}

      <View style={styles.requestInfo}>
        <Text style={styles.requestName} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.requestUsername} numberOfLines={1}>@{request.user.username}</Text>
      </View>

      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => onAccept(request.id)}
          activeOpacity={0.8}
        >
          <Check size={15} color="#ffffff" />
          <Text style={styles.acceptButtonText}>{t('accept', 'Kabul Et')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => onReject(request.id)}
          activeOpacity={0.8}
        >
          <X size={15} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function NotificationRow({ notification }: { notification: ActivityNotification }) {
  const { t } = useTranslation('common');
  const name = notification.name || notification.username;
  const message =
    notification.type === 'newFollower'
      ? t('activityNewFollower', '{{name}} sizi takip etmeye başladı', { name })
      : t('activityRequestApproved', '{{name}} takip isteğinizi onayladı', { name });
  const timeAgo = formatRelativeTime(new Date(notification.createdAt).toISOString(), t);

  return (
    <View style={styles.notificationRow}>
      <View style={styles.notificationIconWrap}>
        <Bell size={16} color="#60a5fa" />
      </View>
      <Text style={styles.notificationMessage} numberOfLines={2}>{message}</Text>
      <Text style={styles.notificationTime}>{timeAgo}</Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { accessToken, isGuest } = useAuth();

  const { requests, isLoading: isRequestsLoading, accept, reject } = useFollowRequests();
  const items = useNotificationStore((s) => s.items);
  const refreshActivity = useNotificationStore((s) => s.refreshActivity);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  // Misafirde/token yokken Trakt'a istek atılmaz (bkz. docs/HISTORY.md
  // Madde 89'daki AYNI koruma — token'sız `/users/me` çağrısı misafiri
  // sessizce oturumdan atıyordu). Ekranı açmak rozeti temizler (yaygın
  // bildirim-listesi konvansiyonu).
  useEffect(() => {
    if (!accessToken || isGuest) return;
    refreshActivity();
    markAllRead();
  }, [accessToken, isGuest, refreshActivity, markAllRead]);

  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(protected)/(tabs)/explore');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <SettingsHeader title={t('notifications', 'Bildirimler')} isDesktop={isDesktop} onBack={navigateBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* A. Takip İstekleri */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <UserPlus size={16} color="#94a3b8" />
            <Text style={styles.sectionTitle}>{t('followRequests', 'Takip İstekleri')}</Text>
          </View>

          {isRequestsLoading ? (
            <View style={styles.emptyBox}>
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          ) : requests.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('noFollowRequests', 'Bekleyen takip isteğiniz yok.')}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {requests.map((request, index) => (
                <React.Fragment key={request.id}>
                  <FollowRequestRow request={request} onAccept={accept} onReject={reject} />
                  {index < requests.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* B. Genel Bildirimler */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={16} color="#94a3b8" />
            <Text style={styles.sectionTitle}>{t('generalNotifications', 'Genel Bildirimler')}</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Inbox size={28} color="#334155" />
              <Text style={styles.emptyText}>{t('noNotifications', 'Henüz bildiriminiz yok.')}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {items.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <NotificationRow notification={notification} />
                  {index < items.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    width: '100%',
    gap: 24,
  },
  contentDesktop: {
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 16,
  },

  // Takip isteği satırı
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
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
  requestInfo: {
    flex: 1,
    gap: 2,
  },
  requestName: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '700',
  },
  requestUsername: {
    color: '#64748b',
    fontSize: 12,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  acceptButtonText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  rejectButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Genel bildirim satırı
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  notificationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationMessage: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 13.5,
    lineHeight: 19,
  },
  notificationTime: {
    color: '#64748b',
    fontSize: 11.5,
  },

  // Boş durum
  emptyBox: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
  },
});

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppBack } from '../../hooks/useAppBack';
import { useTranslation } from 'react-i18next';
import { UserPlus, Check, X } from '../../components/icons';

import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { useAuth } from '../../context/AuthContext';
import { useFollowRequests } from '../../hooks/useFollowRequests';
import { useNotificationStore } from '../../store/notificationStore';
import { NotificationTimeline } from '../../features/notifications/components/NotificationTimeline';
import { EnableNotificationsBanner } from '../../features/notifications/components/EnableNotificationsBanner';
import { useInboxStore } from '../../features/notifications/inbox/useInboxStore';
import { TraktFollowRequest } from '../../services/api/social';

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
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" cachePolicy="disk" />
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

export default function NotificationsScreen() {
  const { t } = useTranslation('common');
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { accessToken, isGuest } = useAuth();

  const { requests, isLoading: isRequestsLoading, accept, reject, refetch: refetchRequests } = useFollowRequests();
  const refreshActivity = useNotificationStore((s) => s.refreshActivity);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  // Ekranı açmak HER İKİ listeyi de okundu sayar — rozet ikisinin toplamını
  // gösterdiği için yalnızca birini temizlemek rozeti takılı bırakırdı.
  const markInboxRead = useInboxStore((s) => s.markAllRead);

  // Pull-to-refresh: bu ekran İKİ ayrı kaynaktan besleniyor — takip istekleri
  // (`useFollowRequests`) ve aktivite bildirimleri (`useNotificationStore`,
  // zaten mount'ta `refreshActivity` ile çekiliyordu). İkisi de tazelenmezse
  // "yenile" jesti yarım kalır.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchRequests(), refreshActivity()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchRequests, refreshActivity]);

  // Misafirde/token yokken Trakt'a istek atılmaz (bkz. docs/HISTORY.md
  // Madde 89'daki AYNI koruma — token'sız `/users/me` çağrısı misafiri
  // sessizce oturumdan atıyordu). Ekranı açmak rozeti temizler (yaygın
  // bildirim-listesi konvansiyonu).
  useEffect(() => {
    if (!accessToken || isGuest) return;
    refreshActivity();
    markAllRead();
    markInboxRead();
  }, [accessToken, isGuest, refreshActivity, markAllRead, markInboxRead]);

  const navigateBack = useAppBack();

  // 🔴 BOŞKEN BÖLÜM HİÇ ÇİZİLMİYOR. Eskiden "Bekleyen takip isteğiniz yok."
  // kutusu HER ZAMAN duruyordu ve ekranın en üstünde, en sık görülen yerde,
  // hiçbir şey söylemeyen bir kutu olarak yer kaplıyordu. Takip isteği nadir
  // bir olay; yokken bölümü göstermemek asıl içeriği yukarı taşıyor.
  const showRequests = isRequestsLoading || requests.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <SettingsHeader title={t('notifications', 'Bildirimler')} isDesktop={isDesktop} onBack={navigateBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#ffffff" />
        }
      >
        {/* Bildirimleri ac hatirlatmasi — izin yoksa ve kullanici kapatmadiysa
            gorunur. Karar `promptBanner.ts`'te, bilesen kendi icinde null
            donebilir; burada kosul YOK. */}
        <EnableNotificationsBanner />

        {/* A. Takip İstekleri — AKSIYON gerektirdigi icin akisin USTUNDE ve
            akisa KARISTIRILMADI: zaman siralamasina girseydi eski bir istek
            listenin dibine gomulur ve cevapsiz kalirdi. */}
        {showRequests && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <UserPlus size={16} color="#94a3b8" />
              <Text style={styles.sectionTitle}>{t('followRequests', 'Takip İstekleri')}</Text>
            </View>

            {isRequestsLoading ? (
              <View style={styles.emptyBox}>
                <ActivityIndicator size="small" color="#3b82f6" />
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
        )}

        {/* B. Birlesik bildirim akisi — icerik + sosyal, tarih gruplariyla. */}
        <NotificationTimeline />
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

  // Boş durum (yalnızca takip istekleri yüklenirken)
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
});

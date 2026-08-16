import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, SearchX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import FeedCard from '../../features/feed/components/FeedCard';
import { useActivityDetail } from '../../features/feed/hooks/useActivityDetail';

// Tek bir aktivitenin kalıcı bağlantısı — "Paylaş" menü satırının hedefi
// (bkz. features/feed/components/FeedCard.tsx handleShare). `app/episode/
// [id].tsx` ile AYNI konum deseni: `(protected)`/`(public)` gruplarının
// DIŞINDA, tek dosya (Akış zaten "tek dosya hem mobil hem web'i besliyor"
// konvansiyonunda — bkz. docs/HISTORY.md Madde 148), herkese açık.
//
// Bulunamadı/silinmiş durumu BİLİNÇLİ OLARAK "hata" gibi değil, sıradan bir
// boş durum gibi gösteriliyor — eski/geçersiz bir paylaşım linkine tıklamak
// NORMAL bir senaryo (aktivite sahibi silmiş olabilir), WifiOff+"Tekrar Dene"
// deseni burada yanıltıcı olurdu.
export default function ActivityDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('feed');
  const { activity, isLoading } = useActivityDetail(id);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top || 20 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={22} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('activityPageTitle', 'Gönderi')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
        ) : activity ? (
          <FeedCard activity={activity} />
        ) : (
          <View style={styles.emptyState}>
            <SearchX size={40} color="#334155" />
            <Text style={styles.emptyTitle}>{t('activityNotFoundTitle', 'Bu Gönderi Artık Yok')}</Text>
            <Text style={styles.emptyText}>{t('activityNotFoundText', 'Silinmiş olabilir ya da hiç var olmadı.')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#22304A',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 30,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: 16,
  },
  loader: {
    marginTop: 60,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

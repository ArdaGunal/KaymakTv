import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Rss, WifiOff } from '../../../components/icons';
import type { FeedFilter } from '../utils/feedFilter';

/**
 * Akış listesinin boş/alt durumları — `feed.tsx` 400 satırı aşınca (C6) oradan
 * taşındı; davranış ve gerekçeler aynen.
 */

interface EmptyProps {
  isFiltering: boolean;
  filtre: FeedFilter;
  /** "Veri yok" ile "yüklenemedi" AYRI durumlar — hata yutulup «Akışın Boş»
   *  denirse kullanıcıya yanlış bilgi verilir. */
  showError: boolean;
  onRetry: () => void;
}

export function FeedListEmpty({ isFiltering, filtre, showError, onRetry }: EmptyProps) {
  const { t } = useTranslation('feed');
  if (isFiltering) return <ActivityIndicator style={styles.filterLoader} color="#38bdf8" />;
  if (showError) {
    return (
      <View style={styles.emptyState}>
        <WifiOff size={40} color="#334155" />
        <Text style={styles.emptyTitle}>{t('errorTitle', 'Akış Yüklenemedi')}</Text>
        <Text style={styles.emptyText}>{t('errorText', 'Bağlantını kontrol edip tekrar dene.')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>{t('retry', 'Tekrar Dene')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  // C6 · filtreli boş sonuç «akışın boş» DEĞİL — çipler üstte kalır, kullanıcı geri döner.
  const filtreli = filtre !== 'tumu';
  return (
    <View style={styles.emptyState}>
      <Rss size={40} color="#334155" />
      <Text style={styles.emptyTitle}>
        {filtreli ? t('filterEmptyTitle', 'Burada henüz bir şey yok') : t('emptyTitle', 'Akışın Boş')}
      </Text>
      <Text style={styles.emptyText}>
        {filtreli
          ? t('filterEmptyText', 'Son 30 günde bu filtrede gösterilecek bir şey yok.')
          : t('emptyText', 'Takip ettiğin kişilerin izleme aktiviteleri burada görünecek.')}
      </Text>
    </View>
  );
}

interface FooterProps {
  isLoadingMore: boolean;
  loadMoreFailed: boolean;
  hasMore: boolean;
  hasData: boolean;
  onRetryLoadMore: () => void;
}

/**
 * Sonsuz kaydırmanın alt bilgisi: yükleniyor → spinner; devamı yüklenemedi →
 * «Tekrar Dene» (Y21 — otomatik yeniden deneme YOK); devamı yok → «Hepsi bu kadar».
 * ⚠️ SIRA ÖNEMLİ: `isLoadingMore` ÖNCE — kullanıcı «Tekrar Dene»ye basınca istek
 * uçarken hata kutusu durmasın (AI_RULES §2, useExplore ile aynı sıra).
 */
export function FeedListFooter({ isLoadingMore, loadMoreFailed, hasMore, hasData, onRetryLoadMore }: FooterProps) {
  const { t } = useTranslation(['feed', 'common']);
  if (isLoadingMore) {
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#38bdf8" />
      </View>
    );
  }
  if (loadMoreFailed) {
    return (
      <View style={styles.loadMoreFailedBox}>
        <Text style={styles.loadMoreFailedText}>{t('feed:loadMoreFailed', 'Devamı yüklenemedi.')}</Text>
        <TouchableOpacity onPress={onRetryLoadMore} style={styles.loadMoreRetryBtn} activeOpacity={0.8}>
          <Text style={styles.loadMoreRetryText}>{t('common:retry', 'Tekrar Dene')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!hasMore && hasData) {
    return (
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('feed:endOfFeed', 'Hepsi bu kadar')}</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  filterLoader: { marginTop: 40 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  retryButtonText: { color: '#38bdf8', fontSize: 13, fontWeight: '700' },
  loadMoreFailedBox: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  loadMoreFailedText: { color: '#94a3b8', fontSize: 12 },
  loadMoreRetryBtn: { paddingHorizontal: 16, paddingVertical: 7, backgroundColor: '#172033', borderRadius: 8 },
  loadMoreRetryText: { color: '#e5e5e5', fontSize: 12, fontWeight: '700' },
  footer: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  footerText: { color: '#475569', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
});

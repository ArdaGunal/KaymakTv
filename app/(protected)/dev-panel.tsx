import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppBack } from '../../hooks/useAppBack';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { Copy, RefreshCw, Activity, Bug } from '../../components/icons';

import { SettingsHeader } from '../../components/settings/SettingsHeader';
import Snackbar from '../../components/Snackbar';
import StatCard from '../../components/devPanel/StatCard';
import PerformanceTab from '../../components/devPanel/PerformanceTab';
import ErrorsTab from '../../components/devPanel/ErrorsTab';
import SendReportModal from '../../components/devPanel/SendReportModal';
import LiveModeToggle from '../../components/devPanel/LiveModeToggle';
import { useDeveloperPanel } from '../../hooks/useDeveloperPanel';
import { confirmAsync } from '../../utils/confirmDialog';
import type { PerfCategory } from '../../utils/perfLog';

const LIVE_MODE_INTERVAL_MS = 4000;

const DESKTOP_BREAKPOINT = 768;

type DevPanelTab = 'performance' | 'errors';

export default function DeveloperPanelScreen() {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const {
    perfEntries,
    errorEntries,
    stats,
    categorySummaries,
    isLoading,
    isRefreshing,
    refresh,
    silentRefresh,
    clearPerf,
    clearErrors,
  } = useDeveloperPanel();

  const [activeTab, setActiveTab] = useState<DevPanelTab>('performance');
  const [selectedCategory, setSelectedCategory] = useState<PerfCategory | null>(null);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  // Canlı İzleme: panel bu ekrandan ÇIKINCA (unmount) veya anahtar KAPATILINCA
  // temizlenir — arka planda sonsuza dek çalışan bir zamanlayıcı KALMAZ.
  // `silentRefresh` kullanılır (`refresh` DEĞİL): aksi hâlde her 4 saniyede
  // bir RefreshControl döngüsü görünür biçimde "titrerdi", kullanıcı hiçbir
  // şeyi elle çekmediği hâlde.
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(() => {
      silentRefresh();
    }, LIVE_MODE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [liveMode, silentRefresh]);

  const navigateBack = useAppBack();

  const showToast = useCallback((message: string) => setToast({ visible: true, message }), []);

  const handleCopyReport = useCallback(async () => {
    try {
      const report = {
        generatedAt: new Date().toISOString(),
        performance: perfEntries,
        errors: errorEntries,
      };
      await Clipboard.setStringAsync(JSON.stringify(report, null, 2));
      showToast(t('settings:devPanelCopySuccess', 'Rapor panoya kopyalandı.'));
    } catch {
      showToast(t('settings:devPanelCopyError', 'Rapor oluşturulurken bir hata oluştu.'));
    }
  }, [perfEntries, errorEntries, t, showToast]);

  const handleClearPerf = useCallback(async () => {
    const confirmed = await confirmAsync(
      t('settings:devPanelPerfClearConfirmTitle', 'Ölçümler Temizlensin mi?'),
      t('settings:devPanelPerfClearConfirmText', 'Kayıtlı tüm performans ölçümleri kalıcı olarak silinecek.'),
      t('common:delete'),
      t('common:cancel')
    );
    if (!confirmed) return;
    await clearPerf();
    setSelectedCategory(null);
    showToast(t('settings:devPanelPerfClearSuccess', 'Performans günlüğü temizlendi.'));
  }, [clearPerf, t, showToast]);

  const handleClearErrors = useCallback(async () => {
    const confirmed = await confirmAsync(
      t('settings:errorLogClearConfirmTitle'),
      t('settings:errorLogClearConfirmText'),
      t('common:delete'),
      t('common:cancel')
    );
    if (!confirmed) return;
    await clearErrors();
    showToast(t('settings:errorLogClearSuccess'));
  }, [clearErrors, t, showToast]);

  const handleCopyErrors = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(JSON.stringify(errorEntries, null, 2));
      showToast(t('settings:errorLogCopySuccess'));
    } catch {
      showToast(t('common:error'));
    }
  }, [errorEntries, t, showToast]);

  // Başlığın sağındaki aksiyon butonları: Hata Raporu Gönder (CTA), Yenile ve Kopyala.
  const headerActions = (
    <View style={styles.headerActions}>
      <TouchableOpacity
        style={styles.sendReportHeaderBtn}
        onPress={() => setSendModalVisible(true)}
        activeOpacity={0.8}
        accessibilityLabel={t('settings:devPanelSendReport', 'Teşhis Raporu Gönder')}
      >
        <Bug size={15} color="#ffffff" />
        <Text style={styles.sendReportHeaderBtnText}>
          {t('settings:devPanelSendReport', 'Teşhis Raporu Gönder')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.headerIconBtn}
        onPress={refresh}
        activeOpacity={0.7}
        accessibilityLabel={t('settings:devPanelRefreshAction', 'Yenile')}
      >
        <RefreshCw size={15} color="#94a3b8" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.headerIconBtn}
        onPress={handleCopyReport}
        activeOpacity={0.7}
        accessibilityLabel={t('settings:devPanelCopyReport', 'Raporu Kopyala')}
      >
        <Copy size={15} color="#94a3b8" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <SettingsHeader
        title={t('settings:devPanelTitle', 'Geliştirici Paneli')}
        isDesktop={isDesktop}
        onBack={navigateBack}
        rightSlot={headerActions}
      />

      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        {/* Üstteki 5 istatistik kartı */}
        <View style={styles.statsRow}>
          <StatCard value={stats.totalMeasurements} label={t('settings:devPanelStatMeasurements', 'Ölçüm')} />
          <StatCard
            value={stats.moderateCount}
            label={t('settings:devPanelStatModerate', 'Orta (500ms-2sn)')}
            accentColor="#f59e0b"
          />
          <StatCard
            value={stats.criticalCount}
            label={t('settings:devPanelStatCritical', 'Kritik (>2sn)')}
            accentColor="#ef4444"
          />
          <StatCard
            value={stats.errorCount24h}
            label={t('settings:devPanelStatErrors', 'Hata (24sa)')}
            accentColor="#ef4444"
          />
          <StatCard
            value={stats.warningCount24h}
            label={t('settings:devPanelStatWarnings', 'Uyarı (24sa)')}
            accentColor="#f59e0b"
          />
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'performance' && styles.tabActive]}
            onPress={() => setActiveTab('performance')}
            activeOpacity={0.8}
          >
            <Activity size={15} color={activeTab === 'performance' ? '#ffffff' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'performance' && styles.tabTextActive]}>
              {t('settings:devPanelTabPerformance', 'Performans')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'errors' && styles.tabActive]}
            onPress={() => setActiveTab('errors')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'errors' && styles.tabTextActive]}>
              {t('settings:errorLogTitle')}
            </Text>
          </TouchableOpacity>
        </View>

        <LiveModeToggle enabled={liveMode} onToggle={setLiveMode} />

        {activeTab === 'performance' ? (
          <PerformanceTab
            entries={perfEntries}
            categorySummaries={categorySummaries}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onClear={handleClearPerf}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            onRefresh={refresh}
            locale={i18n.language}
          />
        ) : (
          <ErrorsTab
            entries={errorEntries}
            onCopy={handleCopyErrors}
            onClear={handleClearErrors}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            onRefresh={refresh}
            locale={i18n.language}
          />
        )}
      </View>

      {/* Mobilde ekranın altındaki gezinme ve güvenli alanları gözeterek belirgin Teşhis Raporu butonu */}
      {!isDesktop && (
        <View style={[styles.mobileBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={styles.mobileReportBtn}
            onPress={() => setSendModalVisible(true)}
            activeOpacity={0.85}
          >
            <Bug size={18} color="#ffffff" />
            <Text style={styles.mobileReportBtnText}>
              {t('settings:devPanelSendReportMobile', 'Hata & Teşhis Raporu Gönder')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <SendReportModal
        visible={sendModalVisible}
        onClose={() => setSendModalVisible(false)}
        perfEntries={perfEntries}
        errorEntries={errorEntries}
      />

      <Snackbar
        visible={toast.visible}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
        duration={2500}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendReportHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendReportHeaderBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 14,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  mobileBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(11, 17, 32, 0.95)',
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  mobileReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  mobileReportBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

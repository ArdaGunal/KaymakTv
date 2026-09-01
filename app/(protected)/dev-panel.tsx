import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppBack } from '../../hooks/useAppBack';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { Copy, RefreshCw, Activity, Bug, MoreVertical } from '../../components/icons';

import { SettingsHeader } from '../../components/settings/SettingsHeader';
import Snackbar from '../../components/Snackbar';
import StatCard from '../../components/devPanel/StatCard';
import PerformanceTab from '../../components/devPanel/PerformanceTab';
import ErrorsTab from '../../components/devPanel/ErrorsTab';
import SendReportModal from '../../components/devPanel/SendReportModal';
import LiveModeToggle from '../../components/devPanel/LiveModeToggle';
import { DevPanelActionsModal } from '../../components/devPanel/DevPanelActionsModal';
import { useDeveloperPanel } from '../../hooks/useDeveloperPanel';
import { NotificationDebugCard } from '../../features/notifications/components/NotificationDebugCard';
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
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

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

  const headerRightSlot = isDesktop ? (
    <View style={styles.headerActionsWeb}>
      <TouchableOpacity
        style={styles.sendReportBtnWeb}
        onPress={() => setSendModalVisible(true)}
        activeOpacity={0.8}
        accessibilityLabel={t('settings:devPanelSendReport', 'Teşhis Raporu Gönder')}
      >
        <Bug size={15} color="#fb923c" />
        <Text style={styles.sendReportBtnTextWeb}>
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
  ) : (
    <TouchableOpacity
      style={styles.headerIconBtnMobile}
      onPress={() => setMobileMenuVisible(true)}
      activeOpacity={0.75}
      accessibilityLabel="Daha Fazla Eylem"
    >
      <MoreVertical size={18} color="#f1f5f9" />
    </TouchableOpacity>
  );

  const statsCards = (
    <>
      <StatCard
        value={stats.totalMeasurements}
        label={t('settings:devPanelStatMeasurements', 'Ölçüm')}
        accentColor="#60a5fa"
        style={isDesktop ? styles.statCardFlex : styles.statCardMobileItem}
      />
      <StatCard
        value={stats.moderateCount}
        label={t('settings:devPanelStatModerate', 'Orta (500ms-2sn)')}
        accentColor="#fb923c"
        style={isDesktop ? styles.statCardFlex : styles.statCardMobileItem}
      />
      <StatCard
        value={stats.criticalCount}
        label={t('settings:devPanelStatCritical', 'Kritik (>2sn)')}
        accentColor="#f87171"
        style={isDesktop ? styles.statCardFlex : styles.statCardMobileItem}
      />
      <StatCard
        value={stats.errorCount24h}
        label={t('settings:devPanelStatErrors', 'Hata (24sa)')}
        accentColor="#f87171"
        style={isDesktop ? styles.statCardFlex : styles.statCardMobileItem}
      />
      <StatCard
        value={stats.warningCount24h}
        label={t('settings:devPanelStatWarnings', 'Uyarı (24sa)')}
        accentColor="#fb923c"
        style={isDesktop ? styles.statCardFlex : styles.statCardMobileItem}
      />
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <SettingsHeader
        title={t('settings:devPanelTitle', 'Geliştirici Paneli')}
        isDesktop={isDesktop}
        onBack={navigateBack}
        rightSlot={headerRightSlot}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#94a3b8" />}
      >
        <NotificationDebugCard />

        {/* 5 Kompakt Metrik Kartı */}
        {isDesktop ? (
          <View style={styles.statsRowWeb}>{statsCards}</View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsScrollMobile}
          >
            {statsCards}
          </ScrollView>
        )}

        {/* Tab Seçici */}
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
      </ScrollView>

      {/* Mobilde alttaki kompakt Teşhis Raporu butonu */}
      {!isDesktop && (
        <View style={[styles.mobileBottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity
            style={styles.mobileReportBtn}
            onPress={() => setSendModalVisible(true)}
            activeOpacity={0.85}
          >
            <Bug size={16} color="#fb923c" />
            <Text style={styles.mobileReportBtnText}>
              {t('settings:devPanelSendReportMobile', 'Hata & Teşhis Raporu Gönder')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mobilde 3-Nokta Eylem Menüsü */}
      <DevPanelActionsModal
        visible={mobileMenuVisible}
        onClose={() => setMobileMenuVisible(false)}
        onSendReport={() => setSendModalVisible(true)}
        onRefresh={refresh}
        onCopyReport={handleCopyReport}
      />

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
    backgroundColor: '#0e131d',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 0,
    paddingBottom: 40,
  },
  headerActionsWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendReportBtnWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sendReportBtnTextWeb: {
    color: '#fb923c',
    fontSize: 12,
    fontWeight: '700',
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  headerIconBtnMobile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  statsRowWeb: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statsScrollMobile: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    marginBottom: 12,
  },
  statCardFlex: {
    flex: 1,
  },
  statCardMobileItem: {
    minWidth: 100,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(27, 32, 42, 0.75)',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 10,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    color: '#8c90a0',
    fontSize: 12.5,
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
    backgroundColor: 'rgba(14, 19, 29, 0.95)',
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  mobileReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    borderRadius: 12,
    paddingVertical: 11,
  },
  mobileReportBtnText: {
    color: '#fb923c',
    fontSize: 13.5,
    fontWeight: '700',
  },
});

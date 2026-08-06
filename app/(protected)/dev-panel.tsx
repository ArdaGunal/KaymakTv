import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { Copy, Activity } from 'lucide-react-native';

import { SettingsHeader } from '../../components/settings/SettingsHeader';
import Snackbar from '../../components/Snackbar';
import StatCard from '../../components/devPanel/StatCard';
import PerformanceTab from '../../components/devPanel/PerformanceTab';
import ErrorsTab from '../../components/devPanel/ErrorsTab';
import SendReportButton from '../../components/devPanel/SendReportButton';
import { useDeveloperPanel } from '../../hooks/useDeveloperPanel';
import { confirmAsync } from '../../utils/confirmDialog';
import type { PerfCategory } from '../../utils/perfLog';

const DESKTOP_BREAKPOINT = 768;

type DevPanelTab = 'performance' | 'errors';

export default function DeveloperPanelScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation(['settings', 'common']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const {
    perfEntries,
    errorEntries,
    stats,
    categorySummaries,
    isLoading,
    isRefreshing,
    refresh,
    clearPerf,
    clearErrors,
  } = useDeveloperPanel();

  const [activeTab, setActiveTab] = useState<DevPanelTab>('performance');
  const [selectedCategory, setSelectedCategory] = useState<PerfCategory | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(protected)/(tabs)/explore');
  };

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <SettingsHeader title={t('settings:devPanelTitle', 'Geliştirici Paneli')} isDesktop={isDesktop} onBack={navigateBack} />

      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        {/* Üstteki 4 istatistik kartı — her zaman görünür, sekmeden bağımsız. */}
        <View style={styles.statsRow}>
          <StatCard value={stats.totalMeasurements} label={t('settings:devPanelStatMeasurements', 'Ölçüm')} />
          <StatCard
            value={stats.slowCount}
            label={t('settings:devPanelStatSlow', 'Yavaş (>500ms)')}
            accentColor="#f59e0b"
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

        <View style={styles.footer}>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyReport} activeOpacity={0.75}>
            <Copy size={15} color="#94a3b8" />
            <Text style={styles.copyButtonText}>{t('settings:devPanelCopyReport', 'Raporu Kopyala')}</Text>
          </TouchableOpacity>

          <SendReportButton perfEntries={perfEntries} errorEntries={errorEntries} onResult={showToast} />
        </View>
      </View>

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
  statsRow: {
    flexDirection: 'row',
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
  footer: {
    paddingTop: 12,
    paddingBottom: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  copyButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
});

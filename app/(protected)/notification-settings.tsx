import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAppBack } from '../../hooks/useAppBack';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { SettingsSection, SettingsSectionDivider } from '../../components/settings/SettingsSection';
import SettingsSwitchRow from '../../components/settings/SettingsSwitchRow';
import SettingsRow from '../../components/settings/SettingsRow';
import { Bell, Tv, Clock, AlertTriangle, Info, Smartphone, Sparkles, Film, PlayCircle, BarChart2, MessageCircle} from '../../components/icons';
import { useNotificationPrefs } from '../../features/notifications/hooks/useNotificationPrefs';
import type { NotificationCategoryId } from '../../features/notifications/types';

const DESKTOP_BREAKPOINT = 768;

/**
 * Ayarlar › Bildirimler (docs/design/notifications.md § 6).
 *
 * Bu dosya SADECE ÇİZİM YAPAR — tüm mantık
 * `features/notifications/hooks/useNotificationPrefs.ts` içinde (AGENTS.md
 * UI/Logic ayrımı). Ayrı bir ekran olmasının sebebi `account.tsx`'in zaten
 * 400 satır sınırı için bölünmüş olması (Madde 228).
 */

/** Kategori başına ikon. Yeni kategori eklenince buraya bir satır düşer. */
const CATEGORY_ICONS: Record<NotificationCategoryId, React.ReactNode> = {
  episodeToday: <Tv size={18} color="#3b82f6" />,
  seasonPremiere: <Sparkles size={18} color="#3b82f6" />,
  movieRelease: <Film size={18} color="#3b82f6" />,
  continueWatching: <PlayCircle size={18} color="#3b82f6" />,
  // 🆕 F3 sosyal (yorum/begeni). `MessageCircle` BILEREK secildi: lucide
  // diyetinden sonra (Madde 235, 1751 -> 93 ikon) yeni ikon eklemek
  // bundle'i buyutur; bu ikon `components/icons.ts` barrel'inda ZATEN var.
  social: <MessageCircle size={18} color="#3b82f6" />,
  monthlyStats: <BarChart2 size={18} color="#3b82f6" />,
};

/**
 * Seçilebilir bildirim saatleri. Serbest saat girişi yerine kısa bir liste:
 * spoiler korumasının anlamlı olduğu aralık zaten akşam saatleri, ve
 * 24 seçenekli bir çark bu ekranı gereksiz ağırlaştırırdı.
 */
const HOUR_OPTIONS = [9, 12, 18, 20, 21, 22];

export default function NotificationSettingsScreen() {
  const { t } = useTranslation('notifications');
  const navigateBack = useAppBack();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const {
    prefs,
    isHydrated,
    permission,
    categories,
    toggleMaster,
    toggleCategory,
    setPreferredHour,
    openSystemNotificationSettings,
  } = useNotificationPrefs();

  // Hidratlanmadan çizmek, kullanıcının kendi kapattığı bir anahtarı bir an
  // AÇIK göstermek ve ekranı gözünün önünde "zıplatmak" demek olurdu.
  if (!isHydrated || permission === null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <SettingsHeader title={t('screenTitle')} isDesktop={isDesktop} onBack={navigateBack} />
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  const permissionVisual =
    permission === 'granted'
      ? { icon: <Info size={18} color="#22c55e" />, tint: '#22c55e' }
      : permission === 'denied'
        ? { icon: <AlertTriangle size={18} color="#f59e0b" />, tint: '#f59e0b' }
        : { icon: <Smartphone size={18} color="#94a3b8" />, tint: '#94a3b8' };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <SettingsHeader title={t('screenTitle')} isDesktop={isDesktop} onBack={navigateBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* Sistem izni, uygulama içi tercihlerden AYRI bir eksendir: kullanıcı
            burada her şeyi açık bıraksa bile cihaz ayarından kapatmış
            olabilir. Sessiz kalmak yasak (AI_RULES). */}
        <SettingsSection title={t('sections.permission')}>
          <SettingsRow
            icon={permissionVisual.icon}
            tintColor={permissionVisual.tint}
            label={t(`permission.${permission}`)}
          />
          <SettingsSectionDivider />
          <View style={styles.hintBlock}>
            <Text style={styles.hintText}>{t(`permission.${permission}Hint`)}</Text>
            {permission === 'denied' && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={openSystemNotificationSettings}
                activeOpacity={0.75}
              >
                <Text style={styles.linkButtonText}>{t('permission.openSettings')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </SettingsSection>

        <SettingsSection title={t('sections.general')}>
          <SettingsSwitchRow
            icon={<Bell size={18} color="#3b82f6" />}
            tintColor="#3b82f6"
            label={t('master.label')}
            hint={t('master.hint')}
            value={prefs.masterEnabled}
            onValueChange={(next) => void toggleMaster(next)}
          />
        </SettingsSection>

        <SettingsSection title={t('sections.content')}>
          {categories.map((category, index) => (
            <React.Fragment key={category.id}>
              {index > 0 && <SettingsSectionDivider />}
              <SettingsSwitchRow
                icon={CATEGORY_ICONS[category.id]}
                tintColor="#3b82f6"
                label={t(`${category.i18nKey}.title`)}
                hint={t(`${category.i18nKey}.description`)}
                value={prefs.categories[category.id]}
                // Ana anahtar kapalıyken alt anahtarlar etkisizdir; bunu
                // görsel olarak da söylemek, "açtım ama gelmiyor" şikayetini
                // baştan engeller.
                disabled={!prefs.masterEnabled}
                onValueChange={(next) => void toggleCategory(category.id, next)}
              />
            </React.Fragment>
          ))}
        </SettingsSection>

        <SettingsSection title={t('sections.timing')}>
          <SettingsRow icon={<Clock size={18} color="#3b82f6" />} tintColor="#3b82f6" label={t('hour.label')} />
          <View style={styles.hintBlock}>
            <Text style={styles.hintText}>{t('hour.hint')}</Text>
            <View style={styles.chipRow}>
              {HOUR_OPTIONS.map((hour) => {
                const isSelected = prefs.preferredHour === hour;
                return (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.chip,
                      isSelected && styles.chipSelected,
                      !prefs.masterEnabled && styles.chipDisabled,
                    ]}
                    disabled={!prefs.masterEnabled}
                    onPress={() => setPreferredHour(hour)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {String(hour).padStart(2, '0')}:00
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0e131d',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  hintBlock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  hintText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.14)',
  },
  linkButtonText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipSelected: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
});

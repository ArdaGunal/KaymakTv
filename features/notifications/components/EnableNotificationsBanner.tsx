import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Bell, X } from '../../../components/icons';
import { useNotificationPrefs } from '../hooks/useNotificationPrefs';
import { usePushPrefsStore } from '../store/usePushPrefsStore';
import { shouldShowPromptBanner } from '../promptBanner';

/**
 * "Bildirimleri aç" hatırlatma şeridi (docs/design/notifications.md § 12).
 *
 * 🔴 BU BİR BİLDİRİM DEĞİL. Sistem diyaloğunu kendiliğinden açmaz; uygulama
 * içinde sessizce durur, kullanıcı DOKUNURSA açar. İzin diyaloğu zaten
 * uygulamaya ilk girişte bir kez gösteriliyor (§ 5) — bu şerit, o anı
 * kaçıran ya da "şimdi değil" diyen kullanıcı için ikinci, nazik bir kapı.
 *
 * Görünürlük kuralı burada DEĞİL, `promptBanner.ts`'te (saf ve test edilebilir).
 * Bir hatırlatmanın en kötü kusuru yanlış zamanda ısrar etmesidir; o karar
 * testle kilitli.
 */
export function EnableNotificationsBanner() {
  const { t } = useTranslation('notifications');
  const { permission, prefs, toggleMaster, openSystemNotificationSettings } = useNotificationPrefs();
  const dismissPromptBanner = usePushPrefsStore((state) => state.dismissPromptBanner);

  const visible = shouldShowPromptBanner({
    permission,
    masterEnabled: prefs.masterEnabled,
    dismissedAt: prefs.bannerDismissedAt,
    now: Date.now(),
  });

  const handlePress = useCallback(() => {
    if (permission === 'denied') {
      // İzin reddedilmişse sistem diyaloğu açılmaz; tek çıkış cihaz ayarları.
      void openSystemNotificationSettings();
      return;
    }
    // `toggleMaster(true)` izin akışını da tetikler (bkz. useNotificationPrefs).
    void toggleMaster(true);
  }, [permission, openSystemNotificationSettings, toggleMaster]);

  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.iconSlot}>
        <Bell size={16} color="#60a5fa" />
      </View>

      <TouchableOpacity style={styles.textWrap} onPress={handlePress} activeOpacity={0.75}>
        <Text style={styles.title}>{t('banner.title')}</Text>
        <Text style={styles.body}>{t('banner.body')}</Text>
        <Text style={styles.cta}>
          {permission === 'denied' ? t('banner.ctaDenied') : t('banner.cta')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={dismissPromptBanner}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={t('banner.dismiss')}
        style={styles.close}
      >
        <X size={16} color="#64748b" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bilinçli olarak SAKIN: kart zemininden yalnızca hafif bir mavi tonla
  // ayrılıyor. Uyarı sarısı/kırmızısı kullanmak, aciliyeti olmayan bir
  // hatırlatmayı hata gibi gösterirdi.
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
  },
  iconSlot: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(59,130,246,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, gap: 3 },
  title: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  body: { color: '#94a3b8', fontSize: 12, lineHeight: 17 },
  cta: { color: '#60a5fa', fontSize: 12, fontWeight: '700', marginTop: 4 },
  close: { paddingTop: 2 },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { CheckCircle2, LogIn } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { SettingsSection, SettingsSectionDivider } from './SettingsSection';

interface TraktAccountSectionProps {
  isConnected: boolean;
  onGoToLogin: () => void;
}

/**
 * "Hesap Ayarları" bölümü: Trakt bağlıysa durum banner'ı, değilse giriş
 * ekranına yönlendiren bir buton.
 *
 * ⚠️ BURADA OAUTH YOKTUR — ve bilinçli olarak olmamalıdır. Eskiden bu bileşen
 * kendi `useAuthRequest`/`exchangeAuthCode` akışını çalıştırıyordu, yani
 * uygulamada BİRBİRİNİN KOPYASI İKİ OAuth implementasyonu vardı
 * (`app/(public)/settings.tsx` ve `app/(protected)/account.tsx`). Bu ciddi
 * sorunlara yol açıyordu:
 *   • Trakt'a kayıtlı yönlendirme adresi TEK bir yol: `/settings`. Giriş
 *     `/account`'tan başlatılsa bile Trakt kodu `/settings`'e geri gönderiyor —
 *     yani akışı başlatan ekran ile kodu yakalayan ekran FARKLI oluyordu.
 *   • İki ekranın yakalayıcıları aynı tek-kullanımlık kodu iki kez değişmeye
 *     çalışıp `invalid_grant` üretebiliyordu.
 * Tek giriş noktası (`/settings`) bu sınıf hataların tamamını ortadan kaldırır;
 * kullanım koşulları onayı da orada TEK yerde zorlanır.
 */
export function TraktAccountSection({ isConnected, onGoToLogin }: TraktAccountSectionProps) {
  const { t } = useTranslation(['settings', 'common']);

  return (
    <SettingsSection title={t('accountSettings', 'Hesap Ayarları')}>
      {isConnected ? (
        <View style={styles.connectedBanner}>
          <View style={styles.connectedDot} />
          <Text style={styles.connectedText}>{t('settings:traktConnected')}</Text>
          <CheckCircle2 size={18} color="#4ade80" />
        </View>
      ) : (
        <>
          <View style={styles.notConnectedBanner}>
            <Text style={styles.notConnectedTitle}>{t('settings:traktNotConnectedTitle')}</Text>
            <Text style={styles.notConnectedSub}>{t('settings:traktNotConnectedSub')}</Text>
          </View>

          <SettingsSectionDivider />

          <TouchableOpacity
            style={styles.connectBtn}
            activeOpacity={0.82}
            onPress={onGoToLogin}
            accessibilityRole="button"
          >
            <LogIn size={18} color="#fff" />
            <Text style={styles.connectBtnText}>{t('settings:goToLogin', 'Giriş Yap')}</Text>
          </TouchableOpacity>
        </>
      )}
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  connectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  connectedText: {
    flex: 1,
    color: '#4ade80',
    fontWeight: '600',
    fontSize: 14,
  },
  notConnectedBanner: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 6,
  },
  notConnectedTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  notConnectedSub: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 20,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    margin: 16,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 54,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  connectBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

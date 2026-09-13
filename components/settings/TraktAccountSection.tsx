import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { CheckCircle2, LogIn } from '../icons';
import { useTranslation } from 'react-i18next';
import { SettingsSection } from './SettingsSection';

interface TraktAccountSectionProps {
  isConnected: boolean;
  onGoToLogin: () => void;
}

/**
 * Ayarlar → Hesap Ayarları → "Trakt Hesabı".
 *
 * 📍 **KONUM (kullanıcı kararı, 2026-09-12):** ana Ayarlar ekranından Hesap
 * Ayarları'na taşındı; Google kullanıcısının Trakt'a bağlanma yolu da burada.
 * Ana ekran sadeleşti.
 *
 * 🎚️ **SADE DÜZEN (aynı karar):** eskiden 52 piksellik bir buton + iki
 * satırlık afiş vardı ve bölüm ekranın üçte birini kaplıyordu. Artık bağlıysa
 * TEK satır (diğer ayar satırlarıyla aynı dil), değilse kısa bir açıklama +
 * İNCE ama birincil renkli, ikonlu bir buton — "giriş butonu gibi görünsün"
 * isteği bu yüzden renk ve ikonla korunuyor, yalnızca hacim küçüldü.
 */
export function TraktAccountSection({ isConnected, onGoToLogin }: TraktAccountSectionProps) {
  const { t } = useTranslation(['settings', 'common']);

  return (
    <SettingsSection title={t('settings:traktAccountSection', 'Trakt Hesabı')}>
      {isConnected ? (
        <View style={styles.durumSatiri}>
          <CheckCircle2 size={17} color="#4ade80" />
          <Text style={styles.durumMetin}>{t('settings:traktConnected')}</Text>
        </View>
      ) : (
        <View style={styles.govde}>
          <Text style={styles.aciklama}>{t('settings:traktNotConnectedSub')}</Text>
          <TouchableOpacity
            style={styles.dugme}
            activeOpacity={0.85}
            onPress={onGoToLogin}
            accessibilityRole="button"
          >
            <LogIn size={15} color="#fff" strokeWidth={2.2} />
            <Text style={styles.dugmeMetin}>{t('settings:goToLogin', 'Giriş Yap')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  durumSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  durumMetin: {
    flex: 1,
    color: '#4ade80',
    fontWeight: '600',
    fontSize: 13.5,
  },
  govde: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  aciklama: {
    color: '#8c90a0',
    fontSize: 12.5,
    lineHeight: 18,
  },
  dugme: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 9,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  dugmeMetin: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13.5,
  },
});

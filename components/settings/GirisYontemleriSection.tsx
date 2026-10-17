import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, LogIn } from '../icons';
import { SettingsSection } from './SettingsSection';
import GoogleBaglaDugmesi from './GoogleBaglaDugmesi';
import { useGirisYontemleri } from '../../hooks/useGirisYontemleri';
import { GOOGLE_GIRIS_ACIK } from '../../utils/googleGirisBayragi';

/**
 * Ayarlar → Hesap Ayarları → «Giriş yöntemleri» (Kimlik Faz 5, M520 · D3).
 * Eski «Trakt Hesabı» bölümünün YERİNE: Google-only kişinin «Trakt'a bağlan» düğmesi
 * eskiden giriş ekranına götürüyor ve orada AYRI bir hesap açılıyordu (bölünme yolu 2).
 * Trakt adı yalnız burada, bilgi olarak (PROFIL-AD-01). Google satırı Google girişi
 * açık değilken yalnız «bağlı» durumunu gösterir — bağlama düğmesi GIRIS-G-02 ile açılır.
 */
export function GirisYontemleriSection() {
  const { t } = useTranslation(['settings', 'common']);
  const y = useGirisYontemleri();

  return (
    <SettingsSection title={t('settings:girisYontemleriBaslik')}>
      <View style={styles.satir}>
        <Text style={styles.ad}>Trakt</Text>
        {y.traktBagli ? (
          <Bagli metin={y.traktAdi ? t('settings:traktBagliHesap', { ad: y.traktAdi }) : t('settings:traktConnected')} />
        ) : (
          <View style={styles.govde}>
            <Text style={styles.aciklama}>{t('settings:traktBaglaAciklama')}</Text>
            <TouchableOpacity style={styles.dugme} onPress={y.traktBaglaBaslat} activeOpacity={0.85} accessibilityRole="button">
              <LogIn size={15} color="#fff" strokeWidth={2.2} />
              <Text style={styles.dugmeMetin}>{t('settings:traktBagla')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {(y.googleBagli || GOOGLE_GIRIS_ACIK) && (
        <View style={[styles.satir, styles.ayrac]}>
          <Text style={styles.ad}>Google</Text>
          {y.googleBagli ? (
            <Bagli metin={t('settings:googleBagliMetin')} />
          ) : (
            <View style={styles.govde}>
              <Text style={styles.aciklama}>{t('settings:googleBaglaAciklama')}</Text>
              <GoogleBaglaDugmesi onToken={y.googleIleBagla} calisiyor={y.calisiyor} />
            </View>
          )}
        </View>
      )}
    </SettingsSection>
  );
}

function Bagli({ metin }: { metin: string }) {
  return (
    <View style={styles.bagli}>
      <CheckCircle2 size={16} color="#4ade80" />
      <Text style={styles.bagliMetin} numberOfLines={1}>{metin}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  satir: { paddingHorizontal: 16, paddingVertical: 13, gap: 8 },
  ayrac: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(148,163,184,0.18)' },
  ad: { color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  govde: { gap: 10 },
  aciklama: { color: '#8c90a0', fontSize: 12.5, lineHeight: 18 },
  bagli: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bagliMetin: { flex: 1, color: '#4ade80', fontWeight: '600', fontSize: 13 },
  dugme: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: '#2563eb', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 9,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  dugmeMetin: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
});

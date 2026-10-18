import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Tv } from '../icons';

/**
 * GIRIS-TASARIM-01 (M536) — giriş ekranında Google düğmesiyle AYNI ölçü ve ağırlık.
 * Kullanıcı (2026-10-18): «Aynı boyutta, hizalı ve temiz iki düğme». Web'de Google düğmesini
 * Google'ın kendi betiği çiziyor (`useGoogleSignIn` — `filled_black`, `large` = 40 px, genişlik
 * `GIRIS_DUGME_GENISLIK_WEB`); bu düğme onun ölçüsüne ve koyu zeminine uyar. Mobilde iki
 * düğme de tam genişlik, 48 px.
 */
export const GIRIS_DUGME_GENISLIK_WEB = 280;
const YUKSEKLIK = Platform.OS === 'web' ? 40 : 48;

interface Props {
  etkin: boolean;
  yukleniyor: boolean;
  onPress: () => void;
}

export default function TraktGirisDugmesi({ etkin, yukleniyor, onPress }: Props) {
  const { t } = useTranslation('settings');
  return (
    <TouchableOpacity
      style={[styles.dugme, !etkin && styles.pasif]}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={!etkin || yukleniyor}
      accessibilityRole="button"
    >
      <View style={styles.simge}>
        <Tv size={16} color="#ffffff" />
      </View>
      {yukleniyor ? (
        <ActivityIndicator size="small" color="#fff" style={styles.metinAlani} />
      ) : (
        <Text style={[styles.metin, styles.metinAlani]}>{t('traktIleDevam')}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dugme: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: Platform.OS === 'web' ? GIRIS_DUGME_GENISLIK_WEB : '100%',
    height: YUKSEKLIK,
    borderRadius: Platform.OS === 'web' ? 4 : 8,
    backgroundColor: '#202124',
    borderWidth: 1,
    borderColor: '#3c4043',
    paddingHorizontal: 4,
  },
  pasif: { opacity: 0.45 },
  simge: {
    width: YUKSEKLIK - 10,
    height: YUKSEKLIK - 10,
    borderRadius: 3,
    backgroundColor: '#ed1c24', // Trakt'ın kendi rengi — düğme bir bakışta tanınsın
    alignItems: 'center',
    justifyContent: 'center',
  },
  metinAlani: { flex: 1, textAlign: 'center', marginRight: YUKSEKLIK - 10 },
  metin: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});

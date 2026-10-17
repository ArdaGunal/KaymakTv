import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { googleGirisHataMetni, useGoogleNativeSignIn } from '../../hooks/useGoogleNativeSignIn';

interface Props {
  /** ID token (web'de nonce ile) hazır olunca — bağlama `useGirisYontemleri`'nde. */
  onToken: (idToken: string, nonce?: string) => void;
  calisiyor: boolean;
}

/**
 * Kimlik Faz 5 (M520) — Trakt'lı hesaba Google bağlama düğmesi. Yalnız GÖRÜNÜM + kimlik
 * kanıtı (ID token); karar sunucuda. Web: GIS düğmesi (nonce'lu), native: yerel Google girişi.
 */
export default function GoogleBaglaDugmesi(props: Props) {
  return Platform.OS === 'web' ? <Web {...props} /> : <Native {...props} />;
}

function Web({ onToken, calisiyor }: Props) {
  const { t } = useTranslation('common');
  const { buttonElementId, loadError } = useGoogleSignIn((idToken, nonce) => onToken(idToken, nonce));
  return (
    <View style={styles.wrap}>
      {/* GIS konteyneri koşullu çizilmez (Madde 231) — çalışırken yalnız gizlenir. */}
      <View pointerEvents={calisiyor ? 'none' : 'auto'} style={calisiyor ? styles.gizli : undefined}>
        <View nativeID={buttonElementId} style={styles.gis} />
      </View>
      {calisiyor && <ActivityIndicator size="small" color="#94a3b8" />}
      {loadError && <Text style={styles.hata}>{t('googleLoadError')}</Text>}
    </View>
  );
}

function Native({ onToken, calisiyor }: Props) {
  const { t } = useTranslation(['settings', 'common']);
  const { signIn } = useGoogleNativeSignIn();
  const [hata, setHata] = useState<string | null>(null);
  const bas = async () => {
    setHata(null);
    const s = await signIn();
    if (s.ok) onToken(s.idToken);
    else if (!s.cancelled) setHata(googleGirisHataMetni(t, s.neden));
  };
  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.dugme} onPress={bas} disabled={calisiyor} activeOpacity={0.85} accessibilityRole="button">
        {calisiyor ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.dugmeMetin}>{t('settings:googleBagla')}</Text>}
      </TouchableOpacity>
      {hata && <Text style={styles.hata}>{hata}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, alignItems: 'flex-start' },
  gis: { minHeight: 44 },
  gizli: { opacity: 0, height: 0 },
  dugme: { backgroundColor: '#2563eb', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 9, minWidth: 140, alignItems: 'center' },
  dugmeMetin: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  hata: { color: '#f87171', fontSize: 12.5 },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { googleGirisHataMetni, useGoogleNativeSignIn } from '../../hooks/useGoogleNativeSignIn';
import type { useGoogleHesapGiris } from '../../hooks/useGoogleHesapGiris';
import { logError } from '../../utils/errorLog';

interface Props {
  /** Kullanım koşulları onaylanmadan basılamaz (Trakt düğmesiyle aynı kapı). */
  etkin: boolean;
  /**
   * GIRIS-TASARIM-01 (M536): durum ÜST EKRANDA tutulur (`settings.tsx`) — «Trakt ile devam et»
   * kutusu açılınca ekran öbür düğmeleri gizleyebilsin. Kutu artık burada çizilmiyor
   * (`TraktIleGirKutusu.tsx`); eskiden ana Trakt düğmesinin altına ikinci bir Trakt düğmesi çıkıyordu.
   */
  giris: ReturnType<typeof useGoogleHesapGiris>;
}

/**
 * Giriş ekranındaki «Google ile devam et» düğmesi (M501 — BACKLOG §G1 perdesi
 * kalktı). Yalnız GÖRÜNÜM; mantık `useGoogleHesapGiris`'te.
 */
export default function GoogleGirisDugmesi(props: Props) {
  return Platform.OS === 'web' ? <GoogleGirisWeb {...props} /> : <GoogleGirisNative {...props} />;
}

function GoogleGirisWeb({ etkin, giris }: Props) {
  const { t } = useTranslation('common');
  const { girisYap, durum, hata } = giris;
  const { buttonElementId, loadError } = useGoogleSignIn((idToken, nonce) => {
    void girisYap(idToken, nonce);
  });

  return (
    <View style={styles.wrap}>
      {/* ⛔ GIS konteyneri KOŞULLU YAPILMAZ — Madde 231: GIS'in çizdiği düğme
          unmount edilirse bir daha çizilmiyor. Onay yokken yalnız soluk ve
          dokunulmaz; çalışırken gizli. */}
      <View
        pointerEvents={etkin && durum === 'bos' ? 'auto' : 'none'}
        style={[styles.gisOuter, !etkin && styles.pasif, durum !== 'bos' && styles.gizli]}
      >
        <View nativeID={buttonElementId} style={styles.gisContainer} />
      </View>
      {durum === 'calisiyor' && <Calisiyor />}
      {hata && <Text style={styles.error}>{hata}</Text>}
      {loadError && durum === 'bos' && <Text style={styles.error}>{t('googleLoadError')}</Text>}
    </View>
  );
}

function GoogleGirisNative({ etkin, giris }: Props) {
  const { t } = useTranslation('common');
  const { girisYap, durum, hata } = giris;
  const { signIn } = useGoogleNativeSignIn();
  const [yerelHata, setYerelHata] = useState<string | null>(null);

  const bas = async () => {
    setYerelHata(null);
    const sonuc = await signIn();
    if (!sonuc.ok) {
      // Kullanıcının kendi iptali hata değil — kırmızı metin gösterilmez.
      if (!sonuc.cancelled) {
        logError('googleGiris.native.signIn', new Error(`google_native:${sonuc.neden}:${sonuc.kod ?? '-'}`));
        setYerelHata(googleGirisHataMetni(t, sonuc.neden));
      }
      return;
    }
    await girisYap(sonuc.idToken);
  };

  return (
    <View style={styles.wrap}>
      {durum === 'bos' && (
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Dark}
          onPress={bas}
          disabled={!etkin}
          style={[styles.nativeButton, !etkin && styles.pasif]}
        />
      )}
      {durum === 'calisiyor' && <Calisiyor />}
      {(hata || yerelHata) && <Text style={styles.error}>{hata || yerelHata}</Text>}
    </View>
  );
}

function Calisiyor() {
  const { t } = useTranslation('common');
  return (
    <View style={styles.row}>
      <ActivityIndicator size="small" color="#94a3b8" />
      <Text style={styles.info}>{t('googleSigningIn')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  gisOuter: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  gisContainer: { minHeight: 44 },
  gizli: { opacity: 0, height: 0 },
  pasif: { opacity: 0.45 },
  // M536: Trakt düğmesiyle AYNI ölçü (settings.tsx `GIRIS_DUGME_YUKSEKLIK_NATIVE`).
  nativeButton: { width: '100%', height: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  info: { color: '#94a3b8', fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { googleGirisHataMetni, useGoogleNativeSignIn } from '../../hooks/useGoogleNativeSignIn';
import { useGoogleHesapGiris } from '../../hooks/useGoogleHesapGiris';
import { logError } from '../../utils/errorLog';

interface Props {
  /** Kullanım koşulları onaylanmadan basılamaz (Trakt düğmesiyle aynı kapı). */
  etkin: boolean;
  /** Kimlik Faz 3 (D2): Google hesabı Trakt'lı bir hesaba bağlıysa gösterilen «Trakt ile Gir». */
  onTraktIleGir: () => void;
}

/**
 * Giriş ekranındaki «Google ile giriş» düğmesi (M501 — BACKLOG §G1 perdesi
 * kalktı). Yalnız GÖRÜNÜM; mantık `useGoogleHesapGiris`'te.
 */
export default function GoogleGirisDugmesi(props: Props) {
  return Platform.OS === 'web' ? <GoogleGirisWeb {...props} /> : <GoogleGirisNative {...props} />;
}

/** D2 — «Bu Google hesabı Trakt'lı bir hesaba bağlı» + Trakt ile Gir + Vazgeç. */
function TraktIleGirKutusu({ onTraktIleGir, sifirla }: { onTraktIleGir: () => void; sifirla: () => void }) {
  const { t } = useTranslation(['common', 'settings']);
  return (
    <View style={styles.kutu}>
      <Text style={styles.kutuMetin}>{t('common:googleTraktIleGir')}</Text>
      <TouchableOpacity style={styles.traktDugme} onPress={onTraktIleGir} activeOpacity={0.8} accessibilityRole="button">
        <Text style={styles.traktDugmeMetin}>{t('settings:loginTrakt')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={sifirla} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button">
        <Text style={styles.vazgec}>{t('settings:cancel')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function GoogleGirisWeb({ etkin, onTraktIleGir }: Props) {
  const { t } = useTranslation('common');
  const { girisYap, durum, hata, sifirla } = useGoogleHesapGiris();
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
      {durum === 'trakt_ile_gir' && <TraktIleGirKutusu onTraktIleGir={onTraktIleGir} sifirla={sifirla} />}
      {hata && <Text style={styles.error}>{hata}</Text>}
      {loadError && durum === 'bos' && <Text style={styles.error}>{t('googleLoadError')}</Text>}
    </View>
  );
}

function GoogleGirisNative({ etkin, onTraktIleGir }: Props) {
  const { t } = useTranslation('common');
  const { girisYap, durum, hata, sifirla } = useGoogleHesapGiris();
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
      {durum === 'trakt_ile_gir' && <TraktIleGirKutusu onTraktIleGir={onTraktIleGir} sifirla={sifirla} />}
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
  wrap: { alignItems: 'center', gap: 8, marginTop: 12 },
  gisOuter: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  gisContainer: { minHeight: 44 },
  gizli: { opacity: 0, height: 0 },
  pasif: { opacity: 0.45 },
  nativeButton: { width: '100%', height: 52 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  info: { color: '#94a3b8', fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
  kutu: { width: '100%', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)' },
  kutuMetin: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  traktDugme: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb' },
  traktDugmeMetin: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  vazgec: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
});

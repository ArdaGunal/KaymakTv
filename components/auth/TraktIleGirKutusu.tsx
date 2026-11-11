import { nativeColor } from '../../constants/mobilePalette';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation, Trans } from 'react-i18next';
import type { GoogleBagliHesap } from '../../services/api/googleAuth';
import Avatar from '../Avatar';

interface Props {
  /** Worker'ın döndürdüğü kendi profil (@ad, #no); eski Worker'da null → adsız metin. */
  hesap: GoogleBagliHesap | null;
  onTraktIleDevam: () => void;
  onBaskaHesap: () => void;
}

/**
 * GIRIS-TASARIM-01 (M536) · D2 — Trakt'lı hesaba Google ile basılınca çıkan kutu.
 *
 * Kullanıcı kararı (2026-10-18): soyut metin değil, kişinin KENDİ profili görünsün
 * («kendi adını görünce doğru yerde olduğunu hemen anlayacak»); arkadaki giriş düğmeleri
 * gizlenir (`settings.tsx`), ekranda tek birincil «Trakt ile devam et» + ikincil
 * «Başka bir hesapla dene» kalır. Eskiden kutu ana Trakt düğmesinin ALTINA çiziliyordu —
 * ekranda iki «Trakt ile Giriş Yap» görünüyordu.
 */
export default function TraktIleGirKutusu({ hesap, onTraktIleDevam, onBaskaHesap }: Props) {
  const { t } = useTranslation(['settings']);
  const ad = hesap ? `@${hesap.username}` : null;
  return (
    <View style={styles.kutu}>
      {ad && (
        <View style={styles.profil}>
          <Avatar ad={hesap!.username} size={44} />
          <View style={styles.profilMetin}>
            <Text style={styles.ad} numberOfLines={1}>{ad}</Text>
            {hesap!.kaymakNo != null && <Text style={styles.no}>#{hesap!.kaymakNo}</Text>}
            {/* GIRIS-KILIT-02: az önce seçilen Gmail — yanlış Google hesabı seçildiyse kişi burada fark etsin. */}
            {hesap!.googleEmail && (
              <Text style={styles.no} numberOfLines={1}>{t('settings:uyusmazlikGoogleSatiri', { email: hesap!.googleEmail })}</Text>
            )}
            {/* GIRIS-KILIT-01: beklenen Trakt hesabı — trakt.tv'de başka hesap açıksa kişi önceden fark etsin. */}
            {hesap!.traktSlug && (
              <Text style={styles.no} numberOfLines={1}>{t('settings:kartTraktHesabi', { slug: hesap!.traktSlug })}</Text>
            )}
          </View>
        </View>
      )}
      <Text style={styles.metin}>
        {/* GIRIS-KILIT-02: Trakt adı biliniyorsa NE yapacağını söyle — Trakt giriş ekranı açılacak. */}
        {hesap?.traktSlug ? (
          <Trans i18nKey="settings:traktIleDevamKutuTraktli" values={{ trakt: hesap.traktSlug }} components={{ 1: <Text style={styles.kalin} /> }} />
        ) : ad ? t('settings:traktIleDevamKutuAdli', { ad }) : t('settings:traktIleDevamKutuAdsiz')}
      </Text>
      <TouchableOpacity style={styles.birincil} onPress={onTraktIleDevam} activeOpacity={0.85} accessibilityRole="button">
        <Text style={styles.birincilMetin}>{t('settings:traktIleDevam')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBaskaHesap} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
        <Text style={styles.ikincil}>{t('settings:baskaHesaplaDene')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  kutu: { width: '100%', alignItems: 'center', gap: 16, paddingVertical: 8 },
  profil: {
    flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch',
    padding: 14, borderRadius: 12, backgroundColor: nativeColor('surface', '#0f172a'), borderWidth: 1, borderColor: nativeColor('border', '#334155'),
  },
  profilMetin: { flex: 1, gap: 2 },
  ad: { color: nativeColor('text', '#f8fafc'), fontSize: 18, fontWeight: '700' },
  no: { color: nativeColor('muted', '#94a3b8'), fontSize: 14, fontWeight: '600' },
  metin: { color: nativeColor('body', '#cbd5e1'), fontSize: 15, lineHeight: 22, textAlign: 'center' },
  kalin: { fontWeight: '800', color: nativeColor('text', '#ffffff') },
  birincil: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 10, backgroundColor: nativeColor('primary', '#2563eb') },
  birincilMetin: { color: nativeColor('text', '#ffffff'), fontSize: 16, fontWeight: '700' },
  ikincil: { color: nativeColor('muted', '#94a3b8'), fontSize: 14, fontWeight: '600' },
});

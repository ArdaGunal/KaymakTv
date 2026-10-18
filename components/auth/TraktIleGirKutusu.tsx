import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
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
          </View>
        </View>
      )}
      <Text style={styles.metin}>
        {ad ? t('settings:traktIleDevamKutuAdli', { ad }) : t('settings:traktIleDevamKutuAdsiz')}
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
    padding: 14, borderRadius: 12, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155',
  },
  profilMetin: { flex: 1, gap: 2 },
  ad: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  no: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  metin: { color: '#cbd5e1', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  birincil: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 10, backgroundColor: '#2563eb' },
  birincilMetin: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  ikincil: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
});

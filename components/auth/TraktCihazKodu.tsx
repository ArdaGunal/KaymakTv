import { nativeColor } from '../../constants/mobilePalette';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CihazDurumu } from '../../hooks/useTraktCihazGirisi';
import { koduBicimle } from '../../services/auth/traktCihazOturumu';

/**
 * Trakt cihaz kodu — bekleme ekranı (`docs/design/TRAKT_CIHAZ_KODU_PLANI.md` §3.3). Yalnız gösterir;
 * durum ve yoklama `useTraktCihazGirisi`'nde.
 *
 * M622 · kullanıcı (2026-11-14): «en sade kişinin kullanabileceği şekilde; insanlar direkt girmek ister,
 * kimse ordan oraya kod alayım istemez». Kod alınınca Trakt KENDİLİĞİNDEN açılır ve kod panoya kopyalanır;
 * bu ekran yalnız kişi dönünce görünür: başlık + tek cümle (giriş ekranının başlık alanında), küçük kod
 * kutusu, «Trakt sayfasını tekrar aç», «Vazgeç». Maddeli kılavuz yok, geri sayım yok.
 */
interface Props {
  durum: CihazDurumu;
  kopyalandi: boolean;
  onTekrarAc: () => void;
  onYeniKod: () => void;
  onVazgec: () => void;
}

export default function TraktCihazKodu({ durum, kopyalandi, onTekrarAc, onYeniKod, onVazgec }: Props) {
  const { t } = useTranslation('settings');

  if (durum.tur === 'kod_aliniyor' || durum.tur === 'tamamlaniyor') {
    return (
      <View style={styles.kutu}>
        <ActivityIndicator color={nativeColor('text', '#ffffff')} />
        <Text style={styles.not}>{t(durum.tur === 'kod_aliniyor' ? 'cihazKodAliniyor' : 'cihazGirisYapiliyor')}</Text>
      </View>
    );
  }

  if (durum.tur === 'bekliyor') {
    const { oturum, cevrimdisi } = durum;
    return (
      <View style={styles.kutu}>
        <View style={styles.kodKutusu}>
          <Text style={styles.kodEtiketi}>{t(kopyalandi ? 'cihazKodKopyalandi' : 'cihazKodEtiketi')}</Text>
          <Text style={styles.kod} selectable accessibilityLabel={oturum.userCode.split('').join(' ')}>
            {koduBicimle(oturum.userCode)}
          </Text>
        </View>

        {cevrimdisi && <Text style={styles.not}>{t('cihazBaglantiBekleniyor')}</Text>}
        {oturum.mod === 'baglama' && <Text style={styles.not}>{t('baglamaModuNotu')}</Text>}

        <TouchableOpacity style={styles.ikincilDugme} onPress={onTekrarAc} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.ikincilDugmeMetin}>{t('cihazTekrarAc')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onVazgec} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
          <Text style={styles.baglanti}>{t('cihazVazgec')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (durum.tur === 'bos') return null;

  const mesaj = {
    suresi_doldu: 'cihazSuresiDoldu',
    reddedildi: 'cihazReddedildi',
    yeni_kod: 'cihazYeniKodGerekli',
    kod_alinamadi: 'cihazKodAlinamadi',
  }[durum.tur];
  return (
    <View style={styles.kutu}>
      <Text style={styles.mesaj}>{t(mesaj)}</Text>
      <TouchableOpacity style={styles.birincil} onPress={onYeniKod} activeOpacity={0.85} accessibilityRole="button">
        <Text style={styles.birincilMetin}>{t('cihazTekrarDene')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onVazgec} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
        <Text style={styles.baglanti}>{t('cihazVazgec')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  kutu: { width: '100%', alignItems: 'center', gap: 14, paddingVertical: 8 },
  kodKutusu: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 4,
  },
  kodEtiketi: { color: nativeColor('muted', '#94a3b8'), fontSize: 13 },
  kod: {
    color: nativeColor('text', '#ffffff'),
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  not: { color: nativeColor('muted', '#94a3b8'), fontSize: 13, textAlign: 'center' },
  mesaj: { color: nativeColor('text', '#e5e7eb'), fontSize: 15, textAlign: 'center', lineHeight: 22 },
  ikincilDugme: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3c4043',
    backgroundColor: '#202124',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ikincilDugmeMetin: { color: nativeColor('text', '#ffffff'), fontSize: 15, fontWeight: '600' },
  birincil: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    backgroundColor: '#ed1c24', // Trakt'ın rengi (TraktGirisDugmesi ile aynı)
    alignItems: 'center',
    justifyContent: 'center',
  },
  birincilMetin: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  baglanti: { color: nativeColor('muted', '#94a3b8'), fontSize: 14, textDecorationLine: 'underline' },
});

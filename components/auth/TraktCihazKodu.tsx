import { nativeColor } from '../../constants/mobilePalette';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CihazDurumu } from '../../hooks/useTraktCihazGirisi';
import { koduBicimle, kalanSureMetni } from '../../services/auth/traktCihazOturumu';

/**
 * Trakt cihaz kodu ekranı (`docs/design/TRAKT_CIHAZ_KODU_PLANI.md` §3.3). Yalnız gösterir; durum ve
 * yoklama `useTraktCihazGirisi`'nde. «Trakt'ta onayla» kodu panoya kopyalar ve onay sayfasını sıradan
 * tarayıcıda açar (adres kodu da taşır: Trakt girişten sonra kutuya doldurur — ölçüldü 2026-11-14).
 */
interface Props {
  durum: CihazDurumu;
  onTrakttaOnayla: () => Promise<boolean>;
  onYeniKod: () => void;
  onVazgec: () => void;
}

const KOPYALANDI_SURE_MS = 4000;

export default function TraktCihazKodu({ durum, onTrakttaOnayla, onYeniKod, onVazgec }: Props) {
  const { t } = useTranslation('settings');
  const [simdi, setSimdi] = useState(Date.now());
  const [kopyalandi, setKopyalandi] = useState(false);
  const bekliyor = durum.tur === 'bekliyor';

  // Kalan süre her saniye.
  useEffect(() => {
    if (!bekliyor) return;
    const z = setInterval(() => setSimdi(Date.now()), 1000);
    return () => clearInterval(z);
  }, [bekliyor]);

  useEffect(() => {
    if (!kopyalandi) return;
    const z = setTimeout(() => setKopyalandi(false), KOPYALANDI_SURE_MS);
    return () => clearTimeout(z);
  }, [kopyalandi]);

  const onayla = async () => {
    if (await onTrakttaOnayla()) setKopyalandi(true);
  };

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
        <Text style={styles.adim}>{t('cihazAdim1')}</Text>
        <Text style={styles.adim}>{t('cihazAdim2')}</Text>
        <Text style={styles.adim}>{t('cihazAdim3')}</Text>

        <Text style={styles.etiket}>{t('cihazKodEtiketi')}</Text>
        <Text style={styles.kod} selectable accessibilityLabel={oturum.userCode.split('').join(' ')}>
          {koduBicimle(oturum.userCode)}
        </Text>
        <Text style={styles.not}>{t('cihazKalanSure', { sure: kalanSureMetni(oturum.bitisMs, simdi) })}</Text>

        <TouchableOpacity style={styles.birincil} onPress={onayla} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.birincilMetin}>{t('cihazTrakttaOnayla')}</Text>
        </TouchableOpacity>
        {kopyalandi && <Text style={styles.olumlu}>{t('cihazKopyalandi')}</Text>}

        <View style={styles.bekleSatiri}>
          <ActivityIndicator size="small" color={nativeColor('muted', '#94a3b8')} />
          <Text style={styles.not}>{t(cevrimdisi ? 'cihazBaglantiBekleniyor' : 'cihazOnayBekleniyor')}</Text>
        </View>
        {oturum.mod === 'baglama' && <Text style={styles.not}>{t('baglamaModuNotu')}</Text>}

        <TouchableOpacity onPress={onVazgec} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
          <Text style={styles.ikincil}>{t('cihazVazgec')}</Text>
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
        <Text style={styles.birincilMetin}>{t('cihazYeniKodAl')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onVazgec} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
        <Text style={styles.ikincil}>{t('cihazVazgec')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  kutu: { width: '100%', alignItems: 'center', gap: 10, paddingVertical: 8 },
  adim: { alignSelf: 'stretch', color: nativeColor('text', '#e5e7eb'), fontSize: 14, lineHeight: 20 },
  etiket: { marginTop: 10, color: nativeColor('muted', '#94a3b8'), fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  kod: {
    color: nativeColor('text', '#ffffff'),
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  not: { color: nativeColor('muted', '#94a3b8'), fontSize: 13, textAlign: 'center' },
  olumlu: { color: '#22c55e', fontSize: 13, textAlign: 'center' },
  mesaj: { color: nativeColor('text', '#e5e7eb'), fontSize: 15, textAlign: 'center', lineHeight: 22 },
  bekleSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  birincil: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    backgroundColor: '#ed1c24', // Trakt'ın rengi (TraktGirisDugmesi ile aynı)
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  birincilMetin: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  ikincil: { color: nativeColor('muted', '#94a3b8'), fontSize: 14, marginTop: 8, textDecorationLine: 'underline' },
});

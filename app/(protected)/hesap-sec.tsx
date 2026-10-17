import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import HesapKarti from '../../components/hesapSec/HesapKarti';
import KaydirarakOnay from '../../components/KaydirarakOnay';
import { AlertTriangle } from '../../components/icons';
import { useHesapSec } from '../../hooks/useHesapSec';

/**
 * Kimlik Faz 5 (M520) · D3 — «Hesap Seç». Kullanıcı (2026-10-12): iki hesap çakışınca kişi
 * birini seçer; *«Diğer hesabınızdaki bütün bilgiler silinecektir diye 2. bir ayrı uyarı
 * ekranı… kaydırmalı bir şey koyarız, kaydırınca buton aktif olur»*. Birleştirme (C) → V3.0.
 * Yalnız GÖRÜNÜM; akış `hooks/useHesapSec.ts`, karar ve silme sunucuda (068, tek işlem).
 */
export default function HesapSecEkrani() {
  const { t } = useTranslation(['settings', 'common']);
  const h = useHesapSec();

  if (!h.durum) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SettingsHeader title={t('settings:hesapSecBaslik')} isDesktop={false} onBack={h.vazgec} />
        <View style={styles.bos}>
          <Text style={styles.aciklama}>{t('settings:hesapSecSureDoldu')}</Text>
          <TouchableOpacity style={styles.ikincil} onPress={h.vazgec}><Text style={styles.ikincilMetin}>{t('common:back', 'Geri')}</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { mevcut, diger } = h.durum.hesaplar;
  const yontemAdi = h.durum.yontem === 'trakt' ? 'Trakt' : 'Google';
  const silinecek = h.secim === 'mevcut' ? diger : mevcut;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader title={t('settings:hesapSecBaslik')} isDesktop={false} onBack={h.adim === 'uyari' ? h.geri : h.vazgec} />
      <ScrollView contentContainerStyle={styles.icerik}>
        {h.adim === 'sec' ? (
          <>
            <Text style={styles.aciklama}>{t('settings:hesapSecAciklama', { yontem: yontemAdi })}</Text>
            <HesapKarti hesap={mevcut} etiket={t('settings:hesapKartiMevcut')} secili={h.secim === 'mevcut'} onSec={() => h.setSecim('mevcut')} />
            <HesapKarti hesap={diger} etiket={t('settings:hesapKartiDiger', { yontem: yontemAdi })} secili={h.secim === 'diger'} onSec={() => h.setSecim('diger')} />
            <TouchableOpacity style={[styles.birincil, !h.secim && styles.pasif]} onPress={h.devam} disabled={!h.secim} accessibilityRole="button">
              <Text style={styles.birincilMetin}>{t('settings:hesapSecDevam')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ikincil} onPress={h.vazgec} accessibilityRole="button">
              <Text style={styles.ikincilMetin}>{t('common:cancel')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.uyari}>
              <AlertTriangle size={28} color="#f87171" />
              <Text style={styles.uyariBaslik}>{t('settings:hesapSecUyariBaslik')}</Text>
              <Text style={styles.uyariMetin}>
                {t('settings:hesapSecUyariMetin', { ad: silinecek.username, no: silinecek.kaymakNo ?? '—' })}
              </Text>
            </View>
            <KaydirarakOnay
              metin={t('settings:kaydirOnayMetin')}
              tamamMetni={t('settings:kaydirOnayTamam')}
              onTamam={() => h.setKaydirildi(true)}
              devreDisi={h.calisiyor}
            />
            <TouchableOpacity
              style={[styles.sil, (!h.kaydirildi || h.calisiyor) && styles.pasif]}
              onPress={h.onayla}
              disabled={!h.kaydirildi || h.calisiyor}
              accessibilityRole="button"
            >
              {h.calisiyor ? <ActivityIndicator color="#fff" /> : <Text style={styles.birincilMetin}>{t('settings:hesapSecSilDevam')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.ikincil} onPress={h.geri} disabled={h.calisiyor} accessibilityRole="button">
              <Text style={styles.ikincilMetin}>{t('common:back', 'Geri')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1120' },
  icerik: { padding: 16, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  bos: { padding: 24, gap: 16, alignItems: 'center' },
  aciklama: { color: '#cbd5e1', fontSize: 14, lineHeight: 20 },
  birincil: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  birincilMetin: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sil: { backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  pasif: { opacity: 0.45 },
  ikincil: { alignItems: 'center', paddingVertical: 10 },
  ikincilMetin: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  uyari: { alignItems: 'center', gap: 10, padding: 18, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  uyariBaslik: { color: '#fecaca', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  uyariMetin: { color: '#fca5a5', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAktarimStore } from '../../store/aktarimStore';

/** Bu oturumda biten ve bekleyeni olmayan aktarımın "hazır" satırı bu kadar kalır. */
const HAZIR_SURESI_MS = 4000;

/**
 * 🔄 OTOMATİK TRAKT AKTARIMI BANDI (§C33) — ince, ENGELLEMEYEN.
 *
 * 🔑 SPINNER DEĞİL, İLERLEYEN SAYILAR: kullanıcı "donmuş/bozuk" sanıp
 * uygulamayı kapatmasın (hatta silmesin). Sayılar her adımda değişir; bu,
 * bir şeyin gerçekten aktığının en ucuz kanıtı.
 *
 * 📝 METİN (kullanıcı kararı, 2026-09-28): *"senkronize ediliyor, lütfen
 * uygulamayı kapatmayın yazsın, bu yeter."* Tek satır, açık talimat — K2
 * gereği uygulama kapalıyken aktarım İLERLEMİYOR, bunu söylemek dürüst olan.
 * Okumayan kapatırsa zarar yok: açılışta kaldığı yerden sürer.
 *
 * Yalnızca okur (`aktarimStore`); hiçbir karar vermez. Dört ekrana da
 * (mobil + web ikizleri) aynı bileşen yerleşiyor — devirdeki 2. ders: bir
 * ekran düzeltmesi web ikizini unutursa sessizce yarım kalır.
 */
export default function AktarimBandi() {
  const { t } = useTranslation('common');
  const { faz, yuzde, bekleyen, kapatildi, kapat } = useAktarimStore();

  const hazirBekleyensiz = faz === 'bitti' && bekleyen === 0 && !kapatildi;
  useEffect(() => {
    if (!hazirBekleyensiz) return;
    const z = setTimeout(kapat, HAZIR_SURESI_MS);
    return () => clearTimeout(z);
  }, [hazirBekleyensiz, kapat]);

  // 📝 YÜZDE (kullanıcı kararı): "3474/9473" yerine "%37". `null` iken
  // (geçmişin toplamı henüz bilinmiyor) sayı yok, çubuk ince başlar.
  const yuzdeMetni = yuzde !== null ? t('importBannerPercent', { yuzde, defaultValue: '%{{yuzde}}' }) : '';

  if (faz === 'suruyor' || faz === 'baska_cihaz') {
    return (
      <View style={styles.bant} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
        <Text style={styles.baslik}>
          {faz === 'baska_cihaz'
            ? t('importBannerOtherDevice', 'Trakt kütüphanen başka bir cihazında aktarılıyor')
            : t('importBannerRunning', 'Senkronize ediliyor — lütfen uygulamayı kapatmayın')}
          {yuzdeMetni ? <Text style={styles.sayi}>{`  ·  ${yuzdeMetni}`}</Text> : null}
        </Text>
        <View style={styles.cubukArka}>
          <View style={[styles.cubukDolu, { width: `${yuzde ?? 4}%` }]} />
        </View>
      </View>
    );
  }

  if (faz === 'ag_bekleniyor') {
    return (
      <View style={[styles.bant, styles.bantUyari]} accessibilityLiveRegion="polite">
        <Text style={styles.baslik}>
          {t('importBannerOffline', 'İnternet bağlantısı bekleniyor — aktarım kaldığı yerden devam edecek.')}
        </Text>
      </View>
    );
  }

  if (faz === 'bitti' && !kapatildi) {
    return (
      <View style={[styles.bant, styles.bantTamam]} accessibilityLiveRegion="polite">
        <View style={styles.satir}>
          <Text style={[styles.baslik, styles.esnek]}>{t('importBannerDone', 'Trakt kütüphanen hazır ✓')}</Text>
          {bekleyen > 0 && (
            <TouchableOpacity onPress={kapat} accessibilityRole="button" accessibilityLabel={t('close', 'Kapat')} hitSlop={10}>
              <Text style={styles.kapat}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {bekleyen > 0 && (
          // 🔴 DÜRÜST SATIR (kullanıcı kararı): katalogda henüz olmayan
          // yapımlar gece güncellemesiyle eklenir; o zamana kadar eksik
          // görünmeleri "kayboldu" sanılmasın.
          <Text style={styles.alt}>
            {t('importBannerPending', {
              sayi: bekleyen.toLocaleString(),
              defaultValue: '{{sayi}} kayıt kataloğa ekleniyor; gece güncellemesiyle görünecek.',
            })}
          </Text>
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  bant: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
    gap: 6,
  },
  bantUyari: {
    backgroundColor: 'rgba(234,179,8,0.10)',
    borderColor: 'rgba(234,179,8,0.28)',
  },
  bantTamam: {
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.28)',
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  esnek: {
    flex: 1,
  },
  baslik: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  sayi: {
    color: '#93c5fd',
    fontWeight: '700',
  },
  alt: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
  kapat: {
    color: '#94a3b8',
    fontSize: 14,
  },
  cubukArka: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  cubukDolu: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3b82f6',
  },
});

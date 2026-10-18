import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Avatar from '../Avatar';
import { CheckCircle2 } from '../icons';
import type { HesapOzeti } from '../../services/api/girisYontemi';

interface Props {
  hesap: HesapOzeti;
  etiket: string;
  secili: boolean;
  onSec: () => void;
}

const sayi = (n: number | null) => (n == null ? '—' : String(n));

/**
 * Kimlik Faz 5 (M520) · D3 — Hesap Seç kartı: KaymakNo · ad · yöntem · özet sayılar
 * (izleme / yorum / takipçi). Kişi hangisinin «dolu» olduğunu görerek seçsin.
 * 🆕 GIRIS-TASARIM-01 (M536): kullanıcı (2026-10-18) — «her iki seçeneğin üzerinde @kullanici_adi ve
 * #KaymakNo çok belirgin gösterilsin ki hangi hesabını tuttuğunu net görsün». `@ad` en büyük satır,
 * `#no` yanında rozet; görünen ad (farklıysa) alta, küçük.
 */
export default function HesapKarti({ hesap, etiket, secili, onSec }: Props) {
  const { t } = useTranslation('settings');
  const yontemler = hesap.yontemler.map((y) => (y === 'trakt' ? 'Trakt' : 'Google')).join(' + ') || '—';
  return (
    <TouchableOpacity
      style={[styles.kart, secili && styles.kartSecili]}
      onPress={onSec}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ checked: secili }}
    >
      <View style={styles.ust}>
        <Text style={styles.etiket}>{etiket}</Text>
        {secili && <CheckCircle2 size={18} color="#60a5fa" />}
      </View>
      <View style={styles.kimlik}>
        <Avatar url={hesap.avatarUrl ?? undefined} ad={hesap.username} size={44} />
        <View style={styles.adlar}>
          <View style={styles.adSatiri}>
            <Text style={styles.ad} numberOfLines={1}>@{hesap.username}</Text>
            {hesap.kaymakNo != null && (
              <View style={styles.noRozet}>
                <Text style={styles.noMetin}>#{hesap.kaymakNo}</Text>
              </View>
            )}
          </View>
          {!!hesap.displayName && hesap.displayName !== hesap.username && (
            <Text style={styles.alt} numberOfLines={1}>{hesap.displayName}</Text>
          )}
          <Text style={styles.alt}>{t('hesapKartiGiris', { yontem: yontemler })}</Text>
        </View>
      </View>
      <View style={styles.sayilar}>
        <Sayi deger={sayi(hesap.sayilar.izleme)} ad={t('hesapKartiIzleme')} />
        <Sayi deger={sayi(hesap.sayilar.yorum)} ad={t('hesapKartiYorum')} />
        <Sayi deger={sayi(hesap.sayilar.takipci)} ad={t('hesapKartiTakipci')} />
      </View>
    </TouchableOpacity>
  );
}

function Sayi({ deger, ad }: { deger: string; ad: string }) {
  return (
    <View style={styles.sayi}>
      <Text style={styles.sayiDeger}>{deger}</Text>
      <Text style={styles.sayiAd}>{ad}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kart: { borderRadius: 14, borderWidth: 1.5, borderColor: '#1e293b', backgroundColor: '#111827', padding: 14, gap: 12 },
  kartSecili: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)' },
  ust: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  etiket: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  kimlik: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adlar: { flex: 1, gap: 2 },
  adSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ad: { color: '#f8fafc', fontSize: 18, fontWeight: '800', flexShrink: 1 },
  noRozet: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(59,130,246,0.18)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.45)' },
  noMetin: { color: '#bfdbfe', fontSize: 13, fontWeight: '700' },
  alt: { color: '#94a3b8', fontSize: 12.5 },
  sayilar: { flexDirection: 'row', justifyContent: 'space-around' },
  sayi: { alignItems: 'center' },
  sayiDeger: { color: '#e2e8f0', fontSize: 16, fontWeight: '700' },
  sayiAd: { color: '#64748b', fontSize: 11.5 },
});

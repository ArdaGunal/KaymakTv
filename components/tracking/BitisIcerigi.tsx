import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, Star } from '../icons';
import RatingModal from '../RatingModal';
import { useBitisAni } from '../../hooks/useBitisAni';
import { formatRating } from '../../utils/formatRating';
import type { BitisTuru } from '../../store/bitisAniStore';

/**
 * Bitiş anı renkleri (2.6.8 BITIS-01). Kullanıcı kararı (2026-11-06): yeşil
 * «bölüm izlendi» anına ait kalır; bitiş farklı renk — sakin bir mavi, neon /
 * parlak değil. Kartlar zemin ve kenarı buradan alır.
 */
export const BITIS_RENK = {
  zemin: '#15243A',
  kenar: '#2B4366',
  vurgu: '#8DB0DC',
  metin: '#C9D9EE',
  soluk: '#8296B3',
  dugme: '#22395A',
  rozet: 'rgba(141, 176, 220, 0.16)',
} as const;

interface Props {
  tur: BitisTuru;
  id: number;
  /** Puan penceresi başlığı ve Akış kaydı için yapımın adı. */
  ad: string;
  /** Film: süre buradan okunur (ham film nesnesi). */
  film?: any;
  /** `afis`: masaüstü afiş kartının alt paneli (ad da yazılır). */
  yerlesim?: 'satir' | 'afis';
}

/**
 * Kart yerinde «bitti» görünümü: başlık, kısa özet, «Puanla». Yalnız çizer.
 * Duyurulmuş bölümü olan dizide aynı an «Yeni bölüm X gün sonra» der (puan yok).
 */
export default function BitisIcerigi({ tur, id, ad, film, yerlesim = 'satir' }: Props) {
  const { t } = useTranslation('common');
  const b = useBitisAni(tur, id, ad, film);

  return (
    <View style={styles.kap}>
      {yerlesim === 'afis' && <Text style={styles.ad} numberOfLines={1}>{ad}</Text>}
      <View style={styles.baslikSatiri}>
        <View style={styles.rozet}>
          <Check size={12} color={BITIS_RENK.vurgu} strokeWidth={3.5} />
        </View>
        <Text style={styles.baslik} numberOfLines={1}>{b.baslik}</Text>
      </View>
      {!!b.ozetMetni && <Text style={styles.ozet} numberOfLines={2}>{b.ozetMetni}</Text>}
      {b.puanGoster && (
        <TouchableOpacity style={styles.puanDugmesi} onPress={b.puanlaAc} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Star size={13} color={BITIS_RENK.metin} fill={b.puan ? BITIS_RENK.metin : 'transparent'} />
          <Text style={styles.puanMetni}>{b.puan ? `${formatRating(b.puan)}/5` : t('rate')}</Text>
        </TouchableOpacity>
      )}
      <RatingModal
        visible={b.puanAcik}
        onClose={b.puanKapat}
        title={ad}
        myRating={b.puan}
        onRate={b.puanVer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  kap: { gap: 4 },
  ad: { color: '#ffffff', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  baslikSatiri: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rozet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BITIS_RENK.rozet,
    borderWidth: 1,
    borderColor: BITIS_RENK.kenar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baslik: { color: BITIS_RENK.vurgu, fontSize: 15, fontWeight: '800', letterSpacing: 0.2, flexShrink: 1 },
  ozet: { color: BITIS_RENK.soluk, fontSize: 12, fontWeight: '600' },
  puanDugmesi: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: BITIS_RENK.dugme,
    borderWidth: 1,
    borderColor: BITIS_RENK.kenar,
  },
  puanMetni: { color: BITIS_RENK.metin, fontSize: 12, fontWeight: '700' },
});

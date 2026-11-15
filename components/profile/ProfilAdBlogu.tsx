import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from '../icons';
import { profilAdSatirlari } from '../../utils/profilAdi';
import { useKullaniciAdiKopyala } from '../../hooks/useProfilEylemleri';

interface ProfilAdBloguProps {
  /** Görünen ad (`display_name`); `null` = yok. */
  name: string | null | undefined;
  username: string | null | undefined;
  /** Ekranın kendi yazı boyutları (mobil / masaüstü / Profilim farklı). */
  baslikStili: StyleProp<TextStyle>;
  altStili: StyleProp<TextStyle>;
  /** Başlığın sağında küçük öğe (ör. gizli hesap kilidi). */
  baslikSonu?: React.ReactNode;
  /** Ad henüz yokken başlık («Profil»). */
  yedekBaslik?: string;
}

/**
 * Profil adı + kullanıcı adı — 1.0.1 Dal 2 (kullanıcı kararı, 2026-11-15).
 * Kural `utils/profilAdi.ts`: görünen ad farklıysa iki satır, değilse tek satır (@ yok).
 * `@kullanıcı_adı` satırına (tek satırsa başlığa) dokununca `@kullanıcı_adı` panoya kopyalanır.
 * Mobil başlık, web masaüstü başlıkları ve «Profilim» ekranı bu bileşeni kullanır.
 */
export default function ProfilAdBlogu({ name, username, baslikStili, altStili, baslikSonu, yedekBaslik }: ProfilAdBloguProps) {
  const { t } = useTranslation('common');
  const { baslik, altSatir } = profilAdSatirlari(name, username);
  const { kopyala, kopyalandi } = useKullaniciAdiKopyala(username);
  const kopyalanabilir = !!username;
  const erisim = kopyalanabilir ? { accessibilityRole: 'button' as const, accessibilityLabel: t('kullaniciAdiKopyala', { ad: username }) } : {};
  const bildirim = kopyalandi && (
    <View style={styles.bildirim}>
      <Check size={12} color="#4ade80" />
      <Text style={styles.bildirimMetin}>{t('kullaniciAdiKopyalandi')}</Text>
    </View>
  );

  const baslikMetni = <Text style={baslikStili} numberOfLines={1}>{baslik || yedekBaslik}</Text>;

  return (
    <View>
      <View style={styles.satir}>
        {altSatir === null && kopyalanabilir ? (
          <TouchableOpacity onPress={kopyala} activeOpacity={0.7} style={styles.esnek} {...erisim}>{baslikMetni}</TouchableOpacity>
        ) : (
          <View style={styles.esnek}>{baslikMetni}</View>
        )}
        {baslikSonu}
        {altSatir === null && bildirim}
      </View>
      {altSatir !== null && (
        <View style={styles.satir}>
          <TouchableOpacity onPress={kopyala} activeOpacity={0.7} style={styles.esnek} hitSlop={{ top: 4, bottom: 4 }} {...erisim}>
            <Text style={altStili} numberOfLines={1}>{altSatir}</Text>
          </TouchableOpacity>
          {bildirim}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Kısa adda dokunma alanı metin kadar kalsın; uzun adda satırı aşmadan kısalsın.
  esnek: { flexShrink: 1 },
  bildirim: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bildirimMetin: { color: '#4ade80', fontSize: 11, fontWeight: '600' },
});

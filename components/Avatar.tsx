import React, { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { avatarBasHarfi, avatarRengi } from '../utils/avatar';

interface AvatarProps {
  /** Google fotoğrafı ya da Trakt avatarı. Yoksa/yüklenemezse baş harf çizilir. */
  url?: string | null;
  /** Kullanıcı adı — baş harf ve renk bundan (`utils/avatar.ts`). */
  ad?: string | null;
  size: number;
  /** Profil başlıklarındaki mavi halka (2px). */
  halka?: boolean;
  /** Özel çerçeve (ör. maraton kartındaki mesaj rengi). `halka`'yı ezer. */
  borderColor?: string;
  borderWidth?: number;
  /** Yalnızca DIŞ düzen için (boşluk vb.) — boyut/renk `size`'tan gelir. */
  style?: StyleProp<ViewStyle>;
}

const HALKA_RENGI = 'rgba(59,130,246,0.4)';

/**
 * Uygulamanın TEK avatar bileşeni — Faz T · T4 (M341).
 *
 * ⛔ ESKİDEN 16 dosya aynı "resim varsa `<Image>`, yoksa gri daire + harf"
 * bloğunu kendi stilleriyle kopyalıyordu; akış kartları, akış yorumları ve
 * incelemeler `avatarUrl` ELLERİNDE OLDUĞU hâlde resmi hiç çizmiyordu.
 *
 * 🔑 Resim yüklenemezse (Google fotoğraf URL'si süresi dolmuş, ağ yok) BOŞ
 * bir daire değil baş harf gösterilir — `onError` → harfe düşüş. `url`
 * değişince bozuk bayrağı sıfırlanır (liste satırı başka kişiye geri
 * dönüştürüldüğünde önceki kişinin hatası taşınmasın).
 *
 * Erişilebilirlik: avatar HER kullanımda yanında adla birlikte — ekran okuyucu
 * adı iki kez okumasın diye dekoratif işaretleniyor.
 */
function Avatar({ url, ad, size, halka = false, borderColor, borderWidth, style }: AvatarProps) {
  const [bozuk, setBozuk] = useState(false);

  useEffect(() => {
    setBozuk(false);
  }, [url]);

  const resimVar = !!url && !bozuk;
  const cerceveRengi = borderColor ?? (halka ? HALKA_RENGI : undefined);
  const cerceveKalinligi = borderWidth ?? (borderColor ? 1 : halka ? 2 : 0);

  return (
    <View
      style={[
        styles.daire,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: resimVar ? '#1e293b' : avatarRengi(ad),
          borderWidth: cerceveKalinligi,
          borderColor: cerceveRengi,
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {resimVar ? (
        <Image
          source={{ uri: url as string }}
          // Çerçevenin İÇİNDE kalır (mutlak konum dolgu kutusuna göredir);
          // köşe yarıçapı Android'de kırpmanın dış çizgiye göre yapılmasına karşı.
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          contentFit="cover"
          cachePolicy="disk"
          onError={() => setBozuk(true)}
        />
      ) : (
        <Text style={[styles.harf, { fontSize: Math.round(size * 0.4) }]}>{avatarBasHarfi(ad)}</Text>
      )}
    </View>
  );
}

export default memo(Avatar);

const styles = StyleSheet.create({
  daire: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  harf: {
    color: '#fff',
    fontWeight: '700',
  },
});

import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ikincilBaslik, type BaslikliYapim } from '../../utils/gorunenBaslik';

/** Detay başlığının altındaki satır; kuralı `ikincilBaslik` belirler, yoksa hiç yer kaplamaz. */
export default function IkincilBaslik({ yapim, style }: { yapim: BaslikliYapim | null | undefined; style: StyleProp<TextStyle> }) {
  const { t, i18n } = useTranslation('media');
  const satir = ikincilBaslik(yapim, i18n.language);
  if (!satir) return null;
  return (
    <Text style={style} numberOfLines={1}>
      {satir.ozgunMu ? t('originalTitleLabel', { ad: satir.metin }) : satir.metin}
    </Text>
  );
}

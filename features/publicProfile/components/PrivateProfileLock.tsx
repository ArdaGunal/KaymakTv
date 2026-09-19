import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lock } from '../../../components/icons';
import { useTranslation } from 'react-i18next';

/**
 * Gizli hesabın profilinde, takipçi OLMAYAN ziyaretçiye sekmeler yerine
 * gösterilir — §C29 (M409). `BlockedProfileLock` ile aynı görsel dil.
 *
 * Başlık (ad, fotoğraf, @ad, sayılar, takip/istek düğmesi) BİLİNÇLİ olarak
 * görünür kalır: ziyaretçi kime istek gönderdiğini bilmeli (Instagram deseni).
 */
export default function PrivateProfileLock() {
  const { t } = useTranslation('feed');
  return (
    <View style={styles.wrap}>
      <Lock size={40} color="#334155" />
      <Text style={styles.title}>{t('privateProfileTitle', 'Bu Hesap Gizli')}</Text>
      <Text style={styles.text}>
        {t('privateProfileText', 'İzlediklerini ve paylaşımlarını görmek için takip isteği gönder.')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 10,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ban } from '../../../components/icons';
import { useTranslation } from 'react-i18next';

/**
 * Engellenen (ya da beni engelleyen) bir kullanıcının profilinde aktivite/
 * kütüphane sekmeleri yerine gösterilir — bkz. docs/FEED_SOCIAL_PLAN.md §4.5.
 * Yönü (kim kimi engelledi) BİLİNÇLİ OLARAK açıklanmıyor, yalnızca bir engel
 * ilişkisi olduğu söyleniyor.
 */
export default function BlockedProfileLock() {
  const { t } = useTranslation('feed');
  return (
    <View style={styles.wrap}>
      <Ban size={40} color="#334155" />
      <Text style={styles.title}>{t('blockedProfileTitle', 'Bu Profili Görüntüleyemezsin')}</Text>
      <Text style={styles.text}>
        {t('blockedProfileText', 'Bu kullanıcıyla aranızda bir engelleme ilişkisi var.')}
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

import React, { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Folder } from '../icons';
import SettingsRow from './SettingsRow';
import { confirmAsync } from '../../utils/confirmDialog';
import { logError } from '../../utils/errorLog';

/**
 * "Önbelleği Temizle" — TODO.md'deki performans kalemi. F13'ten sonra
 * (RN Image → expo-image + cachePolicy="disk") disk kullanımı arttığı için
 * artık gerçek bir ihtiyaç. `expo-image`'in kendi statik API'sini çağırır —
 * ayrı bir servis katmanına gerek yok, tek bir SDK çağrısı.
 *
 * Web'de disk cache kavramı yok (tarayıcı kendi HTTP cache'ini yönetir);
 * bu satır orada anlamsız olduğu için gösterilmiyor (F15_TEST_PROTOCOL'daki
 * "profile.web.tsx bilinçli atlandı" ile aynı gerekçe sınıfı).
 */
export default function ClearCacheRow() {
  const { t } = useTranslation(['settings', 'common']);
  const [isClearing, setIsClearing] = useState(false);

  if (Platform.OS === 'web') return null;

  const handlePress = async () => {
    const onaylandi = await confirmAsync(
      t('settings:clearCacheTitle', 'Önbelleği Temizle'),
      t(
        'settings:clearCacheMessage',
        'İndirilen tüm poster ve görsel önbelleği silinir. Görseller bir sonraki açılışta yeniden indirilir.'
      ),
      t('settings:clearCacheConfirm', 'Temizle'),
      t('common:cancel')
    );
    if (!onaylandi) return;

    setIsClearing(true);
    try {
      // İki katman ayrı: disk (kapanış sonrası kalıcı) + bellek (o anki
      // oturum). İkisi de temizlenmezse kullanıcı "hâlâ yer kaplıyor" ya da
      // "hâlâ eski görsel görünüyor" hissi yaşayabilir.
      await Image.clearDiskCache();
      await Image.clearMemoryCache();
      Alert.alert(
        t('settings:clearCacheDoneTitle', 'Tamamlandı'),
        t('settings:clearCacheDoneMessage', 'Önbellek temizlendi.')
      );
    } catch (error) {
      logError('ClearCacheRow.handlePress', error);
      Alert.alert(
        t('common:error', 'Hata'),
        t('settings:clearCacheError', 'Önbellek temizlenemedi, tekrar dene.')
      );
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <SettingsRow
      icon={<Folder size={20} color="#a78bfa" />}
      label={t('settings:clearCache', 'Önbelleği Temizle')}
      tintColor="#a78bfa"
      onPress={handlePress}
      disabled={isClearing}
    />
  );
}

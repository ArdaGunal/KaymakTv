import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, Linking, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

interface ForceUpdateScreenProps {
  updateUrl: string;
}

/**
 * Tam ekran, KAPATILAMAZ "Güncelleme Gerekli" ekranı. `app/_layout.tsx`,
 * `useVersionGate` `status === 'blocked'` döndürdüğünde tüm normal yönlendirme
 * ağacının (`(public)`/`(protected)` Stack'i) YERİNE bunu render eder — yani
 * geri gitmek için "arkada" bir ekran zaten yok. Android donanım geri tuşu
 * ayrıca `BackHandler` ile açıkça yutulur (aksi halde uygulama arka plana
 * atılıp tekrar öne gelindiğinde aynı engellenmiş durumda kalırdı — kullanıcı
 * için "geri tuşu çalışmıyor gibi" hissettirmemesi için bilinçli olarak sessiz
 * bir no-op, hata/uyarı YOK).
 */
export default function ForceUpdateScreen({ updateUrl }: ForceUpdateScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handleUpdatePress = () => {
    Linking.openURL(updateUrl).catch((e) => console.error('Güncelleme linki açılamadı:', e));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} contentFit="contain" />

        <Text style={styles.title}>{t('forceUpdateTitle', 'Güncelleme Gerekli')}</Text>
        <Text style={styles.message}>
          {t(
            'forceUpdateMessage',
            'KaymakTV\'yi kullanmaya devam edebilmek için uygulamayı güncellemeniz gerekiyor.'
          )}
        </Text>

        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={handleUpdatePress}>
          <Text style={styles.buttonText}>{t('forceUpdateButton', 'Şimdi Güncelle')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 360,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    marginBottom: 28,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: '#a3a3a3',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

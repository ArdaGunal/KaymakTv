import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react-native';

interface ErrorFallbackProps {
  onRetry: () => void;
}

/**
 * expo-router `ErrorBoundary` export'unun (bkz. app/_layout.tsx) çizdiği
 * tam ekran çökme kurtarma ekranı. `ForceUpdateScreen.tsx` ile AYNI görsel
 * dil (logo + başlık + açıklama + buton) — kullanıcı için "bu uygulamanın
 * bilinçli bir ekranı" hissi versin, çıplak bir hata sayfası gibi değil.
 *
 * `retry()` (expo-router'ın verdiği) render ağacını sıfırlayıp yeniden
 * dener — hatanın kaynağı geçiciyse (ör. bir anlık null referans) bu
 * genelde yeterlidir. Kalıcı bir hata ise kullanıcı yine aynı ekranı görür,
 * en azından beyaz/boş ekranda takılı KALMAZ.
 */
export default function ErrorFallback({ onRetry }: ErrorFallbackProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />

        <View style={styles.iconBadge}>
          <AlertTriangle size={22} color="#f87171" />
        </View>

        <Text style={styles.title}>{t('crashTitle', 'Bir Şeyler Ters Gitti')}</Text>
        <Text style={styles.message}>
          {t('crashMessage', 'Beklenmedik bir hata oluştu. Tekrar denemek genelde sorunu çözer.')}
        </Text>

        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={onRetry}>
          <Text style={styles.buttonText}>{t('retry', 'Tekrar Dene')}</Text>
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
    maxWidth: 340,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 20,
    opacity: 0.85,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  title: {
    color: '#f1f5f9',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 28,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});

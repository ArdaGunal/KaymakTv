import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface SyncErrorStateProps {
  onRetry: () => void;
}

/**
 * "Boş" ile "senkron başarısız oldu" durumunu ayırt eden ortak ekran —
 * IndexMobile.tsx (Diziler) ve MoviesMobile.tsx (Filmler) arasında paylaşılır.
 * İkisi de `useLibraryStore.hasSyncError`'a bakıp, kritik Trakt istekleri
 * TAMAMEN başarısız olduğunda (ör. internet yok) bunu kullanıcının GERÇEKTEN
 * hiç dizisi/filmi olmamasından ayırıyor — Google Play'in "internet keserek
 * test" senaryosunda "0 dizin var" gibi yanıltıcı bir boş durum yerine
 * gerçek sebep gösterilsin diye (bkz. google_play_eksikler.md Aşama 3).
 */
export default function SyncErrorState({ onRetry }: SyncErrorStateProps) {
  const { t } = useTranslation('media');

  return (
    <View style={styles.container}>
      <WifiOff size={40} color="#334155" />
      <Text style={styles.title}>{t('syncErrorTitle', 'Yüklenemedi')}</Text>
      <Text style={styles.text}>
        {t('syncErrorText', 'Bağlantını kontrol edip tekrar dene.')}
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
        <Text style={styles.retryButtonText}>{t('syncErrorRetry', 'Tekrar Dene')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 8,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  text: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  retryButtonText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
});

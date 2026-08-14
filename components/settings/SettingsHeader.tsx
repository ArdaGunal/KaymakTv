import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface SettingsHeaderProps {
  title: string;
  isDesktop: boolean;
  onBack: () => void;
  /** Başlığın SAĞINA, aynı satıra eklenecek isteğe bağlı içerik (ör.
   * Geliştirici Paneli'nin yenile/kopyala/gönder ikon butonları). Verilmezse
   * (varsayılan `undefined`) düzen ESKİSİYLE BİREBİR AYNI kalır — mevcut
   * hiçbir çağıran (account.tsx, notifications.tsx, EditProfileMobile.tsx...)
   * bunu geçmiyor ve etkilenmiyor. */
  rightSlot?: React.ReactNode;
}

// Ayarlar ekranının geri butonlu başlığı: mobilde sade bir ikon, masaüstünde
// "Geri" etiketli, belirgin tıklanabilir bir buton (statistics.web.tsx /
// LibraryScreenWeb'deki geri butonu deseniyle tutarlı).
export function SettingsHeader({ title, isDesktop, onBack, rightSlot }: SettingsHeaderProps) {
  const { t } = useTranslation('common');

  return (
    <View style={[styles.header, isDesktop && styles.headerDesktop]}>
      <TouchableOpacity
        style={[styles.backButton, isDesktop && styles.backButtonDesktop]}
        onPress={onBack}
        activeOpacity={0.75}
      >
        <ChevronLeft size={isDesktop ? 18 : 24} color="#ffffff" />
        {isDesktop && <Text style={styles.backButtonText}>{t('back', 'Geri')}</Text>}
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {rightSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerDesktop: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  title: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  backButtonDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1f2937',
    ...({ cursor: 'pointer', transition: 'all 0.2s ease' } as any),
  },
  backButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
});

import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DESKTOP_BREAKPOINT = 768;

/**
 * Google Play "Data Deletion Requirement" — uygulamayı kurmadan, tarayıcıdan
 * erişilebilen hesap silme talep sayfası. Gerçek silme akışı zaten
 * `(protected)/account.tsx` içinde var ve ÇALIŞIYOR (bkz.
 * `features/feed/services/accountDeletion.ts`); bu sayfa o akışı
 * TEKRARLAMIYOR, tarayıcıdan giriş yapıp aynı akışa ulaşmanın yolunu
 * anlatıyor + oraya götüren gerçek bir buton veriyor. Web build zaten Trakt
 * OAuth girişini destekliyor (bkz. `(public)/settings.tsx`), yani bu adımlar
 * gerçekten uygulanabilir — yalnızca metin değil.
 */
export default function HesapSilScreen() {
  const { t } = useTranslation(['legal', 'common']);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const goToLogin = () => router.push('/(public)/settings');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        <TouchableOpacity onPress={goBack} hitSlop={12} style={styles.backButton}>
          <ArrowLeft size={20} color="#e2e8f0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('legal:deleteAccountPageTitle', 'Hesabımı ve Verilerimi Sil')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.heading}>{t('legal:deleteAccountHowTitle', 'Nasıl silinir?')}</Text>
          <Text style={styles.body}>
            {t(
              'legal:deleteAccountHowText',
              '1) Aşağıdaki "Giriş Yap" butonuyla Trakt hesabınla giriş yap.\n2) Ayarlar ekranına git.\n3) "Hesap Seçenekleri" altında "Hesabı Sil"e dokun ve onayla.'
            )}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>{t('legal:deleteAccountWhatTitle', 'Ne silinir?')}</Text>
          <Text style={styles.body}>
            {t(
              'legal:deleteAccountWhatText',
              'KaymakTV sunucusundaki kullanıcı kaydın, akış aktivitelerin (izleme/puanlama paylaşımların) ve yorumların kalıcı olarak silinir.'
            )}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>{t('legal:deleteAccountWhatNotTitle', 'Ne silinmez?')}</Text>
          <Text style={styles.body}>
            {t(
              'legal:deleteAccountWhatNotText',
              'Trakt.tv hesabına HİÇ dokunulmaz — KaymakTV, Trakt hesabını silme yetkisine sahip değildir. Trakt hesabını silmek istersen bunu trakt.tv üzerinden ayrıca yapmalısın.'
            )}
          </Text>
        </View>

        <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85} onPress={goToLogin}>
          <Trash2 size={18} color="#fff" />
          <Text style={styles.ctaButtonText}>{t('legal:deleteAccountCta', 'Giriş Yap ve Devam Et')}</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>
          {t(
            'legal:deleteAccountFootnote',
            'Uygulamayı yüklemene gerek yok — bu işlem tarayıcıdan da tamamlanabilir.'
          )}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerDesktop: {
    paddingHorizontal: 32,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  contentDesktop: {
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
    padding: 32,
  },
  section: {
    marginBottom: 22,
  },
  heading: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 24,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  body: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 23,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  ctaButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  footnote: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
  },
});

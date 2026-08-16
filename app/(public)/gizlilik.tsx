import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react-native';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LegalSection {
  heading: string;
  text: string;
}

const DESKTOP_BREAKPOINT = 768;

/**
 * Gizlilik Politikası + Kullanım Koşulları'nın kendi URL'i olan, giriş
 * gerektirmeyen tam sayfa hali — Google Play "Uygulama içeriği" formunun
 * istediği herkese açık Gizlilik Politikası bağlantısı budur (uygulama içi
 * `LegalTermsModal` bunun yerini TUTMAZ, o yalnızca oturum açan kullanıcıya
 * görünür).
 *
 * İçerik AYNI `legal` i18n namespace'inden (`LegalTermsModal.tsx` ile
 * paylaşılan) geliyor — iki yerde kopyalanmasın diye. `kullanim-kosullari.tsx`
 * bu dosyayı re-export eder (aynı içerik, ayrı URL — Play Console hem
 * Gizlilik Politikası hem Kullanım Koşulları alanına link isteyebiliyor).
 */
export default function GizlilikScreen() {
  const { t } = useTranslation(['legal', 'common']);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const sections = t('legal:sections', { returnObjects: true }) as LegalSection[];

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        <TouchableOpacity onPress={goBack} hitSlop={12} style={styles.backButton}>
          <ArrowLeft size={20} color="#e2e8f0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('legal:title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {(Array.isArray(sections) ? sections : []).map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.body}>{section.text}</Text>
          </View>
        ))}
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
    maxWidth: 720,
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
});

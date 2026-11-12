import { nativeColor } from '../../constants/mobilePalette';
import React from 'react';
import { useAppBack } from '../../hooks/useAppBack';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from '../icons';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { YASAL_BELGELER, bolumleriCoz, type YasalBelge } from '../../utils/yasalBelge';

const DESKTOP_BREAKPOINT = 768;

/**
 * Yasal bir belgenin kendi adresi olan, giriş gerektirmeyen tam sayfa hâli.
 *
 * Google Play «Uygulama içeriği» formu herkese açık bir Gizlilik Politikası bağlantısı
 * ister; UGC politikası da kuralların uygulama dışından okunabilmesini bekler. Üç sayfa
 * (`/gizlilik`, `/kullanim-kosullari`, `/topluluk-kurallari`) bu bileşeni farklı `belge`
 * ile çizer. Metin `legal` çeviri ad alanında; harita `utils/yasalBelge.ts`.
 *
 * Geçmiş: 2026-11-12'ye (M609) kadar tek birleşik metin vardı ve `/gizlilik` ile
 * `/kullanim-kosullari` aynı içeriği gösteriyordu.
 */
export default function LegalDocument({ belge }: { belge: YasalBelge }) {
  const { t } = useTranslation(['legal', 'common']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const anahtar = YASAL_BELGELER[belge];
  const sections = bolumleriCoz(t(anahtar.bolumler, { returnObjects: true }));
  const goBack = useAppBack();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        <TouchableOpacity onPress={goBack} hitSlop={12} style={styles.backButton}>
          <ArrowLeft size={20} color={nativeColor('text', '#e2e8f0')} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t(anahtar.baslik)}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>{t('legal:updatedAt')}</Text>
        {sections.map((section, index) => (
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
    backgroundColor: nativeColor('background', '#0B1120'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: nativeColor('raised', '#1e293b'),
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
    color: nativeColor('text', '#e2e8f0'),
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
  updated: {
    color: nativeColor('muted', '#94a3b8'),
    fontSize: 12,
    marginBottom: 18,
  },
  section: {
    marginBottom: 22,
  },
  heading: {
    color: nativeColor('text', '#e2e8f0'),
    fontSize: 15,
    lineHeight: 24,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  body: {
    color: nativeColor('body', '#cbd5e1'),
    fontSize: 14,
    lineHeight: 23,
  },
});

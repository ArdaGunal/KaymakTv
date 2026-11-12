import { nativeColor } from '../../constants/mobilePalette';
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useKuralOnayiStore } from '../../store/kuralOnayiStore';
import { kuralOnayiniKaydet } from '../../services/kuralOnayiKapisi';
import { YASAL_BELGELER, bolumleriCoz } from '../../utils/yasalBelge';

/**
 * Topluluk Kuralları onay penceresi — kökte TEK bağlanır (`app/_layout.tsx`).
 *
 * `services/kuralOnayiKapisi.ts` içerik yazılmadan önce onay bilinmiyorsa bu pencereyi
 * açar (YAYIN_ONCESI_PLAN Adım 4b, M609). Kısa özet + istenirse kuralların tamamı aynı
 * pencerede açılır: başka sayfaya gidilmez, çünkü pencere çoğunlukla açık bir yazma
 * penceresinin (gönderi, yorum) üstünde çıkar ve kullanıcının yazdığı metin kaybolmamalı.
 *
 * Kabul → sunucuya yazılır; yazılamazsa pencere AÇIK kalır ve hata gösterilir (sessizce
 * «kabul edildi» sayılmaz). «Şimdi değil» / geri tuşu → içerik gönderilmez.
 */
export default function KuralOnayiHost() {
  const { t } = useTranslation(['legal', 'common']);
  const acik = useKuralOnayiStore((s) => s.acik);
  const sonuclandir = useKuralOnayiStore((s) => s.sonuclandir);
  const [tamami, setTamami] = useState(false);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => useKuralOnayiStore.getState().hostBaglandi(), []);
  useEffect(() => {
    if (acik) {
      setTamami(false);
      setHata(null);
      setKaydediyor(false);
    }
  }, [acik]);

  if (!acik) return null;

  const vazgec = () => {
    if (!kaydediyor) sonuclandir(false);
  };

  const kabulEt = async () => {
    if (kaydediyor) return;
    setKaydediyor(true);
    setHata(null);
    const sonuc = await kuralOnayiniKaydet();
    setKaydediyor(false);
    if (sonuc === 'kaydedildi' || sonuc === 'uc_yok') {
      sonuclandir(true);
      return;
    }
    setHata(
      sonuc === 'surum_eski'
        ? t('legal:rulesAcceptOutdated', 'Kurallar güncellendi. Uygulamayı güncelleyip yeniden dene.')
        : t('legal:rulesAcceptError', 'Onay kaydedilemedi. Bağlantını kontrol edip yeniden dene.'),
    );
  };

  const bolumler = tamami ? bolumleriCoz(t(YASAL_BELGELER.rules.bolumler, { returnObjects: true })) : [];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={vazgec}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('legal:rulesAcceptTitle', 'Topluluk Kuralları')}</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={tamami}>
            <Text style={styles.message}>{t('legal:rulesAcceptIntro')}</Text>
            {tamami ? (
              bolumler.map((bolum, i) => (
                <View key={i} style={styles.section}>
                  <Text style={styles.heading}>{bolum.heading}</Text>
                  <Text style={styles.body}>{bolum.text}</Text>
                </View>
              ))
            ) : (
              <TouchableOpacity onPress={() => setTamami(true)} activeOpacity={0.7} accessibilityRole="button">
                <Text style={styles.link}>{t('legal:rulesAcceptRead', 'Kuralların tamamını oku')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {hata ? <Text style={styles.error}>{hata}</Text> : null}

          <TouchableOpacity
            style={[styles.confirmButton, kaydediyor && styles.disabled]}
            onPress={kabulEt}
            disabled={kaydediyor}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {kaydediyor ? (
              <ActivityIndicator color={nativeColor('text', '#ffffff')} />
            ) : (
              <Text style={styles.confirmText}>{t('legal:rulesAcceptConfirm', 'Kabul ediyorum')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterButton} onPress={vazgec} disabled={kaydediyor} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.laterText}>{t('legal:rulesAcceptLater', 'Şimdi değil')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // `ConfirmModal.tsx` ile aynı karartma ve zemin.
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: nativeColor('background', '#0B1120'),
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxWidth: 460,
    width: '100%',
    maxHeight: '86%',
    alignSelf: 'center',
  },
  title: {
    color: nativeColor('text', '#e2e8f0'),
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  scroll: {
    flexGrow: 0,
    marginBottom: 16,
  },
  message: {
    color: nativeColor('body', '#cbd5e1'),
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  link: {
    color: nativeColor('steel', '#60a5fa'),
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
  },
  section: {
    marginTop: 10,
  },
  heading: {
    color: nativeColor('text', '#e2e8f0'),
    fontSize: 14,
    lineHeight: 22,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  body: {
    color: nativeColor('body', '#cbd5e1'),
    fontSize: 13,
    lineHeight: 21,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: nativeColor('primary', '#3b82f6'),
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  confirmText: {
    color: nativeColor('text', '#ffffff'),
    fontWeight: '700',
    fontSize: 15,
  },
  laterButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  laterText: {
    color: nativeColor('muted', '#94a3b8'),
    fontSize: 14,
    fontWeight: '600',
  },
});

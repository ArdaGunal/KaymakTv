import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SearchX } from '../../components/icons';
import { useKaymakNoYonlendir } from '../../hooks/useKaymakNoYonlendir';

/**
 * `kaymaktv.com/u/<KaymakNo>` — kısa profil bağlantısı (Kimlik Faz 6, M522 · D7). Kullanıcı:
 * *«ücretsiz şekilde mantıklı»*. Yalnız yönlendirir: girişsiz → giriş ekranı (D6), girişli →
 * `/user/<ad>`. App Links `/u/` (app.json) uygulama yüklüyse bağlantıyı burada açar.
 */
export default function KisaProfilBaglantisi() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const no = Array.isArray(id) ? id[0] : id;
  const durum = useKaymakNoYonlendir(no);
  const router = useRouter();
  const { t } = useTranslation('common');

  return (
    <SafeAreaView style={styles.kap}>
      {durum === 'calisiyor' ? (
        <ActivityIndicator color="#94a3b8" />
      ) : (
        <View style={styles.govde}>
          <SearchX size={40} color="#64748b" />
          <Text style={styles.metin}>
            {durum === 'hata' ? t('kisaLinkHata') : durum === 'gorulemez' ? t('kisaLinkGorulemez') : t('kisaLinkYok')}
          </Text>
          <TouchableOpacity style={styles.dugme} onPress={() => router.replace('/(protected)/(tabs)/feed')} accessibilityRole="button">
            <Text style={styles.dugmeMetin}>{t('kisaLinkAnaSayfa')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, backgroundColor: '#0B1120', alignItems: 'center', justifyContent: 'center' },
  govde: { alignItems: 'center', gap: 14, paddingHorizontal: 24 },
  metin: { color: '#cbd5e1', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  dugme: { backgroundColor: '#2563eb', paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10 },
  dugmeMetin: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

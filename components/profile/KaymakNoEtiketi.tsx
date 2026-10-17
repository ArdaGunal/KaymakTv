import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, View, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Share2 } from '../icons';
import { logError } from '../../utils/errorLog';
import { kaymakNoMetni, profilPaylasimLinki } from '../../utils/kaymakNo';


/**
 * KaymakNo etiketi (Kimlik birliği Faz 2 · 066). Değişmez hesap numarası; dokununca panoya
 * kopyalanır. Numara yoksa (066 uygulanmamış / eski Worker) hiçbir şey çizmez.
 * 🔴 Yalnız gösterim — giriş/yetki anahtarı değildir.
 * Faz 6 (M522, D7): yanında «paylaş» — `kaymaktv.com/u/<no>` (ad değişse de kırılmaz).
 */
export default function KaymakNoEtiketi({ no }: { no: number | null | undefined }) {
  const { t } = useTranslation('common');
  const [kopyalandi, setKopyalandi] = useState(false);
  const [linkKopyalandi, setLinkKopyalandi] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (zamanlayici.current) clearTimeout(zamanlayici.current); }, []);

  const metin = kaymakNoMetni(no);
  if (!metin) return null;

  const kopyala = async () => {
    try {
      await Clipboard.setStringAsync(metin);
      setKopyalandi(true);
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
      zamanlayici.current = setTimeout(() => setKopyalandi(false), 1500);
    } catch (error) {
      logError('kaymakNo.kopyala', error);
    }
  };

  const link = profilPaylasimLinki(no);
  const paylas = async () => {
    if (!link) return;
    try {
      const nav: any = Platform.OS === 'web' ? (globalThis as any).navigator : null;
      if (Platform.OS !== 'web') {
        await Share.share({ message: `${t('profilPaylasMesaj')}
${link}` });
      } else if (nav?.share) {
        await nav.share({ url: link, text: t('profilPaylasMesaj') });
      } else {
        await Clipboard.setStringAsync(link);
        setLinkKopyalandi(true);
        if (zamanlayici.current) clearTimeout(zamanlayici.current);
        zamanlayici.current = setTimeout(() => setLinkKopyalandi(false), 1500);
      }
    } catch (error) {
      logError('kaymakNo.paylas', error);
    }
  };

  return (
    <View style={styles.satir}>
    <TouchableOpacity
      onPress={kopyala}
      style={styles.kap}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t('kaymakNoKopyala', { no: metin })}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Text style={styles.metin}>{metin}</Text>
      {kopyalandi ? <Check size={12} color="#4ade80" /> : <Copy size={12} color="#64748b" />}
      {kopyalandi && <Text style={styles.ok}>{t('kaymakNoKopyalandi')}</Text>}
    </TouchableOpacity>
    {!!link && (
      <TouchableOpacity
        onPress={paylas}
        accessibilityRole="button"
        accessibilityLabel={t('profilPaylas')}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={styles.paylas}
      >
        {linkKopyalandi ? <Check size={12} color="#4ade80" /> : <Share2 size={12} color="#64748b" />}
        {linkKopyalandi && <Text style={styles.ok}>{t('profilLinkKopyalandi')}</Text>}
      </TouchableOpacity>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', marginTop: 2 },
  kap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  paylas: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metin: { color: '#64748b', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  ok: { color: '#4ade80', fontSize: 11, fontWeight: '600' },
});

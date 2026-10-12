import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from '../icons';
import { logError } from '../../utils/errorLog';
import { kaymakNoMetni } from '../../utils/kaymakNo';


/**
 * KaymakNo etiketi (Kimlik birliği Faz 2 · 066). Değişmez hesap numarası; dokununca panoya
 * kopyalanır. Numara yoksa (066 uygulanmamış / eski Worker) hiçbir şey çizmez.
 * 🔴 Yalnız gösterim — giriş/yetki anahtarı değildir.
 */
export default function KaymakNoEtiketi({ no }: { no: number | null | undefined }) {
  const { t } = useTranslation('common');
  const [kopyalandi, setKopyalandi] = useState(false);
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

  return (
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
  );
}

const styles = StyleSheet.create({
  kap: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 2 },
  metin: { color: '#64748b', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  ok: { color: '#4ade80', fontSize: 11, fontWeight: '600' },
});

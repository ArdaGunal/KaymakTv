import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface StatCardProps {
  value: number;
  label: string;
  /** Sıfırdan farklıyken vurgulanacak renk (ör. hata kartında kırmızı) —
   * değer 0 iken her zaman nötr gri kalır, boş bir istatistik dikkat çekmemeli. */
  accentColor?: string;
}

/** `#rrggbb` → `rgba(r,g,b,alpha)`. Yalnızca bu dosyada, tek bir yerde
 * (kenarlık/ışıma rengi) kullanıldığı için ayrı bir util dosyasına
 * çıkarılmadı — accentColor her zaman sabit bir hex palet (`#ef4444` vb.). */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const StatCard = memo(({ value, label, accentColor }: StatCardProps) => {
  const isActive = value > 0 && !!accentColor;

  return (
    <View
      style={[
        styles.card,
        isActive && {
          borderColor: hexToRgba(accentColor!, 0.45),
          shadowColor: accentColor,
          // Android'de renkli gölge (shadowColor) DESTEKLENMEZ — yalnızca gri
          // `elevation` verir, bu da "ışıma" yerine sıradan bir kabartma
          // gibi görünürdü. Bu yüzden Android'de ışıma KAPALI, vurgu yalnızca
          // yukarıdaki renkli kenarlıktan gelir (zarif bir düşüş, sahte bir
          // efekt değil). Web + iOS'ta gerçek renkli ışıma görünür.
          shadowOpacity: Platform.OS === 'android' ? 0 : 0.5,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 10,
        },
      ]}
    >
      <Text style={[styles.value, isActive && { color: accentColor }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
});

export default StatCard;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: '800',
  },
  label: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

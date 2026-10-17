import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View, LayoutChangeEvent } from 'react-native';
import { ChevronRight } from './icons';

interface Props {
  metin: string;
  tamamMetni: string;
  /** Sona kadar kaydırılınca bir kez çağrılır. */
  onTamam: () => void;
  devreDisi?: boolean;
}

const TOPUZ = 48;
const ESIK = 0.88;

/**
 * Kimlik Faz 5 (M520) · D3 — kaydırarak onay. Kullanıcı (2026-10-12): *«kaydırmalı bir
 * şey koyarız, kaydırınca buton aktif olur»*. Yanlışlıkla dokunmayla geri alınamaz bir
 * işlem başlamasın diye: topuz sona kadar sürüklenmeden `onTamam` çağrılmaz; yarıda
 * bırakılırsa geri döner. Ekran okuyucu için «etkinleştir» eylemi aynı işi yapar.
 */
export default function KaydirarakOnay({ metin, tamamMetni, onTamam, devreDisi }: Props) {
  const x = useRef(new Animated.Value(0)).current;
  const genislik = useRef(0);
  const [tamam, setTamam] = useState(false);

  const bitir = () => {
    if (tamam) return;
    setTamam(true);
    Animated.timing(x, { toValue: Math.max(0, genislik.current - TOPUZ), duration: 120, useNativeDriver: false }).start();
    onTamam();
  };

  const surukle = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !devreDisi && !tamam,
        onMoveShouldSetPanResponder: () => !devreDisi && !tamam,
        onPanResponderMove: (_e, g) => {
          const yol = Math.max(0, genislik.current - TOPUZ);
          x.setValue(Math.min(Math.max(0, g.dx), yol));
        },
        onPanResponderRelease: (_e, g) => {
          const yol = Math.max(1, genislik.current - TOPUZ);
          if (g.dx / yol >= ESIK) bitir();
          else Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devreDisi, tamam]
  );

  return (
    <View
      style={[styles.ray, tamam && styles.rayTamam, devreDisi && styles.pasif]}
      onLayout={(e: LayoutChangeEvent) => { genislik.current = e.nativeEvent.layout.width; }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={tamam ? tamamMetni : metin}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'activate' && !devreDisi) bitir(); }}
    >
      <Text style={[styles.metin, tamam && styles.metinTamam]} numberOfLines={1}>{tamam ? tamamMetni : metin}</Text>
      <Animated.View style={[styles.topuz, { transform: [{ translateX: x }] }]} {...surukle.panHandlers}>
        <ChevronRight size={22} color="#fff" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ray: {
    height: TOPUZ + 8, borderRadius: (TOPUZ + 8) / 2, backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', justifyContent: 'center', padding: 4, overflow: 'hidden',
  },
  rayTamam: { backgroundColor: 'rgba(239,68,68,0.28)' },
  pasif: { opacity: 0.5 },
  metin: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: '#fca5a5', fontWeight: '700', fontSize: 14 },
  metinTamam: { color: '#fee2e2' },
  topuz: {
    width: TOPUZ, height: TOPUZ, borderRadius: TOPUZ / 2, backgroundColor: '#dc2626',
    alignItems: 'center', justifyContent: 'center',
  },
});

import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Platform, TouchableOpacity } from 'react-native';
import { Trash2 } from '../../../components/icons';

/**
 * Bir satırı sola kaydırınca silen sarmalayıcı.
 *
 * 🔴 YENİ BAĞIMLILIK EKLENMEDİ. `react-native-gesture-handler` bu projede
 * KURULU DEĞİL (package.json'da yok), dolayısıyla `Swipeable` kullanılamaz.
 * Çekirdek `PanResponder` + `Animated` yeterli; aynı desen zaten
 * `components/StarSlider.tsx`'te kullanılıyor.
 *
 * 🔴 DİKEY KAYDIRMAYI ÇALMAZ — bu bileşenin en kritik davranışı. Satırlar bir
 * `ScrollView` içinde; jesti koşulsuz üstlenseydi listeyi yukarı aşağı
 * kaydırmak imkânsız hale gelirdi. `onMoveShouldSetPanResponder` yalnızca
 * hareket BASKIN OLARAK YATAY ve belirli bir eşiği aşmışsa true döner.
 */

/** Jesti üstlenmek için gereken en küçük yatay hareket (px). */
const YAKALAMA_ESIGI = 12;
/** Silmenin tetiklenmesi için gereken kaydırma mesafesi (px). */
const SILME_ESIGI = 96;
/** Satırın ekrandan çıkarken gideceği mesafe. */
const CIKIS_MESAFESI = 500;

interface Props {
  onDelete: () => void;
  /** Ekran okuyucu ve web düğmesi için satırın ne olduğunu anlatan metin. */
  deleteLabel: string;
  children: React.ReactNode;
}

export function SwipeToDelete({ onDelete, deleteLabel, children }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;

  // 🔴 `useMemo` ŞART: PanResponder her render'da yeniden kurulursa jest
  // ortasında tanıtıcı değişir ve kaydırma yarıda kopar.
  const responder = useMemo(
    () =>
      PanResponder.create({
        // Dokunuşu HEMEN üstlenme — altındaki satırın `onPress`i çalışsın.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gesture) => {
          const yatay = Math.abs(gesture.dx);
          const dikey = Math.abs(gesture.dy);
          return yatay > YAKALAMA_ESIGI && yatay > dikey * 1.5;
        },
        onPanResponderMove: (_evt, gesture) => {
          // Yalnızca SOLA: sağa kaydırma bir şey yapmıyor, satırı sağa
          // sürüklemek "bir şey olacak" hissi verip hayal kırıklığı yaratırdı.
          translateX.setValue(Math.min(0, gesture.dx));
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dx < -SILME_ESIGI) {
            Animated.timing(translateX, {
              toValue: -CIKIS_MESAFESI,
              duration: 180,
              useNativeDriver: true,
            }).start(({ finished }) => {
              // Animasyon yarıda kesildiyse (bileşen söküldü) silme.
              if (finished) onDelete();
            });
            return;
          }
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
        // Jest sistem tarafından iptal edilirse satır yarı açık kalmasın.
        onPanResponderTerminate: () => {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [onDelete, translateX],
  );

  // 🔴 WEB'DE KAYDIRMA YOK: fare ile "kaydırarak sil" keşfedilebilir bir jest
  // değil ve dokunmatik olmayan cihazda tuhaf. Web'de kalıcı bir çöp kutusu
  // düğmesi gösteriliyor; native'de o düğme YOK, jest var.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webRow}>
        <View style={styles.webContent}>{children}</View>
        <TouchableOpacity
          onPress={onDelete}
          style={styles.webButton}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
        >
          <Trash2 size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    );
  }

  const arkaPlanOpakligi = translateX.interpolate({
    inputRange: [-SILME_ESIGI, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View>
      {/* Satırın ALTINDA duran silme zemini — satır kaydıkça ortaya çıkar. */}
      <Animated.View style={[styles.behind, { opacity: arkaPlanOpakligi }]} pointerEvents="none">
        <Trash2 size={18} color="#fca5a5" />
        <Text style={styles.behindText}>{deleteLabel}</Text>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  behind: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239,68,68,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingRight: 20,
  },
  behindText: { color: '#fca5a5', fontSize: 12, fontWeight: '700' },

  webRow: { flexDirection: 'row', alignItems: 'center' },
  webContent: { flex: 1 },
  webButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    borderRadius: 10,
  },
});

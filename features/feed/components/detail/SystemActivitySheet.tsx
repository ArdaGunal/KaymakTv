import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Pressable, Platform, Animated, PanResponder } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FeedActivity } from '../../types';
import { useActivityActions } from '../../hooks/useActivityActions';
import SystemActivityBody from './SystemActivityBody';

interface Props {
  visible: boolean;
  activity: FeedActivity;
  actions: ReturnType<typeof useActivityActions>;
  onClose: () => void;
}

const KAPATMA_ESIGI = 80;

/**
 * C2 · Sistem kaydı («X izledi») için yarım ekran pencere (kullanıcı kararı:
 * sistem kartları tam ekran açılmaz). Kullanıcı düzeltmesi (2026-10-10):
 * alttan değil EKRANIN ORTASINDA açılır — mobil ve web aynı. Karartılmış
 * alana dokununca, geri tuşuyla ya da kartı aşağı sürükleyince kapanır.
 */
export default function SystemActivitySheet({ visible, activity, actions, onClose }: Props) {
  const { t } = useTranslation('feed');
  const dy = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) dy.setValue(0);
  }, [visible, dy]);

  // Aşağı sürükleyip kapatma. Yalnız belirgin DİKEY çekişte devreye girer
  // (capture) — düğmelere ve menüye dokunuş bozulmaz. PanResponder bir kez
  // kurulur; en güncel onClose'u ref'ten okur.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const geriYasla = () => Animated.spring(dy, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
  const pan = useRef(
    PanResponder.create({
      // Boş alanda / düz metinde başlayan dokunuşu kimse sahiplenmiyor ve
      // hareket olayları pencereye hiç sorulmuyordu (ölçüldü: yalnız düğmede
      // başlayan sürükleme yakalanıyordu). Başlangıcı pencere alır; düğmeler
      // (daha derindeki yanıtlayıcılar) yine önce kendileri alır.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (_e, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => dy.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > KAPATMA_ESIGI || g.vy > 1.2) onCloseRef.current();
        else geriYasla();
      },
      onPanResponderTerminate: () => geriYasla(),
    })
  ).current;

  // Sürüklerken kart hafifçe solar — «bırakırsan kapanır» geri bildirimi.
  const opacity = dy.interpolate({ inputRange: [0, 240], outputRange: [1, 0.4], extrapolate: 'clamp' });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('detailClose', 'Kapat')}
        />
        <Animated.View {...pan.panHandlers} style={[styles.dialog, { opacity, transform: [{ translateY: dy }] }]}>
          <SystemActivityBody activity={activity} actions={actions} beforeNavigate={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(2,6,16,0.62)',
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#111a2e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2E4166',
    padding: 20,
  },
});

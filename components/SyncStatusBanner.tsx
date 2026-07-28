import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useLibrarySyncStatus } from '../hooks/useLibrarySyncStatus';

// Cache'ten anında dolan (TTL geçerli) açılışlarda banner GÖZ KIRPMAMALI —
// yalnızca senkron gerçekten bu kadar sürerse gösterilir. `useEffect` içindeki
// zamanlayıcı, bu süre dolmadan `isSyncing` false'a dönerse iptal edilir.
const SHOW_DELAY_MS = 350;
const ANIM_DURATION_MS = 280;
const HIDDEN_OFFSET = -12;

/**
 * "Verileriniz senkronize ediliyor..." göstergesi. Tek bir yerde
 * (`app/(protected)/_layout.tsx`) mount edilir, tüm sekmelerin/ekranların
 * ÜZERİNDE (ama onları engellemeden — `pointerEvents="none"`) belirir.
 *
 * Durumu tamamen `useLibrarySyncStatus`'tan alır; bu bileşenin kendisi hiçbir
 * fetch/state mantığı içermez — yalnızca var olan senkron durumunu (misafir
 * güvenli şekilde) görselleştirir.
 */
export default function SyncStatusBanner() {
  const isSyncing = useLibrarySyncStatus();
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();

  const [shouldRender, setShouldRender] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(HIDDEN_OFFSET)).current;
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isSyncing) {
      if (shouldRender || showTimerRef.current) return;
      showTimerRef.current = setTimeout(() => {
        showTimerRef.current = null;
        setShouldRender(true);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: ANIM_DURATION_MS, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
          Animated.timing(translateY, { toValue: 0, duration: ANIM_DURATION_MS, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
        ]).start();
      }, SHOW_DELAY_MS);
      return;
    }

    // Henüz gösterilmeden bitti (hızlı cache yüklemesi) — zamanlayıcıyı iptal
    // et, banner hiç görünmesin.
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (shouldRender) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: ANIM_DURATION_MS, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
        Animated.timing(translateY, { toValue: HIDDEN_OFFSET, duration: ANIM_DURATION_MS, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      ]).start(() => setShouldRender(false));
    }
  }, [isSyncing]);

  // Unmount'ta bekleyen zamanlayıcıyı temizle (route değişip layout yeniden
  // kurulursa sızıntı/kırık state olmasın).
  useEffect(() => () => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
  }, []);

  if (!shouldRender) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrapper, { top: insets.top + 8, opacity, transform: [{ translateY }] }]}
    >
      <View style={styles.pill}>
        <ActivityIndicator size="small" color="#60a5fa" />
        <Text style={styles.text} numberOfLines={1}>{t('syncInProgress')}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9998,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 320,
    backgroundColor: '#0B1120',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#172033',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  text: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '500',
  },
});

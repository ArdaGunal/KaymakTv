import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';

interface SnackbarProps {
  visible: boolean;
  message: string;
  actionText?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  duration?: number;
  /** Varsayılan 'bottom' — mevcut TÜM çağıranların görünümünü korur. 'top':
   * ekranın altına yakın, tekrar tıklanması gereken bir hedefin (ör.
   * account.tsx'teki sürüm numarasına ard arda dokunma) üzerini KAPATIR hale
   * gelen toast'lar için (bkz. docs/HISTORY.md — web'de "2 dokunuş kaldı"
   * yazısı sürüm etiketinin üzerine biniyordu, kullanıcı devam edemiyordu). */
  position?: 'top' | 'bottom';
}

const Snackbar: React.FC<SnackbarProps> = ({
  visible,
  message,
  actionText,
  onAction,
  onDismiss,
  duration = 4000,
  position = 'bottom',
}) => {
  const isTop = position === 'top';
  // 'top'ta yukarıdan aşağı, 'bottom'ta aşağıdan yukarı kayarak belirir —
  // başlangıç/bitiş yönü konuma göre TERS çevrilir (aksi halde 'top'
  // konumunda animasyon ekran dışına doğru "ters" akardı).
  const hiddenOffset = isTop ? -20 : 20;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(hiddenOffset)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
      ]).start();

      timeout = setTimeout(() => {
        hide();
      }, duration);
    } else if (shouldRender) {
      hide();
    }

    return () => clearTimeout(timeout);
  }, [visible]);

  const hide = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      }),
      Animated.timing(translateY, {
        toValue: hiddenOffset,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      }),
    ]).start(() => {
      setShouldRender(false);
      if (onDismiss) onDismiss();
    });
  };

  if (!shouldRender) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        isTop ? styles.containerTop : styles.containerBottom,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
      {actionText && onAction && (
        <TouchableOpacity 
          onPress={() => {
            onAction();
            hide();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.actionText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#0B1120',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: '#172033',
  },
  containerBottom: {
    bottom: 24, // above bottom tabs if any
  },
  containerTop: {
    top: 24, // safe-area/header'ın altında, ekranın en üstüne yakın
  },
  message: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  actionText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 16,
  },
});

export default Snackbar;

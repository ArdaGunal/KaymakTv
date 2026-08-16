import { Alert, Platform } from 'react-native';

// Silme gibi geri alınamaz eylemler için tek, platforma uygun onay noktası.
// Web'de `Alert.alert` yerine `window.confirm` doğal davranıştır (RN'in
// `Alert.alert`i web'de görsel olarak native diyaloğa benzemez).
export function confirmAsync(
  title: string,
  message: string,
  confirmLabel: string,
  cancelLabel: string
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false);
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

import { Alert, Platform } from 'react-native';

// Silme gibi geri alınamaz eylemler için TEK, platforma uygun onay noktası.
//
// ⚠️ Web'de `Alert.alert` ARTIK no-op DEĞİL — `patches/react-native-web+0.21.2.patch`
// onu `window.alert`/`window.confirm`'e yönlendiriyor (bkz. docs/HISTORY.md Madde 190).
// Web dalı yine de `window.confirm`'e DOĞRUDAN gidiyor; sebep başka: `window.confirm`
// yalnızca sabit "OK/Cancel" etiketleriyle çalışır, `confirmLabel`/`cancelLabel`
// parametrelerini yansıtamaz — patch de aynı kısıtı taşıyor. Doğrudan çağırmak bu
// sınırı gizlemiyor, görünür bırakıyor.
//
// Android'de `Alert.alert` VARSAYILAN OLARAK kapatılabilir (dışına dokunma / geri
// tuşu diyaloğu kapatır). `onDismiss` verilmezse bu kapanış hiçbir `onPress`'i
// tetiklemez — döndürülen Promise SONSUZA DEK askıda kalır (F17, HISTORY Madde 193).
// `onDismiss` bu yüzden `resolve(false)`'a bağlandı: dışarı dokunmak "vazgeç" sayılır.
export const confirmAsync = (
  title: string,
  message: string,
  confirmLabel: string,
  cancelLabel: string
): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
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
};

/** Tek butonlu (yalnızca "Tamam") bilgi mesajı — web'de window.alert'e düşer. */
export const notify = (title: string, message: string): void => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

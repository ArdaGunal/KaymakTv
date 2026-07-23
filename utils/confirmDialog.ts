import { Alert, Platform } from 'react-native';

/**
 * react-native-web'de `Alert.alert` TAM BİR NO-OP'tur
 * (node_modules/react-native-web/dist/exports/Alert/index.js — `static alert() {}`)
 * — hem çoklu butonlu onaylar HEM DE tek butonlu bilgi mesajları web'de
 * SESSİZCE hiçbir şey yapmaz (ne dialog çıkar ne de onPress tetiklenir).
 * Bu modül, projenin her yerinde AYNI web-güvenli davranışı garanti eden TEK
 * kaynaktır — daha önce her ekran kendi `confirmAsync` kopyasını yazıyordu
 * (app/(protected)/list/[id].tsx, error-log.tsx, OptionsModal.tsx,
 * SeasonAccordion.tsx...); artık hepsi buradan içe aktarır.
 */
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
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
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

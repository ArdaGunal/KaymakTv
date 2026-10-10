import { Alert, Platform } from 'react-native';
import { dialogHostVar, useDialogStore } from '../store/dialogStore';

// Onay ve bilgi kutuları için TEK giriş noktası — her yerden (hook, servis, olay
// işleyici) çağrılabilen Promise.
//
// 🔴 GORSEL-01 / BACKLOG C34 (2026-10-10): kutuyu artık kökteki `ConfirmHost` çizer
// (uygulamanın koyu `ConfirmModal`'ı). Eskiden Android yerel `Alert.alert` açılıyordu →
// koyu uygulamada BEYAZ pencere; web'de `window.confirm` düğme etiketlerini bile
// yansıtamıyordu (sabit "OK/Cancel"). Kullanıcı kararı (2026-09-06): *"emin misiniz
// sorusu siteye daha da yakışır bir kutucuk ile sorulabilir."* Projede doğrudan
// `Alert.alert` YASAK — `tests/arayuz/onay-kutusu.test.mjs` denetler.
//
// Aşağıdaki yerel dallar YALNIZ yedek: host henüz bağlanmamışsa (çok erken açılış).
//
// ⚠️ Web'de `Alert.alert` no-op DEĞİL — `patches/react-native-web+0.21.2.patch` onu
// `window.alert`/`window.confirm`'e yönlendiriyor (HISTORY Madde 190).
// ⚠️ Android'de yerel diyalog dışına dokunma / geri tuşuyla kapanır; `onDismiss`
// verilmezse hiçbir `onPress` tetiklenmez ve Promise SONSUZA DEK askıda kalır (F17,
// HISTORY Madde 193). Host'ta aynı tuzağı `ConfirmModal.onRequestClose` kapatır.

const yerelOnay = (title: string, message: string, confirmLabel: string, cancelLabel: string, destructive: boolean) => {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
};

/**
 * Evet/hayır onayı. Dışarı dokunma ve geri tuşu «vazgeç» (false) sayılır.
 * Varsayılan olarak onay düğmesi kırmızıdır (silme gibi geri alınamaz işlemler).
 */
export const confirmAsync = async (
  title: string,
  message: string,
  confirmLabel: string,
  cancelLabel: string,
  opts: { destructive?: boolean } = {}
): Promise<boolean> => {
  const destructive = opts.destructive ?? true;
  if (!dialogHostVar()) return yerelOnay(title, message, confirmLabel, cancelLabel, destructive);
  const r = await useDialogStore.getState().open({ title, message, confirmLabel, cancelLabel, destructive });
  return r === 'confirm';
};

/**
 * İki EYLEM arasında seçim (ör. «Öncekileri de İşaretle» / «Yalnızca Bu Bölüm»).
 * `confirmAsync`'ten farkı: ikincil düğme vazgeçme değil bir eylemdir; dışarı dokunma
 * ve geri tuşu `null` döner → çağıran HİÇBİR ŞEY yapmaz.
 */
export const chooseAsync = async (
  title: string,
  message: string,
  primaryLabel: string,
  secondaryLabel: string
): Promise<'primary' | 'secondary' | null> => {
  if (!dialogHostVar()) {
    if (Platform.OS === 'web') return window.confirm(`${title}\n\n${message}`) ? 'primary' : 'secondary';
    return new Promise((resolve) => {
      Alert.alert(
        title,
        message,
        [
          { text: secondaryLabel, style: 'cancel', onPress: () => resolve('secondary') },
          { text: primaryLabel, onPress: () => resolve('primary') },
        ],
        { cancelable: true, onDismiss: () => resolve(null) }
      );
    });
  }
  const r = await useDialogStore.getState().open({
    title,
    message,
    confirmLabel: primaryLabel,
    cancelLabel: secondaryLabel,
    destructive: false,
  });
  return r === 'confirm' ? 'primary' : r === 'cancel' ? 'secondary' : null;
};

/** Tek düğmeli («Tamam») bilgi/hata mesajı. Beklemek gerekmez; Promise kapanınca çözülür. */
export const notify = (title: string, message: string): Promise<void> => {
  if (!dialogHostVar()) {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
    return Promise.resolve();
  }
  return useDialogStore
    .getState()
    .open({ title, message, destructive: false })
    .then(() => undefined);
};

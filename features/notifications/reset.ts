import { cancelAllOwnedNotifications } from './scheduling/scheduler';
import { resetInboxState } from './inbox/useInboxStore';
import { resetPushPrefsState } from './store/usePushPrefsStore';

/**
 * Çıkışta bildirim durumunu temizler (`context/AuthContext.tsx` → `removeKeys`).
 *
 * 🔴 NEDEN GEREKLİ — bu projede DAHA ÖNCE YAŞANMIŞ bir hata sınıfı:
 * "State Leakage" (2026-08-21, canlı testte bulundu). `AsyncStorage.clear()`
 * yalnızca DİSKTEKİ kopyayı siler; Zustand store'ları RAM'de singleton olduğu
 * için uygulama tamamen kapatılmadan çıkış-giriş yapılırsa önceki hesabın
 * verisi hafızada kalır. `followStore`, `useLibraryStore` ve `feedStore` için
 * bu tek tek çözülmüştü — bildirim store'ları o listeye eklenmemişti.
 *
 * 🔴 AMA ASIL SIZINTI DİSKTE DE DEĞİL: zamanlanmış bildirimler ne RAM'de ne
 * AsyncStorage'da — **işletim sisteminde** duruyor. `AsyncStorage.clear()`
 * onlara hiç dokunmaz. Somut senaryo: kullanıcı Trakt hesabından çıkıp
 * MİSAFİR olarak devam ederse, `useNotificationSetup` misafir kontrolünde
 * erkenden çıkar ve o bildirimleri iptal edecek hiçbir kod çalışmaz —
 * önceki hesabın dizileri için bildirim düşmeye devam eder.
 *
 * ⚠️ BARREL'DAN (`index.ts`) İMPORT ETME. `index.ts` `NotificationBadge`'i de
 * dışa açıyor, o da `context/AuthContext`'i import ediyor; barrel üzerinden
 * çağırmak AuthContext → index → NotificationBadge → AuthContext döngüsü
 * kurardı. Bu dosya bilinçli olarak yalnızca store'lara ve zamanlayıcıya
 * bağlı — hiçbiri AuthContext'e dönmüyor.
 */
export async function resetNotificationState(): Promise<void> {
  // Sıra önemli: önce cihazdaki kurulu bildirimler iptal edilir. Store'lar
  // sıfırlandıktan sonra "bizim" olan bildirimleri tanıyacak bilgi yine
  // duruyor (kayıt defteri statiktir), ama iptali beklemeye gerek yok.
  await cancelAllOwnedNotifications();

  resetPushPrefsState();
  resetInboxState();
}

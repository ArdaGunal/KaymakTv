import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  getPermissionStatus,
  openSystemNotificationSettings,
  requestPermission,
} from '../permissions';
import { NOTIFICATION_CATEGORIES } from '../registry';
import { usePushPrefsStore } from '../store/usePushPrefsStore';
import type { NotificationCategoryId, NotificationPermissionStatus } from '../types';

/**
 * Ayarlar › Bildirimler ekranının TÜM mantığı (docs/design/notifications.md § 6).
 * Ekran bileşeni yalnızca çizim yapar — UI/Logic ayrımı (AGENTS.md).
 */
export function useNotificationPrefs() {
  const prefs = usePushPrefsStore((state) => state.prefs);
  const isHydrated = usePushPrefsStore((state) => state.isHydrated);
  const setMasterEnabled = usePushPrefsStore((state) => state.setMasterEnabled);
  const setCategoryEnabled = usePushPrefsStore((state) => state.setCategoryEnabled);
  const setPreferredHour = usePushPrefsStore((state) => state.setPreferredHour);

  const [permission, setPermission] = useState<NotificationPermissionStatus | null>(null);

  const refreshPermission = useCallback(async () => {
    setPermission(await getPermissionStatus());
  }, []);

  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  // 🔑 Kullanıcı cihaz ayarlarına gidip izni açıp geri dönebilir. Yeniden
  // okumazsak ekran "kapalı" göstermeye devam eder ve kullanıcı ayarı
  // değiştirmenin işe yaramadığını sanır.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermission();
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  /**
   * Bir anahtar AÇILDIĞINDA izin iste — uygulama açılışında değil.
   * iOS'ta bir kez reddedilen izin uygulama içinden bir daha istenemez, bu
   * yüzden istemenin doğru anı kullanıcının niyetini belli ettiği andır
   * (bkz. permissions.ts).
   */
  const ensurePermissionForEnable = useCallback(async (): Promise<boolean> => {
    const current = await getPermissionStatus();
    if (current === 'granted') return true;
    if (current === 'unsupported') {
      // Web: sistem diyaloğu diye bir şey yok. Durum satırı zaten söylüyor.
      setPermission(current);
      return false;
    }

    // 'undetermined' VEYA 'denied' → yine de dene.
    //
    // 🔑 'denied' iken de denemek BİLİNÇLİ: kullanıcı Ayarlar'da anahtara
    // ELLE dokundu, bu açık bir niyet beyanıdır — otomatik sorma değildir.
    // Android'de "bir kez reddet" kalıcı değildir, sistem diyaloğu tekrar
    // açılır. iOS'ta veya "bir daha sorma" durumunda `requestPermission`
    // kendi içindeki `canAskAgain` kontrolüyle diyaloğu hiç açmadan 'denied'
    // döner; kullanıcı da cihaz ayarlarına yönlendiren satırı görür.
    const requested = await requestPermission();
    setPermission(requested);
    return requested === 'granted';
  }, []);

  const toggleMaster = useCallback(
    async (next: boolean) => {
      if (next) await ensurePermissionForEnable();
      // İzin verilmese bile tercih KAYDEDİLİR: kullanıcı niyetini belirtti,
      // izni sonra cihaz ayarlarından açtığında sistem kendiliğinden çalışsın.
      // (Planlama zaten izin yoksa hiçbir şey kurmuyor — useNotificationSetup.)
      setMasterEnabled(next);
    },
    [ensurePermissionForEnable, setMasterEnabled],
  );

  const toggleCategory = useCallback(
    async (id: NotificationCategoryId, next: boolean) => {
      if (next) await ensurePermissionForEnable();
      setCategoryEnabled(id, next);
    },
    [ensurePermissionForEnable, setCategoryEnabled],
  );

  return {
    prefs,
    isHydrated,
    permission,
    categories: NOTIFICATION_CATEGORIES,
    toggleMaster,
    toggleCategory,
    setPreferredHour,
    openSystemNotificationSettings,
  };
}

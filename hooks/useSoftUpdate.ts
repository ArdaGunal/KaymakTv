import { useEffect, useState } from 'react';
import { Platform, Linking } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettingsStore } from '../store/appSettingsStore';
import { isVersionBelow } from '../utils/semver';
import { STORE_URL } from '../utils/constants';

const SNOOZE_KEY = 'soft_update_snoozed_until';
const SNOOZE_DURATION_MS = 5 * 60 * 60 * 1000; // 5 saat

export function useSoftUpdate() {
  const [showBanner, setShowBanner] = useState(false);
  const { settings, isFetched } = useAppSettingsStore();

  useEffect(() => {
    // 1. Platform Kontrolü: Web'de ASLA çalışmaz
    if (Platform.OS === 'web') {
      setShowBanner(false);
      return;
    }

    const checkSoftUpdate = async () => {
      // 2. Çift İstek Engellemesi: VersionGate'in (appSettingsStore'un) çektiği datayı kullanıyoruz
      if (!isFetched || !settings) return;

      const currentVersion = Application.nativeApplicationVersion;
      if (!currentVersion) return;

      // 3. Güvenli SemVer: isVersionBelow zaten utils/semver.ts içinde Integer split mantığıyla yazılmış durumda.
      if (isVersionBelow(currentVersion, settings.latestVersion)) {
        try {
          const snoozedUntilStr = await AsyncStorage.getItem(SNOOZE_KEY);
          if (snoozedUntilStr) {
            const snoozedUntil = parseInt(snoozedUntilStr, 10);
            if (Date.now() < snoozedUntil) {
              // Snooze süresi henüz dolmamış
              return;
            }
          }
          setShowBanner(true);
        } catch (error) {
          console.warn('[useSoftUpdate] Snooze kontrolü başarısız:', error);
          setShowBanner(true);
        }
      }
    };

    checkSoftUpdate();
  }, [settings, isFetched]);

  const onSnooze = async () => {
    setShowBanner(false);
    const snoozedUntil = Date.now() + SNOOZE_DURATION_MS;
    try {
      await AsyncStorage.setItem(SNOOZE_KEY, snoozedUntil.toString());
    } catch (e) {
      console.warn('[useSoftUpdate] Snooze edilemedi:', e);
    }
  };

  const onUpdate = () => {
    const url = settings?.updateUrl || STORE_URL;
    Linking.openURL(url).catch((err) => console.error('URL açılamadı:', err));
  };

  return { showBanner, onSnooze, onUpdate };
}

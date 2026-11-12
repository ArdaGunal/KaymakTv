import { useEffect, useState } from 'react';
import { Platform, Linking } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettingsStore } from '../store/appSettingsStore';
import { guncellemeAdresi } from '../features/versionGate/services/dagitim';
import { kuruluYapiNumarasi } from '../features/versionGate/services/surumKarari';
import { bantGosterilsinMi } from '../features/versionGate/services/bantKarari';

const SNOOZE_KEY = 'soft_update_snoozed_until';
const SNOOZE_DURATION_MS = 5 * 60 * 60 * 1000; // 5 saat

/**
 * «Yeni sürüm var» bandı. Veriyi `VersionGate`'in çektiği `appSettingsStore`'dan alır (çift istek yok).
 * YAYIN_ONCESI_PLAN Adım 1: yapı numarası (versionCode) ile `min_required_build` / `latest_build`
 * karşılaştırılır; sürüm adına bakılmaz. Karar saf `bantGosterilsinMi`'de.
 */
export function useSoftUpdate() {
  const [showBanner, setShowBanner] = useState(false);
  const { settings, isFetched } = useAppSettingsStore();

  useEffect(() => {
    if (Platform.OS === 'web') {
      setShowBanner(false);
      return;
    }

    const checkSoftUpdate = async () => {
      if (!isFetched || !settings) return;

      const karar = bantGosterilsinMi(kuruluYapiNumarasi(Application.nativeBuildVersion), settings);
      if (karar === 'yok') return;
      // Zorunlu güncelleme bekliyorsa bant ertelemeye bakmadan açılır (oturum içinde engel yerine).
      if (karar === 'zorunlu') {
        setShowBanner(true);
        return;
      }

      try {
        const snoozedUntilStr = await AsyncStorage.getItem(SNOOZE_KEY);
        if (snoozedUntilStr && Date.now() < parseInt(snoozedUntilStr, 10)) return;
        setShowBanner(true);
      } catch (error) {
        console.warn('[useSoftUpdate] Snooze kontrolü başarısız:', error);
        setShowBanner(true);
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
    Linking.openURL(guncellemeAdresi(settings)).catch((err) => console.error('URL açılamadı:', err));
  };

  return { showBanner, onSnooze, onUpdate };
}

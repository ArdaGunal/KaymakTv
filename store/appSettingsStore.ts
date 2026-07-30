import { create } from 'zustand';
import { getAppSettings, AppSettings } from '../features/versionGate/services/appSettingsApi';

interface AppSettingsState {
  settings: AppSettings | null;
  isFetched: boolean;
  
  // `getAppSettings` Promise'ini döndüren bir fonksiyon.
  // Çift API isteği olmaması için `settings` zaten varsa anında döner.
  fetchSettings: () => Promise<AppSettings | null>;
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => {
  let fetchPromise: Promise<AppSettings | null> | null = null;

  return {
    settings: null,
    isFetched: false,

    fetchSettings: async () => {
      // Zaten çekildiyse cache'den dön
      if (get().isFetched) {
        return get().settings;
      }
      
      // Halihazırda süren bir istek varsa, onu bekle (race condition engeli)
      if (fetchPromise) {
        return fetchPromise;
      }

      // Yeni istek başlat
      fetchPromise = getAppSettings().then((data) => {
        set({ settings: data, isFetched: true });
        return data;
      }).catch(() => {
        return null;
      }).finally(() => {
        fetchPromise = null;
      });

      return fetchPromise;
    }
  };
});

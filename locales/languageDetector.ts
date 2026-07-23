import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageDetectorAsyncModule } from 'i18next';

export const LANGUAGE_KEY = 'app_language';
export const SUPPORTED_LANGUAGES = ['en', 'tr'];
export const FALLBACK_LANGUAGE = 'en';

export const languageDetector: LanguageDetectorAsyncModule = {
  type: 'languageDetector',
  async: true,
  // NOT: i18next'in `detect` imzası ya `callback(lng)` çağırmayı ya da doğrudan
  // `Promise<string>` DÖNDÜRMEYİ bekler — ikisi birden değil. Önceden `async`
  // bir fonksiyon İÇİNDE `return callback(...)` yapılıyordu; bu, dönüş tipini
  // `Promise<void>` yapıyordu (callback zaten void döner) ki bu tip beklenen
  // `Promise<string | readonly string[] | undefined>` ile uyuşmuyordu. Artık
  // değer callback'e değil, doğrudan `return` ile veriliyor.
  detect: async (): Promise<string> => {
    try {
      // 1. Önce kullanıcının kendi seçtiği bir dil var mı kontrol et
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage)) {
        return savedLanguage;
      }

      // 2. Yoksa cihazın varsayılan dilini al
      const locales = Localization.getLocales();
      if (locales && locales.length > 0) {
        const locale = locales[0].languageTag;
        const lang = locale.split('-')[0]; // Örn: tr-TR -> tr

        // 3. Cihaz dili desteklenen dillerimizden biriyse (örneğin tr veya en), onu kullan
        if (SUPPORTED_LANGUAGES.includes(lang)) {
          return lang;
        }
      }

      // 4. Cihaz dili desteklenmiyorsa (Almanca, Fransızca vb.) global dil olarak İngilizceye (fallback) düş
      return FALLBACK_LANGUAGE;
    } catch (error) {
      console.log('Error reading language', error);
      // Olası bir hatada uygulamanın çökmesini önlemek için yine global dile düş
      return FALLBACK_LANGUAGE;
    }
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    try {
      if (SUPPORTED_LANGUAGES.includes(lng)) {
        await AsyncStorage.setItem(LANGUAGE_KEY, lng);
      }
    } catch (error) {
      console.log('Error saving language', error);
    }
  },
};

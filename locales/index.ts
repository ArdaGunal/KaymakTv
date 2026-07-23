import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { languageDetector, FALLBACK_LANGUAGE } from './languageDetector';
import { resources } from './resources';

// `compatibilityJSON: 'v3'` kasıtlı olarak kaldırıldı — yüklü i18next sürümünün
// (26.x) hem tip tanımlarında hem çalışma zamanında bu seçenek tamamen
// kaldırılmış (yalnızca 'v4' kabul ediliyor, derlenmiş i18next.js'te
// "compatibilityJSON" hiç geçmiyor); yani zaten çalışma zamanında etkisizdi.
// Proje çeviri dosyalarının hiçbiri v3'e özgü `_plural` anahtar biçimini
// kullanmıyor, kaldırmak davranışı değiştirmiyor.
i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;

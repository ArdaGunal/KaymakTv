import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { languageDetector, FALLBACK_LANGUAGE } from './languageDetector';
import { resources } from './resources';

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;

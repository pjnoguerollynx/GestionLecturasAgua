import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';
import ca from './locales/ca.json';
import eu from './locales/eu.json';
import gl from './locales/gl.json';

// the translations
const resources = {
  en: {
    translation: en,
  },
  es: {
    translation: es,
  },
  ca: {
    translation: ca,
  },
  eu: {
    translation: eu,
  },
  gl: {
    translation: gl,
  },
};

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: 'es', // language to use, can be detected from device or set by user
    fallbackLng: 'en', // use en if detected lng is not available

    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    compatibilityJSON: 'v4', // To make it work for Android devices, changed to v4
  });

export default i18n;

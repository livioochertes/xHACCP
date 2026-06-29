import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ro from './locales/ro.json';
import fr from './locales/fr.json';

function detectLanguage() {
  const saved = localStorage.getItem('adminLang');
  if (saved && ['en', 'ro', 'fr'].includes(saved)) return saved;
  try {
    const user = JSON.parse(localStorage.getItem('adminUser') || 'null');
    if (user?.adminMarkets?.length) {
      const map = { ro: 'ro', fr: 'fr', com: 'en' };
      return map[user.adminMarkets[0]] || 'ro';
    }
  } catch (e) {}
  return 'ro';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ro: { translation: ro },
    fr: { translation: fr },
  },
  lng: detectLanguage(),
  fallbackLng: 'ro',
  interpolation: { escapeValue: false },
});

export default i18n;

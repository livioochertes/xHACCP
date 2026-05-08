import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'zh' | 'ja' | 'ko' | 'ar' | 'ro';

export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  // European languages in alphabetical order
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },

  // Asian languages in alphabetical order
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
];

// Map ISO country code → app language
const COUNTRY_TO_LANGUAGE: Record<string, Language> = {
  // Romanian
  RO: 'ro',
  // French-speaking
  FR: 'fr', BE: 'fr', MC: 'fr', LU: 'fr', CI: 'fr', SN: 'fr', CM: 'fr', MG: 'fr',
  // German-speaking
  DE: 'de', AT: 'de', CH: 'de', LI: 'de',
  // Spanish-speaking
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es', VE: 'es',
  EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
  SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', GQ: 'es',
  // Portuguese-speaking
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt',
  // Italian-speaking
  IT: 'it', SM: 'it', VA: 'it',
  // Chinese-speaking
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh', SG: 'zh',
  // Japanese
  JP: 'ja',
  // Korean
  KR: 'ko',
  // Arabic-speaking
  SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', DZ: 'ar', TN: 'ar', JO: 'ar',
  LB: 'ar', KW: 'ar', BH: 'ar', QA: 'ar', OM: 'ar', YE: 'ar', SD: 'ar',
  SY: 'ar', IQ: 'ar', LY: 'ar', MR: 'ar',
};

/**
 * Returns a language forced by the current domain, or null if domain is neutral.
 * .ro → Romanian, .fr → French, .com → null (use IP detection)
 */
function getDomainLanguage(): Language | null {
  try {
    const hostname = window.location.hostname;
    if (hostname === 'xhaccp.ro' || hostname.endsWith('.xhaccp.ro')) return 'ro';
    if (hostname === 'xhaccp.fr' || hostname.endsWith('.xhaccp.fr')) return 'fr';
    // xhaccp.com and all dev/preview URLs → no forced language
    return null;
  } catch {
    return null;
  }
}

/**
 * Detects user country via ipapi.co and maps to an app language.
 * Cached in sessionStorage to avoid repeated requests within the same session.
 */
async function detectLanguageByIP(): Promise<Language | null> {
  const SESSION_KEY = 'xhaccp-ip-lang';
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached && SUPPORTED_LANGUAGES.some(l => l.code === cached)) {
      return cached as Language;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    const lang = COUNTRY_TO_LANGUAGE[data.country_code as string] || null;
    if (lang) sessionStorage.setItem(SESSION_KEY, lang);
    return lang;
  } catch {
    return null;
  }
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
  getLanguageInfo: (code: Language) => LanguageInfo | undefined;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Priority 1: user's explicit saved choice
    const saved = localStorage.getItem('xhaccp-language') as Language;
    if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) return saved;

    // Priority 2: domain-based language (instant, no network)
    const domainLang = getDomainLanguage();
    if (domainLang) return domainLang;

    // Priority 3: browser language (used as placeholder until IP detection completes)
    const browserLang = navigator.language.split('-')[0] as Language;
    if (SUPPORTED_LANGUAGES.some(l => l.code === browserLang)) return browserLang;

    return 'en';
  });

  // Async IP-based detection — runs only when no explicit user choice and no domain signal
  useEffect(() => {
    const saved = localStorage.getItem('xhaccp-language');
    const domainLang = getDomainLanguage();

    // Skip: user already chose, or domain forces a language
    if (saved || domainLang) return;

    detectLanguageByIP().then(lang => {
      if (lang) setLanguageState(lang);
    });
  }, []);

  const applyDirection = (lang: Language) => {
    const info = SUPPORTED_LANGUAGES.find(l => l.code === lang);
    document.documentElement.setAttribute('dir', info?.rtl ? 'rtl' : 'ltr');
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('xhaccp-language', lang);
    applyDirection(lang);
  };

  const getLanguageInfo = (code: Language) =>
    SUPPORTED_LANGUAGES.find(l => l.code === code);

  const isRTL = SUPPORTED_LANGUAGES.find(l => l.code === language)?.rtl || false;

  useEffect(() => {
    applyDirection(language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL, getLanguageInfo }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}

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
    // Get language from localStorage or browser preference
    const savedLanguage = localStorage.getItem('xhaccp-language') as Language;
    if (savedLanguage && SUPPORTED_LANGUAGES.some(lang => lang.code === savedLanguage)) {
      return savedLanguage;
    }
    
    // Try to detect browser language
    const browserLang = navigator.language.split('-')[0] as Language;
    if (SUPPORTED_LANGUAGES.some(lang => lang.code === browserLang)) {
      return browserLang;
    }
    
    return 'en'; // Default to English
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('xhaccp-language', lang);
    
    // Update document direction for RTL languages
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === lang);
    if (langInfo?.rtl) {
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
    }
  };

  const getLanguageInfo = (code: Language) => {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
  };

  const isRTL = SUPPORTED_LANGUAGES.find(lang => lang.code === language)?.rtl || false;

  // Set initial direction on mount
  useEffect(() => {
    const langInfo = getLanguageInfo(language);
    if (langInfo?.rtl) {
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
    }
  }, [language]);

  return (
    <LanguageContext.Provider 
      value={{
        language,
        setLanguage,
        isRTL,
        getLanguageInfo,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
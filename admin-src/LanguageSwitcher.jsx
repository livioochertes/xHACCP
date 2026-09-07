import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  const languages = [
    { code: 'ro', label: '🇷🇴 RO' },
    { code: 'fr', label: '🇫🇷 FR' },
    { code: 'en', label: '🌐 EN' },
  ];

  const handleChange = async (lang) => {
    await i18n.changeLanguage(lang);
    localStorage.setItem('adminLang', lang);
    window.dispatchEvent(new CustomEvent('admin-category-translations-updated', {
      detail: { language: lang },
    }));
  };

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {languages.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => handleChange(code)}
          style={{
            padding: '4px 10px',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            background: current === code
              ? 'linear-gradient(135deg, #667eea, #764ba2)'
              : '#f0f0f0',
            color: current === code ? 'white' : '#555',
            transition: 'all 0.2s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

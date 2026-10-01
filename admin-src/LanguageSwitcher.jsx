import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { emitCategoryTranslationUpdate } from './categoryTranslationSync.js';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);

  const languages = [
    { code: 'ro', abbreviation: 'RO', flag: '🇷🇴', name: 'Română' },
    { code: 'en', abbreviation: 'EN', flag: '🇬🇧', name: 'English' },
    { code: 'fr', abbreviation: 'FR', flag: '🇫🇷', name: 'Français' },
  ];
  const currentCode = (i18n.language || 'ro').split('-')[0].toLowerCase();
  const selectedLanguage = languages.find(({ code }) => code === currentCode) || languages[0];

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleChange = async (lang) => {
    await i18n.changeLanguage(lang);
    localStorage.setItem('adminLang', lang);
    emitCategoryTranslationUpdate({
      language: lang,
    });
    setMenuOpen(false);
    triggerRef.current?.focus();
  };

  const handleOptionKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % languages.length;
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + languages.length) % languages.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = languages.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      optionRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div
      className="language-switcher"
      ref={pickerRef}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          setMenuOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        className="language-switcher-trigger"
        type="button"
        aria-label={t('header.languageSwitcher', { language: selectedLanguage.name })}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          const shouldOpen = !menuOpen;
          setMenuOpen(shouldOpen);
          if (shouldOpen) {
            const selectedIndex = languages.findIndex(({ code }) => code === selectedLanguage.code);
            window.requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
          }
        }}
      >
        <span className="language-switcher-flag" aria-hidden="true">{selectedLanguage.flag}</span>
        <span>{selectedLanguage.abbreviation}</span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={menuOpen ? 'is-open' : ''}
        />
      </button>
      {menuOpen && (
        <div className="language-switcher-menu" role="menu" aria-label={t('header.chooseLanguage')}>
          {languages.map(({ code, abbreviation, flag, name }, index) => (
            <button
              key={code}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              role="menuitemradio"
              aria-checked={selectedLanguage.code === code}
              className={`language-switcher-option${selectedLanguage.code === code ? ' is-selected' : ''}`}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              onClick={() => handleChange(code)}
            >
              <span className="language-switcher-flag" aria-hidden="true">{flag}</span>
              <span className="language-switcher-name">{name}</span>
              <span className="language-switcher-abbreviation">{abbreviation}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

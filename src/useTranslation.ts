import { translations, Language, TranslationKey } from './i18n';

export function useTranslation() {
  const language = (localStorage.getItem('arka-language') as Language) || 'id';
  
  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.id[key] || key;
  };
  
  return { t, language };
}

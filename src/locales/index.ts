import type { Locale } from '../contexts/LocaleContext';
import { useLocale } from '../contexts/LocaleContext';
import en from './en.json';
import am from './am.json';

/** Per-site content: English and Armenian are two separate sites; no content from one locale is shown on the other. */
export const translations: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  am: am as Record<string, string>,
};

export function getT(locale: Locale): (key: string) => string {
  return (key: string) => {
    const dict = translations[locale];
    return (dict && dict[key]) ?? key;
  };
}

export function useTranslation(): { t: (key: string) => string } {
  const { locale } = useLocale();
  return { t: getT(locale) };
}

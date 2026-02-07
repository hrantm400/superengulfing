import React, { useEffect } from 'react';
import { useLocale } from '../contexts/LocaleContext';

/** Sets document.documentElement.lang based on current locale (hy for Armenian, en for English). */
export default function SetDocumentLang() {
  const { locale } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale === 'am' ? 'hy' : 'en';
  }, [locale]);
  return null;
}

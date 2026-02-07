import React, { createContext, useContext, useMemo } from 'react';
import { useLocation, Link, LinkProps } from '@remix-run/react';
import { useUser } from './UserContext';

/** English (/) and Armenian (/am) are two separate sites with separate content; no content from one locale is shown on the other. */
export type Locale = 'en' | 'am';

interface LocaleContextType {
  locale: Locale;
  basePath: string;
  /** Path with locale prefix: '/course-access' -> '/am/course-access' when am */
  localizePath: (path: string) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pathname = location.pathname;
  const { profile } = useUser();

  const value = useMemo(() => {
    const locale: Locale = profile?.locale ?? (pathname.startsWith('/am') ? 'am' : 'en');
    const basePath = locale === 'am' ? '/am' : '';
    const localizePath = (path: string) => {
      const p = path.startsWith('/') ? path : `/${path}`;
      return basePath ? `${basePath}${p}` : p;
    };
    return { locale, basePath, localizePath };
  }, [pathname, profile?.locale]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextType {
  const ctx = useContext(LocaleContext);
  if (ctx === undefined) throw new Error('useLocale must be used within LocaleProvider (inside Router)');
  return ctx;
}

/** Link that prepends locale prefix when locale is am */
export function useLocalizedPath(): (path: string) => string {
  const { localizePath } = useLocale();
  return localizePath;
}

/** Link with to path localized (use for in-app links that should stay in current locale) */
export function LocaleLink({ to, ...props }: LinkProps & { to: string }) {
  const { localizePath } = useLocale();
  const localizedTo = typeof to === 'string' ? localizePath(to) : to;
  return <Link to={localizedTo} {...props} />;
}

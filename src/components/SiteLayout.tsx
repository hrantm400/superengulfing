import React from 'react';
import { Outlet } from '@remix-run/react';
import { useLocale } from '../contexts/LocaleContext';
import SiteNavbar from './SiteNavbar';
import SiteFooter from './SiteFooter';

const SiteLayout: React.FC = () => {
  const { locale } = useLocale();
  return (
    <div
      className={`min-h-screen flex flex-col bg-background text-foreground ${locale === 'am' ? 'font-display-armenian' : 'font-display'}`}
      lang={locale === 'am' ? 'hy' : 'en'}
    >
      <SiteNavbar />
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
};

export default SiteLayout;

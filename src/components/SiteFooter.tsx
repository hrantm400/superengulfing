import React from 'react';
import { LocaleLink } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';

const SiteFooter: React.FC = () => {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border py-12 bg-background/80 backdrop-blur-sm relative z-10 mt-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">

        <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-12">
          {/* Brand Info */}
          <div className="max-w-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">candlestick_chart</span>
              <h1 className="text-foreground text-lg font-bold tracking-tight uppercase">SuperEngulfing</h1>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              {t('footer.brandDesc')}
            </p>
          </div>

          {/* Navigation Columns */}
          <div className="grid grid-cols-2 gap-12 w-full md:w-auto">
            <div className="space-y-4">
              <h4 className="text-foreground font-bold text-sm">{t('footer.product')}</h4>
              <ul className="space-y-2 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <span>{t('footer.indicatorV4')}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary -translate-y-0.5 shrink-0">{t('footer.soon')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>{t('footer.academy')}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary -translate-y-0.5 shrink-0">{t('footer.soon')}</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-foreground font-bold text-sm">{t('footer.legal')}</h4>
              <ul className="space-y-2 text-sm text-muted">
                <li><LocaleLink to="/terms" className="hover:text-primary transition-colors duration-300">{t('footer.terms')}</LocaleLink></li>
                <li><LocaleLink to="/privacy" className="hover:text-primary transition-colors duration-300">{t('footer.privacy')}</LocaleLink></li>
                <li><LocaleLink to="/disclaimer" className="hover:text-primary transition-colors duration-300">{t('footer.disclaimer')}</LocaleLink></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border pt-8">
          <p className="text-muted text-xs">{t('footer.copyright')}</p>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 p-6 bg-surfaceElevated rounded-[20px] text-[10px] text-muted text-center leading-relaxed border border-border">
          {t('footer.legalDisclaimer')}
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;

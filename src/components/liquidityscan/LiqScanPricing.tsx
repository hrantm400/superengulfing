import React from 'react';
import { useTranslation } from '../../locales';

const LIQSCAN_URL = 'https://liquidityscan.io';

const LiqScanPricing: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-16 md:py-20">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{t('liqScan.pricing.sectionTitle')}</h2>
        <p className="text-sm text-muted mt-1">{t('liqScan.pricing.sectionSubtitle')}</p>
      </div>

      <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-5 md:gap-6 items-stretch">
        <div className="rounded-2xl p-6 border border-border bg-surface/80 backdrop-blur-sm flex flex-col hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
          <h3 className="text-lg font-bold text-foreground">{t('liqScan.pricing.freeTitle')}</h3>
          <p className="text-xs text-muted mt-0.5 mb-4">{t('liqScan.pricing.freeSubtitle')}</p>
          <div className="flex items-baseline gap-1.5 mb-5">
            <span className="text-3xl font-black text-foreground">$0</span>
            <span className="text-xs text-muted">{t('liqScan.pricing.freeForever')}</span>
          </div>
          <ul className="space-y-2.5 mb-6 flex-1 text-sm">
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">check</span>
              <span className="text-foreground">{t('liqScan.pricing.freeF1')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">check</span>
              <span className="text-foreground">{t('liqScan.pricing.freeF2')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">check</span>
              <span className="text-foreground">{t('liqScan.pricing.freeF3')}</span>
            </li>
            <li className="flex items-center gap-2 opacity-50">
              <span className="material-symbols-outlined text-muted text-base">close</span>
              <span className="text-muted line-through">{t('liqScan.pricing.freeExclude')}</span>
            </li>
          </ul>
          <a
            href={LIQSCAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[48px] flex items-center justify-center py-3 rounded-xl font-semibold text-sm border border-border bg-surfaceElevated hover:bg-surface hover:border-primary/30 text-foreground transition-all text-center"
          >
            {t('liqScan.pricing.startFree')}
          </a>
        </div>

        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute -inset-px bg-gradient-to-b from-primary/40 to-primary/20 rounded-2xl blur-sm opacity-60"></div>
          <div className="relative p-6 border border-primary/40 rounded-2xl bg-surface flex flex-col h-full shadow-[0_0_0_1px_rgba(57,255,20,0.15)]">
            <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-[#020617] font-bold text-xs uppercase tracking-wider rounded-bl-xl">
              {t('liqScan.pricing.bestValue')}
            </div>
            <h3 className="text-lg font-bold text-foreground pr-16">{t('liqScan.pricing.proTitle')}</h3>
            <p className="text-xs text-muted mt-0.5 mb-4">{t('liqScan.pricing.proSubtitle')}</p>
            <div className="flex items-baseline gap-1.5 mb-5">
              <span className="text-3xl font-black text-foreground">$49</span>
            </div>
            <ul className="space-y-2.5 mb-6 flex-1 text-sm">
              {['proF1', 'proF2', 'proF3', 'proF4', 'proF5'].map((key) => (
                <li key={key} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base shrink-0">check_circle</span>
                  <span className="text-foreground">{t(`liqScan.pricing.${key}`)}</span>
                </li>
              ))}
            </ul>
            <a
              href={LIQSCAN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] flex items-center justify-center py-3 rounded-xl font-bold text-sm bg-primary hover:bg-primary-glow text-[#020617] transition-all shadow-[0_0_20px_rgba(57,255,20,0.2)] hover:shadow-[0_0_24px_rgba(57,255,20,0.3)] text-center"
            >
              {t('liqScan.pricing.getAccess')}
            </a>
            <p className="text-center text-xs text-muted mt-3">{t('liqScan.pricing.cancelAnytime')}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiqScanPricing;

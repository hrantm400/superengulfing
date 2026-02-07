import React from 'react';
import { useTranslation } from '../locales';

interface ProcessCardProps {
  affiliateLabel?: string;
  affiliateUrl?: string;
}

const ProcessCard: React.FC<ProcessCardProps> = ({ affiliateLabel = 'Affiliate Link', affiliateUrl = '#' }) => {
  const { t } = useTranslation();
  return (
    <div className="relative group">
      <div className="glass-panel p-8 rounded-card relative overflow-hidden bg-surface/60 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">

        <div className="flex justify-between items-center mb-8 pb-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('access.process.title')}</h2>
            <p className="text-xs text-muted mt-1 font-mono">{t('access.process.subtitle')}</p>
          </div>
          <div className="px-3 py-1 bg-primary/10 rounded border border-primary/20 text-primary text-[10px] font-mono font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">timer</span>
            {t('access.process.under5mins')}
          </div>
        </div>

        <div className="space-y-8 relative timeline-line pl-2">

          <div className="relative flex gap-6 z-10">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-black font-bold shadow-glow-primary-sm animate-glow-pulse z-10 shrink-0">
              1
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-foreground font-semibold text-lg">{t('access.step1.title')}</h3>
              <p className="text-sm text-muted mt-1">{t('access.step1.desc')}</p>
            </div>
          </div>

          <div className="relative flex gap-6 z-10">
            <div className="w-10 h-10 rounded-full bg-surface border border-primary/30 flex items-center justify-center text-primary font-bold z-10 shrink-0 animate-float">
              2
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-foreground font-semibold text-lg">{t('access.step2.title')}</h3>
              <p className="text-sm text-muted mt-1">{t('access.step2.desc')}</p>
            </div>
          </div>

        </div>

        <div className="mt-10 pt-6">
          <a
            href={affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 bg-primary hover:bg-primary-glow text-black font-bold text-center rounded-lg text-lg uppercase tracking-wide shadow-glow-primary-sm hover:shadow-glow-primary transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 relative group overflow-hidden"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {t('access.registerNow')}
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">open_in_new</span>
            </span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 skew-y-12"></div>
          </a>
        </div>

      </div>

      {/* Decorative Corners */}
      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-primary/30 rounded-tr-lg pointer-events-none"></div>
      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-primary/30 rounded-bl-lg pointer-events-none"></div>
    </div>
  );
};

export default ProcessCard;
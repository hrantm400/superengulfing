import React from 'react';
import { useTranslation } from '../locales';
import AnimatedSection from './ui/AnimatedSection';

const AccessHero: React.FC = () => {
  const { t } = useTranslation();
  return (
    <>
      <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

      <AnimatedSection className="space-y-6 relative z-10" delayMs={60}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-primary/20 bg-primary/5 text-primary text-[10px] font-mono uppercase tracking-widest">
          <span className="material-symbols-outlined text-sm">lock_open</span>
          {t('access.hero.badge')}
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-foreground leading-[1.1]">
          {t('access.hero.title1')} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground via-primary to-primary-glow">
            {t('access.hero.title2')}
          </span>
        </h1>
        <p className="text-muted text-lg font-light leading-relaxed max-w-lg">
          {t('access.hero.subtitle')}
        </p>
      </AnimatedSection>

      <AnimatedSection className="space-y-4" delayMs={140}>
        <h3 className="text-xs font-mono text-muted uppercase tracking-widest mb-6">
          {t('access.hero.whatUnlocking')}
        </h3>

        <FeatureItem
          icon="school"
          title={t('access.hero.feature1Title')}
          description={t('access.hero.feature1Desc')}
        />

        <FeatureItem
          icon="monitoring"
          title={t('access.hero.feature2Title')}
          description={t('access.hero.feature2Desc')}
        />

        <FeatureItem
          icon="forum"
          title={t('access.hero.feature3Title')}
          description={t('access.hero.feature3Desc')}
        />
      </AnimatedSection>
    </>
  );
};

interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => (
  <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-surfaceElevated hover:bg-surface/80 transition-colors group">
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform flex-shrink-0">
      <span className="material-symbols-outlined">{icon}</span>
    </div>
    <div>
      <h4 className="text-foreground font-bold mb-1">{title}</h4>
      <p className="text-sm text-muted">{description}</p>
    </div>
  </div>
);

export default AccessHero;
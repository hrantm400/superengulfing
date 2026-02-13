import React from 'react';
import { useTranslation } from '../locales';
import AnimatedSection from './ui/AnimatedSection';

const SocialProof: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section className="py-24 px-4 sm:px-6 border-t border-border bg-background/80 backdrop-blur-xl relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent blur-sm"></div>
      <AnimatedSection className="max-w-3xl mx-auto text-center space-y-8 relative z-10" delayMs={100}>
        <h2 className="text-2xl md:text-4xl text-foreground/90 font-light leading-relaxed">
          {t('home.socialProof.line1')}
          <span className="text-foreground font-medium border-b border-primary/50 pb-1">
            {t('home.socialProof.line2')}
          </span>
        </h2>
      </AnimatedSection>
    </section>
  );
};

export default SocialProof;
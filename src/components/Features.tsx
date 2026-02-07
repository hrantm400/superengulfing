import React from 'react';
import { useTranslation } from '../locales';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps & { index?: number }> = ({ icon, title, description, index = 0 }) => (
  <div
    className="p-6 rounded-card bg-surfaceElevated border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300 group animate-fade-in-up opacity-0 [animation-fill-mode:forwards]"
    style={{ animationDelay: `${0.15 + index * 0.08}s` }}
  >
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto text-primary group-hover:scale-110 transition-transform duration-300">
      <span className="material-symbols-outlined">{icon}</span>
    </div>
    <h3 className="text-foreground font-bold mb-2">{title}</h3>
    <p className="text-sm text-muted">{description}</p>
  </div>
);

const Features: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section className="py-24 px-4 sm:px-6 border-t border-border bg-background/80 relative overflow-hidden backdrop-blur-sm">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
      <div className="max-w-4xl mx-auto text-center space-y-10">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            index={0}
            icon="water_drop"
            title={t('home.features.card1Title')}
            description={t('home.features.card1Desc')}
          />
          <FeatureCard
            index={1}
            icon="query_stats"
            title={t('home.features.card2Title')}
            description={t('home.features.card2Desc')}
          />
          <FeatureCard
            index={2}
            icon="psychology"
            title={t('home.features.card3Title')}
            description={t('home.features.card3Desc')}
          />
        </div>
      </div>
    </section>
  );
};

export default Features;
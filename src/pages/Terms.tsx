import React from 'react';
import { LocaleLink } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';

const Terms: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative pt-24 md:pt-28 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12 md:mb-16">
            <div className="inline-block h-px w-24 bg-primary/50 mb-6" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-cinzel">
              {t('terms.title')}
            </h1>
            <p className="text-muted text-sm mt-3">{t('terms.lastUpdated')}</p>
            <p className="text-muted text-sm">{t('terms.operator')}</p>
            <div className="inline-block h-px w-24 bg-primary/50 mt-6" />
          </header>

          {/* Content */}
          <article className="space-y-10 text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">1.</span> {t('terms.section1.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                {t('terms.section1.content')}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">2.</span> {t('terms.section2.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                {t('terms.section2.content1')}
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                {t('terms.section2.content2')}
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                {t('terms.section2.content3')}
              </p>
              <ul className="list-disc pl-6 space-y-1 text-sm md:text-base leading-relaxed">
                <li>{t('terms.section2.item1')}</li>
                <li>{t('terms.section2.item2')}</li>
                <li>{t('terms.section2.item3')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">3.</span> {t('terms.section3.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                {t('terms.section3.content1')}
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                {t('terms.section3.content2')}
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                {t('terms.section3.content3')}
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                {t('terms.section3.content4')}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">4.</span> {t('terms.section4.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                {t('terms.section4.content1')}
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                {t('terms.section4.content2')}
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                {t('terms.section4.content3')}
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                {t('terms.section4.content4')}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">5.</span> {t('terms.section5.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                {t('terms.section5.content1')}
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                {t('terms.section5.content2')}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">6.</span> {t('terms.section6.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                {t('terms.section6.content1')}
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                {t('terms.section6.content2')}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">7.</span> {t('terms.section7.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                {t('terms.section7.content')}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">8.</span> {t('terms.section8.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                {t('terms.section8.content')}
              </p>
            </section>

            <section className="rounded-xl border border-primary/20 bg-primary/5 p-6 md:p-8">
              <h2 className="text-lg font-semibold text-foreground mb-3">{t('terms.acknowledgment.title')}</h2>
              <p className="text-sm md:text-base leading-relaxed">
                {t('terms.acknowledgment.content')}
              </p>
            </section>
          </article>

          {/* Footer CTA */}
          <footer className="mt-16 pt-8 border-t border-border text-center">
            <LocaleLink
              to="/"
              className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
            >
              ← Back to Home
            </LocaleLink>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Terms;

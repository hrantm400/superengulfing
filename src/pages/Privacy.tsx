import React from 'react';
import { LocaleLink } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';

const Privacy: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative pt-24 md:pt-28 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12 md:mb-16">
            <div className="inline-block h-px w-24 bg-primary/50 mb-6" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-cinzel">
              {t('privacy.title')}
            </h1>
            <p className="text-muted text-sm mt-3">{t('privacy.lastUpdated')}</p>
            <p className="text-muted text-sm">{t('terms.operator')}</p>
            <div className="inline-block h-px w-24 bg-primary/50 mt-6" />
          </header>

          {/* Intro */}
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-10">
            {t('privacy.intro')}
          </p>

          {/* Content */}
          <article className="space-y-10 text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">1.</span> {t('privacy.section1.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                {t('privacy.section1.content1')}
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                {t('privacy.section1.content2')}
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                {t('privacy.section1.content3')}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">2.</span> {t('privacy.section2.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                {t('privacy.section2.content1')}
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm md:text-base leading-relaxed">
                <li>{t('privacy.section2.item1')}</li>
                <li>{t('privacy.section2.item2')}</li>
                <li>{t('privacy.section2.item3')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">3.</span> {t('privacy.section3.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                {t('privacy.section3.content1')}
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                {t('privacy.section3.content2')}
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                {t('privacy.section3.content3')}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">4.</span> {t('privacy.section4.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                {t('privacy.section4.content')}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">5.</span> {t('privacy.section5.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                {t('privacy.section5.content')}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">6.</span> {t('privacy.section6.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                {t('privacy.section6.content1')}
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm md:text-base leading-relaxed">
                <li>{t('privacy.section6.item1')}</li>
                <li>{t('privacy.section6.item2')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">7.</span> {t('privacy.section7.title')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                {t('privacy.section7.content')}
              </p>
            </section>

            <section className="rounded-xl border border-primary/20 bg-primary/5 p-6 md:p-8">
              <h2 className="text-lg font-semibold text-foreground mb-3">{t('privacy.consent.title')}</h2>
              <p className="text-sm md:text-base leading-relaxed">
                {t('privacy.consent.content')}
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

export default Privacy;

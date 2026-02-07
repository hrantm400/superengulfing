import React from 'react';
import { useTranslation } from '../../locales';

const FAQItem: React.FC<{ question: string; answer: string; defaultOpen?: boolean }> = ({ question, answer, defaultOpen = false }) => {
  return (
    <details className="glass-panel rounded-2xl group border border-border overflow-hidden" open={defaultOpen}>
      <summary className="p-6 cursor-pointer flex items-center justify-between font-bold text-lg select-none text-foreground">
        <span>{question}</span>
        <span className="material-symbols-outlined text-primary group-open:rotate-180 transition-transform duration-300">expand_more</span>
      </summary>
      <div className="p-6 pt-0 text-muted leading-relaxed border-t border-border bg-surfaceElevated">
        {answer}
      </div>
    </details>
  );
};

const LiqScanFAQ: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-32">
      <h2 className="text-3xl font-bold text-center mb-16 text-foreground">{t('liqScan.faq.title')}</h2>
      <div className="space-y-4">
        <FAQItem
          question={t('liqScan.faq.q1')}
          answer={t('liqScan.faq.a1')}
          defaultOpen={true}
        />
        <FAQItem
          question={t('liqScan.faq.q2')}
          answer={t('liqScan.faq.a2')}
        />
        <FAQItem
          question={t('liqScan.faq.q3')}
          answer={t('liqScan.faq.a3')}
        />
      </div>
    </section>
  );
};

export default LiqScanFAQ;
